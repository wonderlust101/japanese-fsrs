import type { ApiBatchResult, ReviewRating, SubmitReviewInput } from "@fsrs-japanese/shared-types";
import type { RecordLogItem } from "ts-fsrs";

import type { FsrsCardRow, ProcessReviewResult } from "./shared.ts";
import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { invalidateDueCache } from "../../lib/due-cache.ts";

import { AppError, dbError } from "../../middleware/errorHandler.ts";
import { buildFsrsCard, FSRS_SELECT_COLUMNS, FsrsCardRowSchema, mapRatingToGrade, scheduler, WEAK_SPOT_THRESHOLD } from "./shared.ts";

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Per-row return shape from process_review_batch. Validated at runtime so a
// future signature drift surfaces as a ZodError.

const BatchResultRowSchema = z.object({
	card_id: z.string(),
	success: z.boolean(),
	error_message: z.string().nullable(),
	due: z.string().nullable(),
	stability: z.number().nullable(),
	difficulty: z.number().nullable(),
	scheduled_days: z.number().nullable(),
	state: z.number().nullable(),
	review_log_id: z.string().uuid().nullable(),
});

/**
 * Returns the subset of `cardIds` that belong to an archived deck (the
 * caller's). Used to gate review writes (`processReviewBatch`) so archived
 * decks behave like a freeze.
 *
 * One round-trip via PostgREST inner-join on the existing cards.deck_id FK.
 * The join filters server-side on `decks.archived_at IS NOT NULL`, so only
 * card rows whose deck is archived come back. Indexed on both sides.
 */
async function getArchivedCardIds(userId: string, cardIds: readonly string[]): Promise<Set<string>> {
	if (cardIds.length === 0)
		return new Set();

	const { data, error } = await supabaseAdmin
		.from("cards")
		.select("id, decks!inner(archived_at)")
		.eq("user_id", userId)
		.in("id", [...cardIds])
		.not("decks.archived_at", "is", null);

	if (error !== null) {
		throw dbError("intersect archived deck cards", error);
	}

	return new Set((data ?? []).map((c: { id: string }) => c.id));
}

// ── Single-review helpers ────────────────────────────────────────────────────

async function fetchSingleCardForReview(cardId: string, userId: string): Promise<FsrsCardRow> {
	// Filter by user_id to exclude premade source cards (which carry user_id NULL).
	const { data, error: fetchError } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.eq("id", cardId)
		.eq("user_id", userId)
		// .maybeSingle() (NOT .single()): a missing / wrong-owner card must resolve
		// to null-without-error so the `data === null` branch returns 404
		// CARD_NOT_FOUND. .single() emits a PGRST116 *error* on zero rows, which the
		// fetchError branch would mis-map to a generic 500.
		.maybeSingle();

	if (fetchError !== null) {
		throw dbError("fetch card", fetchError);
	}
	if (data === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}

	const row = FsrsCardRowSchema.parse(data);

	if (row.user_id === null) {
		throw new AppError(403, "Cannot review a premade source card", { code: "PREMADE_CARD_NOT_REVIEWABLE" });
	}
	if (row.is_suspended) {
		throw new AppError(409, "Card is suspended; unsuspend it before reviewing", { code: "CARD_SUSPENDED" });
	}

	return row;
}

async function persistSingleReview(
	cardId: string,
	userId: string,
	row: FsrsCardRow,
	updated: RecordLogItem["card"],
	rating: ReviewRating,
	reviewedAt: Date,
	reviewTimeMs: number | undefined,
	sessionId: string | undefined,
): Promise<string | null> {
	// Args cast: nullable RPC params (p_review_time_ms, p_last_review_before,
	// p_session_id) are typed as non-nullable in the generated Database type
	// because the migration declares them without DEFAULT NULL. The DB accepts
	// NULL at runtime; supabase-js sends NULL correctly.
	//
	// process_review RETURNS the inserted review_logs id (migration
	// 20260706000000) so we read it straight off `data` — no follow-up SELECT.
	const { data: reviewLogId, error: rpcError } = await supabaseAdmin.rpc("process_review", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
		p_state: updated.state,
		p_due: updated.due.toISOString(),
		p_stability: updated.stability,
		p_difficulty: updated.difficulty,
		p_elapsed_days: updated.elapsed_days,
		p_scheduled_days: updated.scheduled_days,
		p_learning_steps: updated.learning_steps,
		p_reps: updated.reps,
		p_lapses: updated.lapses,
		p_last_review: reviewedAt.toISOString(),
		p_updated_at: reviewedAt.toISOString(),
		p_rating: rating,
		p_review_time_ms: reviewTimeMs ?? null,
		p_stability_after: updated.stability,
		p_difficulty_after: updated.difficulty,
		p_due_after: updated.due.toISOString(),
		p_scheduled_days_after: updated.scheduled_days,
		p_weak_spot_threshold: WEAK_SPOT_THRESHOLD,
		// Before-snapshot — enables rollback via rollbackReview().
		p_state_before: row.state,
		p_stability_before: row.stability,
		p_difficulty_before: row.difficulty,
		p_due_before: row.due,
		p_scheduled_days_before: row.scheduled_days,
		p_learning_steps_before: row.learning_steps,
		p_elapsed_days_before: row.elapsed_days,
		p_last_review_before: row.last_review ?? null,
		p_reps_before: row.reps,
		p_lapses_before: row.lapses,
		p_session_id: sessionId ?? null,
	}));

	if (rpcError !== null) {
		// SQLSTATE 'P0420' is the archive guard added inside process_review by
		// migration 20260625000000. Map it back to the 422 + DECK_ARCHIVED
		// shape the batch path already emits, so the frontend branches on a
		// single error code regardless of single vs batch.
		if (rpcError.code === "P0420") {
			throw new AppError(422, "Deck is archived. Unarchive it to review.", { code: "DECK_ARCHIVED" });
		}
		throw dbError("persist review", rpcError);
	}

	return reviewLogId;
}

