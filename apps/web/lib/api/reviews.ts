'use client'

import { useEffect, useRef }                    from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { queryKeys }  from './queryKeys'
import { offlineQueue } from '../offline-queue'
import {
  submitReviewAction,
  submitBatchAction,
  getDueCardsAction,
  getReviewForecastAction,
  getSessionSummaryAction,
} from '../actions/reviews.actions'
import type { ReviewRating } from '@fsrs-japanese/shared-types'

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cardId, rating, reviewTimeMs, sessionId }: {
      cardId:        string
      rating:        ReviewRating
      reviewTimeMs?: number
      sessionId?:    string
    }) => submitReviewAction(cardId, rating, reviewTimeMs, sessionId),

    onError: (err, variables) => {
      console.error('[Review] Submission failed — queuing offline:', err)
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

export function useDueCards() {
  return useQuery({
    queryKey: queryKeys.reviews.due(),
    queryFn:  getDueCardsAction,
    staleTime: 1000 * 60 * 5,
  })
}

export function useReviewForecast() {
  return useQuery({
    queryKey: queryKeys.reviews.forecast(),
    queryFn:  getReviewForecastAction,
    staleTime: 1000 * 60 * 30,
  })
}

export function useSessionSummary(sessionId: string | null) {
  return useQuery({
    queryKey: queryKeys.reviews.summary(sessionId ?? ''),
    queryFn:  () => getSessionSummaryAction(sessionId!),
    enabled:  sessionId !== null,
    staleTime: Infinity,
  })
}

export function useOfflineSync(): void {
  const flushedRef = useRef(false)

  useEffect(() => {
    if (flushedRef.current || offlineQueue.size() === 0) return
    flushedRef.current = true

    const queued = offlineQueue.drain()
    void submitBatchAction(queued).catch(() => {
      queued.forEach((r) => offlineQueue.add(r))
    })
  }, [])
}
