'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  ApiLeechListItem,
  ApiLeechListResponse,
} from '@fsrs-japanese/shared-types'

import {
  diagnoseLeechAction,
  getLeechAction,
  listLeechesAction,
  reopenLeechAction,
  resolveLeechAction,
  type ListLeechesOptions,
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