/**
 * Processes a single review rating and updates the card's FSRS scheduling state.
 *
 * This is the **only** function that writes FSRS state fields to `cards`.
 * Card update, review log, and weakSpot detection are executed inside a single
 * PostgreSQL transaction via the `process_review` RPC. The archive gate lives
 * inside that RPC (migration 20260625000000); persistSingleReview maps SQLSTATE
 * 'P0420' back to the 422 + DECK_ARCHIVED shape.
 */
export async function processReview(
	cardId: string,
	rating: ReviewRating,
	userId: string,
	reviewTimeMs?: number,
	sessionId?: string,
): Promise<ProcessReviewResult> {
	const row = await fetchSingleCardForReview(cardId, userId);

	const reviewedAt = new Date();
	const { card: updated }: RecordLogItem = scheduler.next(
		buildFsrsCard(row),
		reviewedAt,
		mapRatingToGrade(rating),
	);

	const reviewLogId = await persistSingleReview(
		cardId,
		userId,
		row,
		updated,
		rating,
		reviewedAt,
		reviewTimeMs,
		sessionId,
	);

	// Invalidate the user's cached due list. Fire-and-forget so the response
	// isn't blocked on Redis — see lib/due-cache.ts.
	void invalidateDueCache(userId);

	return {
		id: cardId,
		reviewLogId,
		due: updated.due.toISOString(),
		stability: updated.stability,
		difficulty: updated.difficulty,
		scheduledDays: updated.scheduled_days,
		state: updated.state,
	};
}

// ── Batch-review helpers ─────────────────────────────────────────────────────

// RPC payload row mirrors the per-review fields process_review takes,
// packed flat per the JSONB shape declared in the migration.
interface BatchRpcRow {
	card_id: string;
	rating: ReviewRating;
	review_time_ms: number | null;
	session_id: string | null;
	p_state: number;
	p_due: string;
	p_stability: number;
	p_difficulty: number;
	p_elapsed_days: number;
	p_scheduled_days: number;
	p_learning_steps: number;
	p_reps: number;
	p_lapses: number;
	p_last_review: string;
	p_state_before: number;
	p_stability_before: number;
	p_difficulty_before: number;
	p_due_before: string;
	p_scheduled_days_before: number;
	p_learning_steps_before: number;
	p_elapsed_days_before: number;
	p_last_review_before: string | null;
	p_reps_before: number;
	p_lapses_before: number;
}

async function fetchCardsForBatch(cardIds: string[], userId: string): Promise<Map<string, FsrsCardRow>> {
	const { data, error: fetchError } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.in("id", cardIds)
		.eq("user_id", userId);

	if (fetchError !== null) {
		throw dbError("fetch cards for batch review", fetchError);
	}

	return new Map<string, FsrsCardRow>(
		z.array(FsrsCardRowSchema).parse(data ?? []).map(r => [r.id, r]),
	);
}

// Returns a discriminated result so the caller can narrow `row` to non-null on
// success without a type assertion. Mirrors the throw-per-guard structure of
// processReview but in soft-fail-per-row form (the batch contract preserves
// the contract of the previous serial implementation — see processReviewBatch
// docstring).
function validateBatchReview(
	cardId: string,
	row: FsrsCardRow | undefined,
	archivedCardIds: ReadonlySet<string>,
): { ok: true; row: FsrsCardRow } | { ok: false; cardId: string; error: string } {
	if (row === undefined) {
		return { ok: false, cardId, error: "Card not found" };
	}
	if (row.user_id === null) {
		return { ok: false, cardId, error: "Cannot review a premade source card" };
	}
	if (row.is_suspended) {
		return { ok: false, cardId, error: "Card is suspended; unsuspend it before reviewing" };
	}
	if (archivedCardIds.has(cardId)) {
		// Soft-fail per-row, same as suspend/missing — the rest of the batch
		// proceeds. Single-card processReview throws 422 DECK_ARCHIVED; here
		// we surface a sibling error string the controller already echoes.
		return { ok: false, cardId, error: "Deck is archived; unarchive it before reviewing" };
	}
	return { ok: true, row };
}

