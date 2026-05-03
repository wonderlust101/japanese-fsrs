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
} from '../actions/reviews.actions'
import type { ReviewRating } from '@fsrs-japanese/shared-types'

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ cardId, rating, reviewTimeMs }: {
      cardId:        string
      rating:        ReviewRating
      reviewTimeMs?: number
    }) => submitReviewAction(cardId, rating, reviewTimeMs),

    onError: (_err, variables) => {
      offlineQueue.add(variables)
    },

    onSettled: () => {
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
