'use server'

import { apiCall } from '@/lib/api/client'
import {
  ApiBatchResultSchema,
  ApiDueCardSchema,
  ApiForecastDaySchema,
  ApiReviewSubmitResponseSchema,
  ApiReviewedCardSchema,
  SessionSummarySchema,
  apiListEnvelope,
  type SessionSummary,
  type ApiDueCard,
  type ApiForecastDay,
  type ApiList,
  type ApiBatchResult,
  type ApiReviewedCard,
  type SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

export async function getDueCardsAction(): Promise<ApiList<ApiDueCard>> {
  return apiCall<ApiList<ApiDueCard>>(
    '/api/v1/reviews/due',
    apiListEnvelope(ApiDueCardSchema),
    {},
    'Failed to fetch due cards',
  )
}

export async function submitReviewAction(
  cardId:          SubmitReviewInput['cardId'],
  rating:          SubmitReviewInput['rating'],
  reviewTimeMs?:   SubmitReviewInput['reviewTimeMs'],
  sessionId?:      SubmitReviewInput['sessionId'],
  idempotencyKey?: string,
): Promise<ApiReviewedCard> {
  // Server requires the header — generate one per call when the caller doesn't
  // supply one. Direct-from-UI submits use a fresh key per click; offline-queue
  // retries reuse the queue entry's stored key.
  const key = idempotencyKey ?? crypto.randomUUID()
  return apiCall<ApiReviewedCard>(
    '/api/v1/reviews/submit',
    ApiReviewSubmitResponseSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
      body:    JSON.stringify({ cardId, rating, reviewTimeMs, sessionId }),
    },
    'Failed to submit review',
  )
}

export async function getSessionSummaryAction(sessionId: string): Promise<SessionSummary> {
  return apiCall<SessionSummary>(
    `/api/v1/reviews/session-summary/${encodeURIComponent(sessionId)}`,
    SessionSummarySchema,
    {},
    'Failed to fetch session summary',
  )
}

export async function submitBatchAction(
  reviews:         SubmitReviewInput[],
  idempotencyKey?: string,
): Promise<ApiBatchResult<ApiReviewedCard>> {
  const key = idempotencyKey ?? crypto.randomUUID()
  return apiCall<ApiBatchResult<ApiReviewedCard>>(
    '/api/v1/reviews/batch',
    ApiBatchResultSchema(ApiReviewedCardSchema),
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
      body:    JSON.stringify({ reviews }),
    },
    'Failed to submit batch',
  )
}

export async function getReviewForecastAction(): Promise<ApiList<ApiForecastDay>> {
  return apiCall<ApiList<ApiForecastDay>>(
    '/api/v1/reviews/forecast',
    apiListEnvelope(ApiForecastDaySchema),
    {},
    'Failed to fetch forecast',
  )
}
