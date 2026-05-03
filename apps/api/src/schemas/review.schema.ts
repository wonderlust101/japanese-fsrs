import { z } from 'zod'

// 'manual' is explicitly excluded — it is only valid for internal fsrs.service
// operations (forgetCard, rescheduleFromHistory). The Zod layer rejects it here
// so it can never be submitted by a user via the HTTP API.
export const reviewRatingEnum = z.enum(['again', 'hard', 'good', 'easy'])

export const submitReviewSchema = z.object({
  cardId:       z.string().uuid('Invalid card ID'),
  rating:       reviewRatingEnum,
  reviewTimeMs: z.number().int().min(0).optional(),
  sessionId:    z.string().uuid('Invalid session ID').optional(),
}).strict()

export const sessionSummaryParamsSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID'),
})

export const batchReviewSchema = z.object({
  reviews: z.array(submitReviewSchema).min(1).max(500),
}).strict()

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>
export type BatchReviewInput  = z.infer<typeof batchReviewSchema>