function computeBatchPayloadRow(review: SubmitReviewInput, row: FsrsCardRow): BatchRpcRow {
	const reviewedAt = new Date();
	const { card: updated }: RecordLogItem = scheduler.next(
		buildFsrsCard(row),
		reviewedAt,
		mapRatingToGrade(review.rating),
	);

	return {
		card_id: review.cardId,
		rating: review.rating,
		review_time_ms: review.reviewTimeMs ?? null,
		session_id: review.sessionId ?? null,
		p_state: updated.state,
		p_due: updated.due.toISOString(),
		p_stability: updated.stability,
		p_difficulty: updated.difficulty,
		p_elapsed_days: updated.elapsed_days,
		p_scheduled_days: updated.scheduled_days,
		p_learning_steps: updated.learning_steps,
		p_reps: updated.reps,
		p_lapses: updated.lapses,
		p_last_review: reviewedAt.toISOString(),
		p_state_before: row.state,
		p_stability_before: row.stability,
		p_difficulty_before: row.difficulty,
		p_due_before: row.due,
		p_scheduled_days_before: row.scheduled_days,
		p_learning_steps_before: row.learning_steps,
		p_elapsed_days_before: row.elapsed_days,
		p_last_review_before: row.last_review ?? null,
		p_reps_before: row.reps,
		p_lapses_before: row.lapses,
	};
}

function appendBatchResult(
	rpcRow: z.infer<typeof BatchResultRowSchema>,
	results: ProcessReviewResult[],
	errors: Array<{ cardId: string; error: string }>,
): void {
	if (rpcRow.success && rpcRow.due !== null && rpcRow.stability !== null && rpcRow.difficulty !== null
		&& rpcRow.scheduled_days !== null && rpcRow.state !== null) {
		results.push({
			id: rpcRow.card_id,
			reviewLogId: rpcRow.review_log_id,
			due: rpcRow.due,
			stability: rpcRow.stability,
			difficulty: rpcRow.difficulty,
			scheduledDays: rpcRow.scheduled_days,
			state: rpcRow.state,
		});
	} else {
		errors.push({
			cardId: rpcRow.card_id,
			error: rpcRow.error_message ?? "Unknown error",
		});
	}
}

/**
 * Processes a batch of reviews in a single round-trip via the
 * `process_review_batch` RPC. Pre-fetches all target cards in one query,
 * runs ts-fsrs scheduling per review in JS, then submits all post-schedule
 * states + before-snapshots as one JSONB payload.
 *
 * Per-review failures are caught inside the RPC's per-iteration EXCEPTION
 * block and surfaced via the `errors` array, preserving the contract of
 * the previous serial implementation. Pre-RPC validation failures (missing
 * card, suspended card, archived deck) skip the RPC entry and go straight
 * to `errors` via validateBatchReview.
 */
export async function processReviewBatch(
	reviews: SubmitReviewInput[],
	userId: string,
	opts?: { signal?: AbortSignal | undefined },
): Promise<ApiBatchResult<ProcessReviewResult>> {
	if (reviews.length === 0) {
		return { results: [], errors: [] };
	}

	const cardIds = reviews.map(r => r.cardId);
	const cardMap = await fetchCardsForBatch(cardIds, userId);
	// Pre-resolve which of the requested cards live in archived decks. One
	// small query — bounded by the batch size — so it costs one round-trip,
	// not N.
	const archivedCardIds = await getArchivedCardIds(userId, cardIds);

	const batch: BatchRpcRow[] = [];
	const errors: Array<{ cardId: string; error: string }> = [];

	for (const review of reviews) {
		if (opts?.signal?.aborted) {
			// Client disconnected mid-batch. Abort the WHOLE operation without
			// applying the partial batch: the persist RPC below runs only on a
			// clean, complete build. We throw a transient (5xx) error so
			// withIdempotency drops the stored placeholder instead of caching a
			// partial result — the offline queue's same-key retry then re-runs
			// the full batch cleanly. (Falling through here would apply + cache
			// the partial head: lost on a same-key replay, double-applied on a
			// new-key retry, since process_review is not idempotent across
			// distinct keys.)
			throw new AppError(503, "Batch review aborted before completion; retry the full batch", {
				code: "BATCH_REVIEW_ABORTED",
			});
		}
		const v = validateBatchReview(review.cardId, cardMap.get(review.cardId), archivedCardIds);
		if (!v.ok) {
			errors.push({ cardId: v.cardId, error: v.error });
			continue;
		}
		batch.push(computeBatchPayloadRow(review, v.row));
	}

	const results: ProcessReviewResult[] = [];

	if (batch.length > 0) {
		const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
			"process_review_batch",
			asPayload({
				p_user_id: userId,
				p_reviews: batch,
				p_weak_spot_threshold: WEAK_SPOT_THRESHOLD,
			}),
		);

		if (rpcError !== null) {
			throw dbError("persist review batch", rpcError);
		}

		// Invalidate the user's cached due list — at least one card in the batch
		// moved. Even partial-success batches must invalidate so the next
		// /reviews/due fetch reflects the new state. Fire-and-forget.
		void invalidateDueCache(userId);

		const rpcRows = z.array(BatchResultRowSchema).parse(rpcData ?? []);
		for (const r of rpcRows) {
			appendBatchResult(r, results, errors);
		}
	}

	return { results, errors };
}
