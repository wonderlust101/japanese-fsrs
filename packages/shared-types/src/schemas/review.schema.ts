import { z } from "zod";

import { ReviewRating } from "../review.types.ts";

// 'manual' is explicitly excluded — it is only valid for internal fsrs.service
// operations (forgetCard, rescheduleFromHistory). The Zod layer rejects it here
// so it can never be submitted by a user via the HTTP API.
type UserReviewRating = Exclude<ReviewRating, typeof ReviewRating.Manual>;
const userReviewRatings = Object.values(ReviewRating)
	.filter((r): r is UserReviewRating => r !== ReviewRating.Manual) as [UserReviewRating, ...UserReviewRating[]];
export const reviewRatingEnum = z.enum(userReviewRatings);

export const submitReviewSchema = z.object({
	cardId: z.string().uuid("Invalid card ID"),
	rating: reviewRatingEnum,
	reviewTimeMs: z.number().int().min(0).optional(),
	sessionId: z.string().uuid("Invalid session ID").optional(),
}).strict();

export const sessionSummaryParamsSchema = z.object({
	sessionId: z.string().uuid("Invalid session ID"),
});

export const batchReviewSchema = z.object({
	reviews: z.array(submitReviewSchema).min(1).max(500),
}).strict();

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
export type BatchReviewInput = z.infer<typeof batchReviewSchema>;

/**
 * Narrower rating type that excludes the internal 'manual' grade — what
 *  the user-facing UI and HTTP API actually traffic in.
 */
export type UserRating = SubmitReviewInput["rating"];

// ─── Stage 8: rollback / forget endpoints ─────────────────────────────────────

/** URL param schema for `POST /api/v1/reviews/:reviewLogId/rollback`. */
export const rollbackReviewParamSchema = z.object({
	reviewLogId: z.string().uuid("Invalid review log ID"),
}).strict();

/** URL param schema for `GET /api/v1/reviews/:cardId/preview`. */
export const previewRatingsParamSchema = z.object({
	cardId: z.string().uuid("Invalid card ID"),
}).strict();

/**
 * Body schema for `POST /api/v1/cards/:id/forget`.
 *
 *  Stage 8 exposes the service's `resetCount` option as an optional body
 *  field. When `true`, the card returns to state=New AND its lifetime reps
 *  and lapses counters are zeroed. When `false` (default), the card returns
 *  to state=New but lifetime counters are preserved for analytics.
 *
 *  Anki users will recognize this as the "Forget and reset count" toggle.
 */
export const forgetCardBodySchema = z.object({
	resetCount: z.boolean().optional().default(false),
}).strict();

export type RollbackReviewParam = z.infer<typeof rollbackReviewParamSchema>;
export type ForgetCardBody = z.infer<typeof forgetCardBodySchema>;
