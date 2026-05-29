import type { FSRSHistory, Grade, Card as TsFsrsCard } from "ts-fsrs";

import type { FsrsCardRow, ProcessReviewResult } from "./shared.ts";
import { createEmptyCard } from "ts-fsrs";
import { z } from "zod";
import { supabaseAdmin } from "../../db/supabase.ts";
import { asPayload } from "../../lib/db.ts";
import { invalidateDueCache } from "../../lib/due-cache.ts";

import { AppError, dbError } from "../../middleware/errorHandler.ts";
import { FSRS_SELECT_COLUMNS, FsrsCardRowSchema, mapRatingStringToEnum, scheduler, WEAK_SPOT_THRESHOLD } from "./shared.ts";

// ── Reschedule helpers ───────────────────────────────────────────────────────

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
		p_weak_spot_threshold: WEAK_SPOT_THRESHOLD,
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
