import type { RecordLogItem, ReviewLogInput, State, Card as TsFsrsCard } from "ts-fsrs";

import type { FsrsCardRow, ProcessReviewResult } from "./shared.ts";
import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { invalidateDueCache } from "../../lib/due-cache.ts";

import { AppError, dbError } from "../../middleware/errorHandler.ts";
import { buildFsrsCard, FSRS_SELECT_COLUMNS, FsrsCardRowSchema, mapRatingStringToEnum, scheduler } from "./shared.ts";

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
 * @param cardId - The card to reset to New state.
 * @param userId - Owner of the card; scopes the lookup.
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
