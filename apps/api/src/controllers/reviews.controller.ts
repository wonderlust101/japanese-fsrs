import type { RequestHandler } from 'express'

import { submitReviewSchema, batchReviewSchema, sessionSummaryParamsSchema } from '@fsrs-japanese/shared-types'
import * as reviewService  from '../services/review.service.ts'
import * as profileService from '../services/profile.service.ts'
import { processReview }   from '../services/fsrs.service.ts'
import { withIdempotency } from '../lib/idempotency.ts'

/**
 * GET /api/v1/reviews/due
 * Returns the cards the authenticated user should review now, capped by their
 * daily review and new-card limits.
 */
export const getDue: RequestHandler = async (req, res): Promise<void> => {
  const profile = await profileService.getProfile(req.user.id)
  const cards   = await reviewService.getDueCards(req.user.id, profile)
  res.json(cards)
}

/**
 * POST /api/v1/reviews/submit
 * Submits a single review rating and updates the card's FSRS scheduling state.
 * Returns the updated scheduling fields raw (matches the create/update endpoints
 * for decks and cards). Requires `Idempotency-Key` header — same key + same
 * body replays the original response without re-running FSRS.
 */
export const submit: RequestHandler = async (req, res): Promise<void> => {
  const input = submitReviewSchema.parse(req.body)
  const { status, body } = await withIdempotency(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      const result = await processReview(
        input.cardId, input.rating, req.user.id, input.reviewTimeMs, input.sessionId,
      )
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/**
 * POST /api/v1/reviews/batch
 * Submits a batch of offline-buffered reviews. Processes each review
 * sequentially to avoid races. Partial failures are returned in `errors`
 * without aborting the remainder of the batch. Requires `Idempotency-Key`
 * header — keyed per logical batch attempt; retries from the offline queue
 * reuse the same key and replay the stored response.
 */
export const batch: RequestHandler = async (req, res): Promise<void> => {
  const input = batchReviewSchema.parse(req.body)
  const { status, body } = await withIdempotency(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      const result = await reviewService.submitBatch(input.reviews, req.user.id, { signal: req.signal })
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/**
 * GET /api/v1/reviews/forecast
 * Returns the number of cards due per day for the next 14 days.
 * Days with zero due cards are omitted from the response array.
 */
export const forecast: RequestHandler = async (req, res): Promise<void> => {
  const data = await reviewService.getReviewForecast(req.user.id)
  res.json(data)
}

/**
 * GET /api/v1/reviews/session-summary/:sessionId
 * Returns aggregate stats for a completed review session: total cards, time
 * spent, accuracy, per-rating breakdown, and any leeches triggered.
 */
export const sessionSummary: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = sessionSummaryParamsSchema.parse(req.params)
  const summary = await reviewService.getSessionSummary(sessionId, req.user.id)
  res.json(summary)
}
