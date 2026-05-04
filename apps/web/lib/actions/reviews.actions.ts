'use server'

import { apiCall } from '@/lib/api/client'
import type {
  ReviewRating,
  SessionSummary,
  ApiDueCard,
  ApiForecastDay,
  ApiBatchResult,
} from '@fsrs-japanese/shared-types'

export type DueCard      = ApiDueCard
export type ForecastDay  = ApiForecastDay
export type BatchResult  = ApiBatchResult

export async function getDueCardsAction(): Promise<DueCard[]> {
  return apiCall<DueCard[]>('/api/v1/reviews/due', {}, 'Failed to fetch due cards')
}

export async function submitReviewAction(
  cardId:        string,
  rating:        ReviewRating,
  reviewTimeMs?: number,
  sessionId?:    string,
): Promise<{ card: DueCard }> {
  return apiCall<{ card: DueCard }>(
    '/api/v1/reviews/submit',
    { method: 'POST', body: JSON.stringify({ cardId, rating, reviewTimeMs, sessionId }) },
    'Failed to submit review',
  )
}

export async function getSessionSummaryAction(sessionId: string): Promise<SessionSummary> {
  return apiCall<SessionSummary>(
    `/api/v1/reviews/session-summary/${encodeURIComponent(sessionId)}`,
    {},
    'Failed to fetch session summary',
  )
}

export async function submitBatchAction(
  reviews: Array<{ cardId: string; rating: ReviewRating; reviewTimeMs?: number }>,
): Promise<BatchResult> {
  return apiCall<BatchResult>(
    '/api/v1/reviews/batch',
    { method: 'POST', body: JSON.stringify({ reviews }) },
    'Failed to submit batch',
  )
}

export async function getReviewForecastAction(): Promise<ForecastDay[]> {
  return apiCall<ForecastDay[]>('/api/v1/reviews/forecast', {}, 'Failed to fetch forecast')
}
