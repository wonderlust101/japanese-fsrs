import type { FsrsCardRow, RatingPreview } from "./shared.ts";
import { Rating } from "ts-fsrs";
import { supabaseAdmin } from "../../db/supabase.ts";

import { AppError, dbError } from "../../middleware/errorHandler.ts";
import { buildFsrsCard, FSRS_SELECT_COLUMNS, FsrsCardRowSchema, scheduler } from "./shared.ts";

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
		// .maybeSingle() (NOT .single()): a missing / wrong-owner card must resolve
		// to null-without-error so the `data === null` branch returns 404. .single()
		// emits a PGRST116 *error* on zero rows that the error branch would mis-map
		// to a 500.
		.maybeSingle();

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
