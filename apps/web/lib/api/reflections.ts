'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiDayReflection } from '@fsrs-japanese/shared-types'

import { getDayReflectionAction } from '../actions/reflections.actions'

import { queryKeys } from './queryKeys'

// Day reflection is generated per (user, local-day, session-IDs fingerprint).
// Within a single client session the value is stable for the day, so a
// short stale window keeps the query from refetching during normal
// navigation while still letting a freshly-finished new session pick up
// the regenerated reflection on returning to the summary surface.
const FIVE_MIN_MS = 1000 * 60 * 5

interface UseDayReflectionOptions {
  /** Session id from the summary route. The hook is sessionId-scoped so
   *  multiple summary tabs for different sessions don't collide. */
  sessionId: string | null
  /** Gate the network call. Passes false until the parent summary payload
   *  resolves so the AI quota is only spent on real session views. */
  enabled:   boolean
}

export function useDayReflectionQuery(
  opts: UseDayReflectionOptions,
): UseQueryResult<ApiDayReflection | null, Error> {
  const safeId = opts.sessionId ?? ''
  return useQuery({
    queryKey:  queryKeys.reviews.dayReflection(safeId),
    queryFn:   () => getDayReflectionAction(safeId),
    enabled:   opts.enabled && opts.sessionId !== null,
    staleTime: FIVE_MIN_MS,
    gcTime:    FIVE_MIN_MS * 12,
    // Failures surface as null via apiCallSafe; no retry policy needed.
    retry: false,
  })
}
