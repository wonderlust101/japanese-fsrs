'use server'

import { z } from 'zod'

import { apiCall } from '@/lib/api/client'
import {
  ApiBatchResultSchema,
  ApiDueCardSchema,
  ApiForecastDaySchema,
  ApiReviewSubmitResponseSchema,
  ApiReviewedCardSchema,
  SessionSummarySchema,
  type SessionSummary,
  type ApiDueCard,
  type ApiForecastDay,
  type ApiBatchResult,
  type ApiReviewedCard,
  type SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

export async function getDueCardsAction(): Promise<ApiDueCard[]> {
  return apiCall<ApiDueCard[]>(
    '/api/v1/reviews/due',
    z.array(ApiDueCardSchema),
    {},
    'Failed to fetch due cards',
  )
}

export async function submitReviewAction(
  cardId:        SubmitReviewInput['cardId'],
  rating:        SubmitReviewInput['rating'],
  reviewTimeMs?: SubmitReviewInput['reviewTimeMs'],
  sessionId?:    SubmitReviewInput['sessionId'],
): Promise<{ card: ApiReviewedCard }> {
  return apiCall<{ card: ApiReviewedCard }>(
    '/api/v1/reviews/submit',
    ApiReviewSubmitResponseSchema,
    { method: 'POST', body: JSON.stringify({ cardId, rating, reviewTimeMs, sessionId }) },
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
  reviews: SubmitReviewInput[],
): Promise<ApiBatchResult<ApiReviewedCard>> {
  return apiCall<ApiBatchResult<ApiReviewedCard>>(
    '/api/v1/reviews/batch',
    ApiBatchResultSchema(ApiReviewedCardSchema),
    { method: 'POST', body: JSON.stringify({ reviews }) },
    'Failed to submit batch',
  )
}

export async function getReviewForecastAction(): Promise<ApiForecastDay[]> {
  return apiCall<ApiForecastDay[]>(
    '/api/v1/reviews/forecast',
    z.array(ApiForecastDaySchema),
    {},
    'Failed to fetch forecast',
  )
}
