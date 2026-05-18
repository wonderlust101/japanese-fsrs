'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  ApiLeechDrillAttempt,
  ApiLeechDrillSession,
  ApiLeechDrillSessionDetail,
  ApiLeechListItem,
  ApiLeechListResponse,
} from '@fsrs-japanese/shared-types'

import {
  abortDrillSessionAction,
  createDrillSessionAction,
  diagnoseLeechAction,
  finishDrillSessionAction,
  getDrillSessionAction,
  getLeechAction,
  listLeechesAction,
  recordDrillAttemptAction,
  reopenLeechAction,
  resolveLeechAction,
  type CreateDrillSessionInput,
  type ListLeechesOptions,
  type RecordDrillAttemptInput,
} from '../actions/leeches.actions'

import { staleTimes } from './config'
import { queryKeys }  from './queryKeys'

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Paginated leech list. The filter object is included in the cache key so
 * different filter combinations are fetched and cached independently. Stale
 * time matches analytics — the list is mutated by reviews (server side) and
 * resolve/reopen/diagnose (client side); all three invalidate via the
 * mutations below.
 */
export function useLeechesQuery(
  opts: ListLeechesOptions = {},
): UseQueryResult<ApiLeechListResponse, Error> {
  return useQuery({
    queryKey:  queryKeys.leeches.list(opts),
    queryFn:   () => listLeechesAction(opts),
    staleTime: staleTimes.analytics,
  })
}

/**
 * Single-leech detail query. `enabled` is gated on `id` so the dialog can
 * keep this hook mounted (one place to read from) while the user is not
 * inspecting any leech — the request only fires when an id is supplied.
 */
export function useLeechDetailQuery(
  id: string | null,
): UseQueryResult<ApiLeechListItem, Error> {
  return useQuery({
    queryKey: queryKeys.leeches.detail(id ?? '__none__'),
    queryFn:  () => {
      if (id === null) throw new Error('Leech id is required')
      return getLeechAction(id)
    },
    enabled:  id !== null,
  })
}

// ─── Derived signals ──────────────────────────────────────────────────────────

/**
 * Sidebar-friendly projection of the unresolved leech count. Wraps
 * `useLeechesQuery` with a fixed limit so the sidebar shares cache with any
 * other `status=unresolved` list view of the same shape.
 *
 * Returned shape:
 *   - `count`     : number of unresolved leeches the server returned (≤ 50).
 *   - `hasMore`   : true if the server signalled more pages exist; the sidebar
 *                   uses this to render a `50+` overflow chip rather than the
 *                   raw `count` (which would visually undercount).
 *   - `isLoading` : true on the very first hydration. Sidebar callers render
 *                   no badge during initial load — the chip is decoration,
 *                   not navigation, so a shimmer would be noise.
 *
 * Caps follow the spec: the count chip caps at 50 with a `+` overflow.
 */
export function useUnresolvedLeechCount(): {
  count:     number
  hasMore:   boolean
  isLoading: boolean
} {
  const query = useLeechesQuery({
    status: 'unresolved',
    limit:  50,
    sort:   'mostRecent',
  })
  return {
    count:     query.data?.items.length ?? 0,
    hasMore:   query.data?.hasMore      ?? false,
    isLoading: query.isLoading,
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * After every mutation, the cache invalidation set is intentionally narrow:
 * only the leeches namespace is touched. Analytics, decks, and review state
 * are unaffected by resolve/reopen/diagnose — the doc's "drill-only
 * mutations invalidate only the affected leech list/detail/session query
 * keys, not all review or analytics data" rule applies equally to these
 * lifecycle mutations.
 */
function invalidateLeeches(queryClient: ReturnType<typeof useQueryClient>): void {
  queryClient.invalidateQueries({ queryKey: queryKeys.leeches.all() })
}

export function useResolveLeechMutation(): UseMutationResult<
  ApiLeechListItem,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: resolveLeechAction,
    onSuccess:  (leech) => {
      queryClient.setQueryData(queryKeys.leeches.detail(leech.id), leech)
      invalidateLeeches(queryClient)
    },
  })
}

export function useReopenLeechMutation(): UseMutationResult<
  ApiLeechListItem,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reopenLeechAction,
    onSuccess:  (leech) => {
      queryClient.setQueryData(queryKeys.leeches.detail(leech.id), leech)
      invalidateLeeches(queryClient)
    },
  })
}

export function useDiagnoseLeechMutation(): UseMutationResult<
  ApiLeechListItem,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: diagnoseLeechAction,
    onSuccess:  (leech) => {
      queryClient.setQueryData(queryKeys.leeches.detail(leech.id), leech)
      invalidateLeeches(queryClient)
    },
  })
}

// ─── Drill (Phase 2) ──────────────────────────────────────────────────────────

/**
 * Start a drill session. The mutation does NOT invalidate the leech list
 * because creating a session has no effect on canonical FSRS state — the
 * doc's scheduler-invariance contract guarantees this. We invalidate only
 * the drill-session detail cache, which is empty pre-creation anyway.
 */
export function useCreateDrillSessionMutation(): UseMutationResult<
  ApiLeechDrillSession,
  Error,
  CreateDrillSessionInput
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createDrillSessionAction,
    onSuccess:  (session) => {
      queryClient.setQueryData(
        queryKeys.leeches.drillSession(session.sessionId),
        session,
      )
    },
  })
}

/**
 * Resume / refresh a drill session. Enabled-gated on the id so the same hook
 * mounts at the active session page and the summary page without firing a
 * request when no id is known yet.
 */
export function useDrillSessionQuery(
  sessionId: string | null,
): UseQueryResult<ApiLeechDrillSessionDetail, Error> {
  return useQuery({
    queryKey: queryKeys.leeches.drillSession(sessionId ?? '__none__'),
    queryFn:  () => {
      if (sessionId === null) throw new Error('Session id is required')
      return getDrillSessionAction(sessionId)
    },
    enabled:  sessionId !== null,
  })
}

interface RecordAttemptVariables {
  sessionId: string
  input:     RecordDrillAttemptInput
}

/**
 * Record a drill attempt. The `eventId` is the idempotency key — the
 * mutation is naturally retry-safe. We don't invalidate any queries because
 * attempt history is read from the local store, not from a server query;
 * the session detail query is only used for resume, not for per-attempt
 * progress tracking.
 */
export function useRecordDrillAttemptMutation(): UseMutationResult<
  ApiLeechDrillAttempt,
  Error,
  RecordAttemptVariables
> {
  return useMutation({
    mutationFn: ({ sessionId, input }) => recordDrillAttemptAction(sessionId, input),
  })
}

export function useFinishDrillSessionMutation(): UseMutationResult<
  ApiLeechDrillSessionDetail,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: finishDrillSessionAction,
    onSuccess:  (detail) => {
      queryClient.setQueryData(queryKeys.leeches.drillSession(detail.sessionId), detail)
    },
  })
}

export function useAbortDrillSessionMutation(): UseMutationResult<
  ApiLeechDrillSessionDetail,
  Error,
  string
> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: abortDrillSessionAction,
    onSuccess:  (detail) => {
      queryClient.setQueryData(queryKeys.leeches.drillSession(detail.sessionId), detail)
    },
  })
}
