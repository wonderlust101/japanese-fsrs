import type { ApiBatchResult, ApiReviewedCard, ReviewRating, SubmitReviewInput } from "@fsrs-japanese/shared-types";
import type { CardInput, FSRSHistory, Grade, RecordLogItem, ReviewLogInput, Card as TsFsrsCard, FSRS as TsFsrsInstance } from "ts-fsrs";

import {
	assertNever,

} from "@fsrs-japanese/shared-types";
import {
	createEmptyCard,
	fsrs,
	generatorParameters,
	Rating,
	State,

} from "ts-fsrs";

import { z } from "zod";

import { supabaseAdmin } from "../db/supabase.ts";
import { asPayload } from "../lib/db.ts";
import { invalidateDueCache } from "../lib/due-cache.ts";
import { env } from "../lib/env.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Per-row return shape from process_review_batch. Validated at runtime so a
// future signature drift surfaces as a ZodError. Mirrors
// DashboardRpcEnvelopeSchema in analytics.service.

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

// ─── Constants ────────────────────────────────────────────────────────────────

const WEAK_SPOT_THRESHOLD = env.WEAK_SPOT_THRESHOLD;

// ─── FSRS instance ────────────────────────────────────────────────────────────
// Single scheduler at request_retention = 0.85 (the profiles.retention_target
// default). Params are fixed at construction.

const scheduler: TsFsrsInstance = fsrs(generatorParameters({ request_retention: 0.85 }));

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Shape returned by all FSRS write operations. Aliased to the wire-format
 * ApiReviewedCard so the service-layer return type and the `card` payload
 * embedded in /reviews/submit responses cannot drift.
 */
export type ProcessReviewResult = ApiReviewedCard;

/** Rating preview for a single outcome — returned by previewNextStates(). */
export interface RatingPreview {
	due: Date;
	scheduledDays: number;
	stability: number;
}

