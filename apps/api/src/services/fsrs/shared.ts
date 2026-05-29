import type { ApiReviewedCard, ReviewRating } from "@fsrs-japanese/shared-types";
import type { CardInput, Grade, FSRS as TsFsrsInstance } from "ts-fsrs";

import { assertNever } from "@fsrs-japanese/shared-types";
import { createEmptyCard, fsrs, generatorParameters, Rating, State } from "ts-fsrs";
import { z } from "zod";
import { env } from "../../lib/env.ts";
import { AppError } from "../../middleware/errorHandler.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

export const WEAK_SPOT_THRESHOLD = env.WEAK_SPOT_THRESHOLD;

// ─── FSRS instance ────────────────────────────────────────────────────────────
// Single scheduler at request_retention = 0.85 (the profiles.retention_target
// default). Params are fixed at construction.

export const scheduler: TsFsrsInstance = fsrs(generatorParameters({ request_retention: 0.85 }));

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
export const FSRS_SELECT_COLUMNS = [
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
export const FsrsCardRowSchema = z.object({
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
export type FsrsCardRow = z.infer<typeof FsrsCardRowSchema>;

/** Convert a DB card row to the CardInput shape ts-fsrs expects. */
export function buildFsrsCard(row: FsrsCardRow): CardInput {
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
export function mapRatingToGrade(rating: ReviewRating): Grade {
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
export function mapRatingStringToEnum(rating: string): Rating {
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
