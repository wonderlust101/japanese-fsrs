'use client'

import { useEffect, useRef }                    from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'

import { queryKeys }  from './queryKeys'
import { offlineQueue } from '../offline-queue'
import {
  submitReviewAction,
  submitBatchAction,
  getDueCardsAction,
  getReviewForecastAction,
  getSessionSummaryAction,
} from '../actions/reviews.actions'
import type {
  SessionSummary,
  ApiDueCard, ApiForecastDay, ApiList, ApiReviewedCard,
  SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

// Reuses the canonical shared schema-derived type — `rating` excludes 'manual'
// because the user-facing API rejects it; `reviewTimeMs` / `sessionId` are
// optional and may be undefined post-Zod inference.
type SubmitReviewVariables = SubmitReviewInput

export function useSubmitReview(): UseMutationResult<ApiReviewedCard, Error, SubmitReviewVariables> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cardId, rating, reviewTimeMs, sessionId }: SubmitReviewVariables) =>
      submitReviewAction(cardId, rating, reviewTimeMs, sessionId),

    onError: (err, variables) => {
      console.error('[Review] Submission failed — queuing offline:', err)
      // The queue assigns its own per-entry idempotency key. Direct submits
      // already used a fresh key inside submitReviewAction; the queue path is
      // distinct because a queued retry must use a stable key across attempts.
      offlineQueue.add(variables)
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.heatmap() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.accuracy() })
    },
  })
}

export function useDueCards(): UseQueryResult<ApiList<ApiDueCard>> {
  return useQuery({
    queryKey: queryKeys.reviews.due(),
    queryFn:  getDueCardsAction,
    staleTime: 1000 * 60 * 5,
  })
}

export function useReviewForecast(): UseQueryResult<ApiList<ApiForecastDay>> {
  return useQuery({
    queryKey: queryKeys.reviews.forecast(),
    queryFn:  getReviewForecastAction,
    staleTime: 1000 * 60 * 30,
  })
}

export function useSessionSummary(sessionId: string | null): UseQueryResult<SessionSummary> {
  const safeId = sessionId ?? ''
  return useQuery({
    queryKey: queryKeys.reviews.summary(safeId),
    queryFn:  () => getSessionSummaryAction(safeId),
    enabled:  sessionId !== null,
    staleTime: Infinity,
  })
}

export function useOfflineSync(): void {
  const flushedRef = useRef(false)

  useEffect(() => {
    if (flushedRef.current || offlineQueue.size() === 0) return
    flushedRef.current = true

    const { reviews, batchKey } = offlineQueue.drainBatch()
    if (reviews.length === 0) return

    // Strip queue-only metadata (queuedAt, idempotencyKey) before sending —
    // the wire format is SubmitReviewInput. The batch idempotency key is
    // sent in the header; per-entry keys stay in localStorage so a re-queue
    // after a failed batch preserves them.
    const wireReviews: SubmitReviewInput[] = reviews.map((r) => ({
      cardId:       r.cardId,
      rating:       r.rating,
      reviewTimeMs: r.reviewTimeMs,
    }))

    void submitBatchAction(wireReviews, batchKey)
      .then(() => offlineQueue.confirmBatch())
      .catch(() => offlineQueue.replayBatch(reviews))
  }, [])
}