/** Default FSRS field values for a newly inserted card row. */
export interface FsrsInitialState {
	state: State;
	due: string;
	stability: number;
	difficulty: number;
	elapsed_days: number;
	scheduled_days: number;
	learning_steps: number;
	reps: number;
	lapses: number;
	last_review: null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Columns selected for every FSRS operation — keep in sync with FsrsCardRow below. */
const FSRS_SELECT_COLUMNS = [
	"id",
	"user_id",
	"state",
	"is_suspended",
	"due",
	"stability",
	"difficulty",
	"elapsed_days",
	"scheduled_days",
	"learning_steps",
	"reps",
	"lapses",
	"last_review",
].join(", ");

/**
 * Row shape returned by the SELECT above. Schema-as-source so a column drift
 *  surfaces as a ZodError at parse time rather than a silent type mismatch.
 */
const FsrsCardRowSchema = z.object({
	id: z.string(),
	user_id: z.string().nullable(),
	state: z.nativeEnum(State),
	is_suspended: z.boolean(),
	due: z.string(),
	stability: z.number(),
	difficulty: z.number(),
	elapsed_days: z.number(),
	scheduled_days: z.number(),
	learning_steps: z.number(),
	reps: z.number(),
	lapses: z.number(),
	last_review: z.string().nullable(),
});
type FsrsCardRow = z.infer<typeof FsrsCardRowSchema>;

/**
 * Returns the subset of `cardIds` that belong to an archived deck (the
 * caller's). Used to gate review writes (`processReview`,
 * `processReviewBatch`) so archived decks behave like a freeze.
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

/** review_logs row shape — includes before-snapshot columns added in migration 20260502000001. */
const ReviewLogRowSchema = z.object({
	id: z.string(),
	card_id: z.string(),
	user_id: z.string(),
	rating: z.string(),
	review_time_ms: z.number().nullable(),
	stability_after: z.number(),
	difficulty_after: z.number(),
	due_after: z.string(),
	scheduled_days_after: z.number(),
	reviewed_at: z.string(),
	state_before: z.number().nullable(),
	stability_before: z.number().nullable(),
	difficulty_before: z.number().nullable(),
	due_before: z.string().nullable(),
	scheduled_days_before: z.number().nullable(),
	learning_steps_before: z.number().nullable(),
	elapsed_days_before: z.number().nullable(),
	last_review_before: z.string().nullable(),
	reps_before: z.number().nullable(),
	lapses_before: z.number().nullable(),
});

// Column projections for review_logs SELECTs. Avoid select('*') so payload
// scales with `ReviewLogRow` (the type) rather than the full row width.
const REVIEW_LOG_FULL_COLUMNS = [
	"id",
	"card_id",
	"user_id",
	"rating",
	"review_time_ms",
	"stability_after",
	"difficulty_after",
	"due_after",
	"scheduled_days_after",
	"reviewed_at",
	"state_before",
	"stability_before",
	"difficulty_before",
	"due_before",
	"scheduled_days_before",
	"learning_steps_before",
	"elapsed_days_before",
	"last_review_before",
	"reps_before",
	"lapses_before",
].join(", ");

/**
 * Slim review_logs projection used by rescheduleFromHistory — only the two
 *  fields the FSRSHistory mapper consumes. ~10× payload reduction for cards
 *  with long review history.
 */
const REVIEW_LOG_HISTORY_COLUMNS = "rating, reviewed_at";

const ReviewLogHistoryRowSchema = z.object({
	rating: z.string(),
	reviewed_at: z.string(),
});

/** Convert a DB card row to the CardInput shape ts-fsrs expects. */
function buildFsrsCard(row: FsrsCardRow): CardInput {
	return {
		due: new Date(row.due),
		stability: row.stability,
		difficulty: row.difficulty,
		elapsed_days: row.elapsed_days,
		scheduled_days: row.scheduled_days,
		learning_steps: row.learning_steps,
		reps: row.reps,
		lapses: row.lapses,
		state: row.state,
		// exactOptionalPropertyTypes: omit the key entirely when null so we don't
		// assign `undefined` to a property typed `DateInput | null`.
		...(row.last_review !== null ? { last_review: new Date(row.last_review) } : {}),
	};
}

/** Map a user-facing ReviewRating string to the ts-fsrs Grade (excludes Manual). */
function mapRatingToGrade(rating: ReviewRating): Grade {
	switch (rating) {
		case "again": return Rating.Again;
		case "hard": return Rating.Hard;
		case "good": return Rating.Good;
		case "easy": return Rating.Easy;
		case "manual":
			// Unreachable at runtime — Zod rejects 'manual' at the /reviews/submit
			// boundary. Throwing (vs the previous defensive Rating.Good fallback)
			// turns a future Zod regression into a loud 500 instead of silently
			// corrupting schedules with plausible-but-wrong intervals. Stable
			// `code` lets log filters route this without parsing message text.
			throw new AppError(500, "Rating \"manual\" is not allowed in user submissions; rejected at Zod boundary", { code: "FSRS_MANUAL_RATING_BUG" });
		default:
			return assertNever(rating);
	}
}

/**
 * Map a rating string from review_logs (including 'manual') to the ts-fsrs
 * Rating enum.
 *
 * The 'manual' case is explicit because rollbackReview() legitimately receives
 * it — forgetCard() and rescheduleFromHistory() both write 'manual' to
 * review_logs. The default branch THROWS rather than silently mapping unknown
 * strings to Rating.Manual: a corrupt or future-unknown rating value should
 * surface as a loud 500 with a stable code, not silently corrupt a rollback
 * with a plausible-but-wrong grade.
 */
function mapRatingStringToEnum(rating: string): Rating {
	switch (rating) {
		case "again": return Rating.Again;
		case "hard": return Rating.Hard;
		case "good": return Rating.Good;
		case "easy": return Rating.Easy;
		case "manual": return Rating.Manual;
		default:
			throw new AppError(500, `Unknown rating "${rating}" in review_logs`, { code: "FSRS_UNKNOWN_RATING_BUG" });
	}
}

// ─── Public API ───────────────────────────────────────────────────────────────

// ── Single-review helpers ────────────────────────────────────────────────────

async function fetchSingleCardForReview(cardId: string, userId: string): Promise<FsrsCardRow> {
	// Filter by user_id to exclude premade source cards (which carry user_id NULL).
	const { data, error: fetchError } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.eq("id", cardId)
		.eq("user_id", userId)
		.single();

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
		p_leech_threshold: WEAK_SPOT_THRESHOLD,
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
				p_leech_threshold: WEAK_SPOT_THRESHOLD,
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

// ── Rollback helpers ─────────────────────────────────────────────────────────

async function fetchReviewLogForRollback(
	userId: string,
	reviewLogId: string,
): Promise<{ log: z.infer<typeof ReviewLogRowSchema>; cardId: string }> {
	// Ownership filter on user_id makes the cross-user case 404.
	const { data: logData, error: logError } = await supabaseAdmin
		.from("review_logs")
		.select(REVIEW_LOG_FULL_COLUMNS)
		.eq("id", reviewLogId)
		.eq("user_id", userId)
		.maybeSingle();

	if (logError !== null) {
		throw dbError("fetch review log for rollback", logError);
	}
	if (logData === null) {
		throw new AppError(404, "Review log not found", { code: "REVIEW_LOG_NOT_FOUND" });
	}

	const log = ReviewLogRowSchema.parse(logData);
	const cardId = log.card_id;
	if (cardId === null) {
		// Orphan log (the card was deleted post-review). Per the weakSpot-orphan
		// precedent this is a 404 — the card simply isn't there anymore.
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}

	return { log, cardId };
}

async function fetchCardForRollback(cardId: string, userId: string): Promise<FsrsCardRow> {
	const { data: cardData, error: cardError } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.eq("id", cardId)
		.eq("user_id", userId)
		.maybeSingle();

	if (cardError !== null) {
		throw dbError("fetch card for rollback", cardError);
	}
	if (cardData === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}

	return FsrsCardRowSchema.parse(cardData);
}

function buildRollbackLogInput(log: z.infer<typeof ReviewLogRowSchema>): ReviewLogInput {
	if (
		log.state_before === null
		|| log.due_before === null
		|| log.stability_before === null
		|| log.difficulty_before === null
	) {
		// Logs written before migration 20260502000001 have null snapshots.
		throw new AppError(409, "This review cannot be rolled back", { code: "ROLLBACK_NOT_AVAILABLE" });
	}

	// The four _before fields above are written atomically — narrowed together by the guard.
	return {
		rating: mapRatingStringToEnum(log.rating),
		state: log.state_before as State,
		due: new Date(log.due_before),
		stability: log.stability_before,
		difficulty: log.difficulty_before,
		elapsed_days: log.elapsed_days_before ?? 0,
		last_elapsed_days: 0, // not stored; deprecated ts-fsrs field
		scheduled_days: log.scheduled_days_before ?? 0,
		learning_steps: log.learning_steps_before ?? 0,
		review: new Date(log.reviewed_at),
	};
}

async function persistRollback(
	cardId: string,
	userId: string,
	restored: TsFsrsCard,
	now: Date,
): Promise<void> {
	const { error: updateError } = await supabaseAdmin
		.from("cards")
		.update({
			state: restored.state,
			due: restored.due.toISOString(),
			stability: restored.stability,
			difficulty: restored.difficulty,
			elapsed_days: restored.elapsed_days,
			scheduled_days: restored.scheduled_days,
			learning_steps: restored.learning_steps,
			reps: restored.reps,
			lapses: restored.lapses,
			last_review: restored.last_review?.toISOString() ?? null,
			updated_at: now.toISOString(),
		})
		.eq("id", cardId)
		.eq("user_id", userId);

	if (updateError !== null) {
		throw dbError("rollback card", updateError);
	}
}

/**
 * Undoes a specific review log entry and restores the card to its pre-review state.
 *
 * Requires non-null before-snapshot fields on the log. Logs written before
 * migration 20260502000001 have null snapshots and return 409.
 * The log entry itself is preserved as an immutable audit trail — only the
 * card row is updated.
 *
 * Stage 8 changed the signature from `(cardId, userId, reviewLogId)` to
 * `(userId, reviewLogId)` so the public `POST /api/v1/reviews/:reviewLogId/rollback`
 * endpoint has a natural URL shape. The card_id is read from the review_log
 * row, which already references it via FK — no extra round-trip vs the prior
 * signature (the log fetch still runs).
 */
export async function rollbackReview(
	userId: string,
	reviewLogId: string,
): Promise<ProcessReviewResult> {
	const { log, cardId } = await fetchReviewLogForRollback(userId, reviewLogId);
	const row = await fetchCardForRollback(cardId, userId);
	const reviewLogInput = buildRollbackLogInput(log);
	const restored: TsFsrsCard = scheduler.rollback(buildFsrsCard(row), reviewLogInput);

	await persistRollback(cardId, userId, restored, new Date());

	return {
		id: cardId,
		reviewLogId: null,
		due: restored.due.toISOString(),
		stability: restored.stability,
		difficulty: restored.difficulty,
		scheduledDays: restored.scheduled_days,
		state: restored.state,
	};
}

/**
 * Resets a card to New state (Anki "Forget").
 *
 * Atomically resets the card and writes a 'manual' review log via the
 * process_forget RPC. The before-snapshot is always written so the forget
 * itself can be rolled back.
 *
 * @param resetCount - When true, zeroes reps + lapses. Default false (preserves history).
 */
export async function forgetCard(
	cardId: string,
	userId: string,
	resetCount = false,
): Promise<ProcessReviewResult> {
	const { data, error: fetchError } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.eq("id", cardId)
		.eq("user_id", userId)
		.single();

	if (fetchError !== null || data === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}

	const row = FsrsCardRowSchema.parse(data);

	if (row.user_id === null) {
		throw new AppError(403, "Cannot reset a premade source card", { code: "PREMADE_CARD_NOT_RESETTABLE" });
	}

	const now = new Date();
	const { card: forgotten }: RecordLogItem = scheduler.forget(buildFsrsCard(row), now, resetCount);

	// Args wrapped via asPayload: see process_review note above.
	const { error: rpcError } = await supabaseAdmin.rpc("process_forget", asPayload({
		p_card_id: cardId,
		p_user_id: userId,
		p_due: forgotten.due.toISOString(),
		p_stability: forgotten.stability,
		p_difficulty: forgotten.difficulty,
		p_scheduled_days: forgotten.scheduled_days,
		p_reps: forgotten.reps,
		p_lapses: forgotten.lapses,
		p_updated_at: now.toISOString(),
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
	}));

	if (rpcError !== null) {
		throw dbError("forget card", rpcError);
	}

	// Card moved back to New state; due-list visibility changes. Fire-and-forget.
	void invalidateDueCache(userId);

	return {
		id: cardId,
		reviewLogId: null,
		due: forgotten.due.toISOString(),
		stability: forgotten.stability,
		difficulty: forgotten.difficulty,
		scheduledDays: forgotten.scheduled_days,
		state: forgotten.state,
	};
}

/**
 * Returns the current recall probability for a card (0–1). Pure math — no DB.
 */
export function getRetrievability(stability: number, elapsedDays: number): number {
	return scheduler.forgetting_curve(elapsedDays, stability);
}

/**
 * Returns all 4 rating outcomes without writing to DB (for UI preview).
 *
 * This is the ONLY valid call site for scheduler.repeat(). Do not call
 * repeat() anywhere else — use scheduler.next() for actual reviews.
 */
export function previewNextStates(
	row: FsrsCardRow,
	now?: Date,
): Record<"again" | "hard" | "good" | "easy", RatingPreview> {
	const preview = scheduler.repeat(buildFsrsCard(row), now ?? new Date());

	return {
		again: { due: preview[Rating.Again].card.due, scheduledDays: preview[Rating.Again].card.scheduled_days, stability: preview[Rating.Again].card.stability },
		hard: { due: preview[Rating.Hard].card.due, scheduledDays: preview[Rating.Hard].card.scheduled_days, stability: preview[Rating.Hard].card.stability },
		good: { due: preview[Rating.Good].card.due, scheduledDays: preview[Rating.Good].card.scheduled_days, stability: preview[Rating.Good].card.stability },
		easy: { due: preview[Rating.Easy].card.due, scheduledDays: preview[Rating.Easy].card.scheduled_days, stability: preview[Rating.Easy].card.stability },
	};
}

/**
 * Loads an owned card's FSRS state and returns the four-rating preview.
 * Backs `GET /api/v1/reviews/:cardId/preview` (the Anki-style "what happens
 * if I rate this?" labels above the rating buttons).
 *
 * Reuses the same ownership + premade-source guards as processReview so
 * preview results match exactly what a real rating would yield. Suspended
 * cards are allowed (preview is informational; the UI surface won't render
 * rating buttons for a suspended card anyway).
 */
export async function previewCardRatings(
	cardId: string,
	userId: string,
): Promise<Record<"again" | "hard" | "good" | "easy", RatingPreview>> {
	const { data, error } = await supabaseAdmin
		.from("cards")
		.select(FSRS_SELECT_COLUMNS)
		.eq("id", cardId)
		.eq("user_id", userId)
		.single();

	if (error !== null) {
		throw dbError("fetch card for preview", error);
	}
	if (data === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}

	const row = FsrsCardRowSchema.parse(data);

	if (row.user_id === null) {
		throw new AppError(403, "Cannot preview a premade source card", { code: "PREMADE_CARD_NOT_REVIEWABLE" });
	}

	return previewNextStates(row);
}

// ── Reschedule helpers ───────────────────────────────────────────────────────

async function fetchCardAndRescheduleHistory(
	cardId: string,
	userId: string,
): Promise<{ row: FsrsCardRow; logs: z.infer<typeof ReviewLogHistoryRowSchema>[] }> {
	const [cardResult, logsResult] = await Promise.all([
		supabaseAdmin
			.from("cards")
			.select(FSRS_SELECT_COLUMNS)
			.eq("id", cardId)
			.eq("user_id", userId)
			.single(),
		supabaseAdmin
			.from("review_logs")
			.select(REVIEW_LOG_HISTORY_COLUMNS)
			.eq("card_id", cardId)
			.eq("user_id", userId)
			.neq("rating", "manual")
			.not("state_before", "is", null)
			.order("reviewed_at", { ascending: true }),
	]);

	if (cardResult.error !== null || cardResult.data === null) {
		throw new AppError(404, "Card not found", { code: "CARD_NOT_FOUND" });
	}
	if (logsResult.error !== null) {
		throw dbError("fetch review logs", logsResult.error);
	}

	const row = FsrsCardRowSchema.parse(cardResult.data);
	const logs = z.array(ReviewLogHistoryRowSchema).parse(logsResult.data ?? []);

	if (logs.length === 0) {
		throw new AppError(409, "No eligible review logs to reschedule from", { code: "RESCHEDULE_NO_HISTORY" });
	}

	return { row, logs };
}

function computeRescheduledCard(logs: z.infer<typeof ReviewLogHistoryRowSchema>[]): TsFsrsCard {
	// FSRSHistory.rating excludes Rating.Manual; the caller's SELECT filters
	// .neq('rating', 'manual'), so mapRatingStringToEnum never returns Manual here.
	const history: FSRSHistory[] = logs.map(log => ({
		rating: mapRatingStringToEnum(log.rating) as Grade,
		review: new Date(log.reviewed_at),
	}));

	const result = scheduler.reschedule(createEmptyCard(), history);
	if (result.reschedule_item === null) {
		throw new AppError(409, "Reschedule produced no result", { code: "RESCHEDULE_NO_RESULT" });
	}
	return result.reschedule_item.card;
}

async function persistRescheduledCard(
	cardId: string,
	userId: string,
	row: FsrsCardRow,
	updated: TsFsrsCard,
	now: Date,
): Promise<void> {
	const { error: rpcError } = await supabaseAdmin.rpc("process_review", asPayload({
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
		p_last_review: updated.last_review?.toISOString() ?? now.toISOString(),
		p_updated_at: now.toISOString(),
		p_rating: "manual",
		p_review_time_ms: null,
		p_stability_after: updated.stability,
		p_difficulty_after: updated.difficulty,
		p_due_after: updated.due.toISOString(),
		p_scheduled_days_after: updated.scheduled_days,
		p_leech_threshold: WEAK_SPOT_THRESHOLD,
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
	}));

	if (rpcError !== null) {
		throw dbError("reschedule card", rpcError);
	}
}

/**
 * Replays the card's full review history to recompute the schedule.
 * Use this after changing FSRS weights (e.g. after running computeParameters()).
 *
 * Only review_logs with non-null state_before are included (post-migration entries).
 * 'manual' rating entries (forget / reschedule ops) are excluded from the history
 * replay since FSRSHistory only accepts user-facing grades.
 *
 * Persists the result via process_review RPC with rating='manual'.
 */
export async function rescheduleFromHistory(
	cardId: string,
	userId: string,
): Promise<ProcessReviewResult> {
	const { row, logs } = await fetchCardAndRescheduleHistory(cardId, userId);
	const updated = computeRescheduledCard(logs);
	const now = new Date();

	await persistRescheduledCard(cardId, userId, row, updated, now);

	// Reschedule rewrote the card's due date; refresh the cached due list. Fire-and-forget.
	void invalidateDueCache(userId);

	return {
		id: cardId,
		reviewLogId: null,
		due: updated.due.toISOString(),
		stability: updated.stability,
		difficulty: updated.difficulty,
		scheduledDays: updated.scheduled_days,
		state: updated.state,
	};
}

/**
 * Returns the default FSRS field values for a newly inserted card row.
 * Call this when creating a card to get a consistent initial scheduling state.
 */
export function getInitialFsrsState(): FsrsInitialState {
	const empty = createEmptyCard();
	return {
		state: empty.state,
		due: empty.due.toISOString(),
		stability: empty.stability,
		difficulty: empty.difficulty,
		elapsed_days: empty.elapsed_days,
		scheduled_days: empty.scheduled_days,
		learning_steps: empty.learning_steps,
		reps: empty.reps,
		lapses: empty.lapses,
		last_review: null,
	};
}
