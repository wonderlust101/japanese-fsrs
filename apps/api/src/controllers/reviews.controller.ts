import type { RequestHandler } from 'express'
import type { ApiReviewSubmitResponse } from '@fsrs-japanese/shared-types'

import { submitReviewSchema, batchReviewSchema, sessionSummaryParamsSchema } from '@fsrs-japanese/shared-types'
import * as reviewService  from '../services/review.service.ts'
import * as profileService from '../services/profile.service.ts'
import { processReview }   from '../services/fsrs.service.ts'

/**
 * GET /api/v1/reviews/due
 * Returns the cards the authenticated user should review now, capped by their
 * daily review and new-card limits.
 */
export const getDue: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const profile = await profileService.getProfile(req.user.id)
    const cards   = await reviewService.getDueCards(req.user.id, profile)
    res.json(cards)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/reviews/submit
 * Submits a single review rating and updates the card's FSRS scheduling state.
 * Returns the updated scheduling fields wrapped in `{ card: ... }`.
 */
export const submit: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { cardId, rating, reviewTimeMs, sessionId } = submitReviewSchema.parse(req.body)
    const result = await processReview(cardId, rating, req.user.id, reviewTimeMs, sessionId)
    res.json({ card: result } satisfies ApiReviewSubmitResponse)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/reviews/batch
 * Submits a batch of offline-buffered reviews. Processes each review
 * sequentially to avoid races. Partial failures are returned in `errors`
 * without aborting the remainder of the batch.
 */
export const batch: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { reviews } = batchReviewSchema.parse(req.body)
    const result      = await reviewService.submitBatch(reviews, req.user.id)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reviews/forecast
 * Returns the number of cards due per day for the next 14 days.
 * Days with zero due cards are omitted from the response array.
 */
export const forecast: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await reviewService.getReviewForecast(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/reviews/session-summary/:sessionId
 * Returns aggregate stats for a completed review session: total cards, time
 * spent, accuracy, per-rating breakdown, and any leeches triggered.
 */
export const sessionSummary: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { sessionId } = sessionSummaryParamsSchema.parse(req.params)
    const summary = await reviewService.getSessionSummary(sessionId, req.user.id)
    res.json(summary)
  } catch (err) {
    next(err)
  }
}
