'use client'

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query'

import { queryKeys }  from './queryKeys'
import { offlineQueue, MAX_ATTEMPTS } from '../offline-queue'
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

/**
 * Drains the offline queue exactly once per mount, unless the queue has
 * tipped into the "stuck" state (5+ consecutive failed attempts). When stuck,
 * auto-drain skips and the user must explicitly tap "Retry now" via the
 * `useOfflineQueueStatus` hook to clear the flag and try again.
 */
export function useOfflineSync(): void {
  const flushedRef = useRef(false)

  useEffect(() => {
    if (flushedRef.current) return
    if (offlineQueue.isStuck()) return
    if (offlineQueue.size() === 0) return
    flushedRef.current = true

    void runOfflineDrain()
  }, [])
}

/** Single-flight drain shared by useOfflineSync (auto) and retryNow (manual). */
async function runOfflineDrain(): Promise<void> {
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

  try {
    await submitBatchAction(wireReviews, batchKey)
    offlineQueue.confirmBatch()
  } catch {
    offlineQueue.replayBatch(reviews)
    offlineQueue.recordFailure()
  }
}

/**
 * Reactive view of the offline queue: count of pending entries and whether
 * the queue has hit the stuck threshold. `retryNow` and `discardPending`
 * back the buttons in the stuck-state banner.
 */
export interface OfflineQueueStatus {
  count:           number
  attempts:        number
  stuck:           boolean
  retryNow:        () => void
  discardPending:  () => void
}

interface QueueSnapshot {
  count:    number
  attempts: number
}

const SERVER_SNAPSHOT: QueueSnapshot = { count: 0, attempts: 0 }
let cachedSnapshot: QueueSnapshot = SERVER_SNAPSHOT

function getSnapshot(): QueueSnapshot {
  const next: QueueSnapshot = {
    count:    offlineQueue.size(),
    attempts: offlineQueue.attempts(),
  }
  // Stable identity — useSyncExternalStore re-renders only when reference changes.
  if (cachedSnapshot.count === next.count && cachedSnapshot.attempts === next.attempts) {
    return cachedSnapshot
  }
  cachedSnapshot = next
  return next
}

function getServerSnapshot(): QueueSnapshot {
  return SERVER_SNAPSHOT
}

export function useOfflineQueueStatus(): OfflineQueueStatus {
  const snapshot = useSyncExternalStore(
    (listener) => offlineQueue.subscribe(listener),
    getSnapshot,
    getServerSnapshot,
  )

  const retryNow = useCallback(() => {
    offlineQueue.resetAttempts()
    void runOfflineDrain()
  }, [])

  const discardPending = useCallback(() => {
    offlineQueue.clear()
  }, [])

  return {
    count:    snapshot.count,
    attempts: snapshot.attempts,
    stuck:    snapshot.attempts >= MAX_ATTEMPTS,
    retryNow,
    discardPending,
  }
}
