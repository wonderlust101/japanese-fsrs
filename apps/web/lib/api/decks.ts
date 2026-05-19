'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  ApiCopyDeckResult,
  ApiDeck,
  ApiList,
} from '@fsrs-japanese/shared-types'

import {
  archiveDeckAction,
  copyDeckAction,
  listDecksAction,
  unarchiveDeckAction,
  type DeckListView,
} from '../actions/decks.actions'
import { queryKeys } from './queryKeys'

/**
 * Lists decks for the current user. The optional `view` is forwarded to the
 * server (migration 20260622000000_deck_archive.sql): `'active'` (default)
 * hides archived decks, `'archived'` shows only archived, `'all'` returns
 * both. The query key includes the view so cache entries don't bleed across
 * tabs.
 */
export function useDecks(
  limit: number = 8,
  view:  DeckListView = 'active',
): UseQueryResult<ApiList<ApiDeck>, Error> {
  return useQuery({
    queryKey:  [...queryKeys.decks.list(), { limit, view }] as const,
    queryFn:   () => listDecksAction({ limit, view }),
    staleTime: 1000 * 60 * 5,
  })
}

/**
 * POST /api/v1/decks/:id/copy. On success invalidates `decks.list` (the new
 * deck's cards are state=0 and due now) plus the review queues so the
 * forecast + due-strip pick the new inventory up immediately. Mirrors the
 * cache-busting pattern in `useCopyPremadeDeck`.
 */
export function useCopyDeck(): UseMutationResult<ApiCopyDeckResult, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deckId: string) => copyDeckAction(deckId),
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })
}

/**
 * POST /api/v1/decks/:id/archive. Archive freezes the deck (write paths gate
 * via `assertDeckActive`) and excludes its cards from `/reviews/due`,
 * `/reviews/forecast`, and drill selection. The endpoint is idempotent —
 * archiving an already-archived deck preserves the original timestamp.
 *
 * Cache scope: list + reviews queues (same rationale as copy). Forecast is
 * invalidated because archived-deck cards are now excluded from the daily
 * projection (migration 20260623000000_archive_aware_forecast_and_drill.sql).
 */
export function useArchiveDeck(): UseMutationResult<ApiDeck, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deckId: string) => archiveDeckAction(deckId),
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })
}

/** POST /api/v1/decks/:id/unarchive. Inverse of `useArchiveDeck`. */
export function useUnarchiveDeck(): UseMutationResult<ApiDeck, Error, string> {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (deckId: string) => unarchiveDeckAction(deckId),
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })
}
