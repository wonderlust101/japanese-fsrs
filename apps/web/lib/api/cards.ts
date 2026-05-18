'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import type {
  ApiBulkCardMutationResult,
  ApiCard,
  ApiCardQualityIssue,
} from '@fsrs-japanese/shared-types'

import {
  bulkDeleteCardsAction,
  bulkMoveCardsAction,
  bulkSuspendCardsAction,
  bulkTagCardsAction,
  bulkUnsuspendCardsAction,
  copyCardAction,
  deleteCardAction,
  listCardsCrossDeckAction,
  moveCardAction,
  suspendCardAction,
  unsuspendCardAction,
  type CrossDeckCardsActionOptions,
  type CrossDeckListResult,
} from '../actions/cards.actions'
import { getCardQualityIssuesAction } from '../actions/insights.actions'

import { staleTimes } from './config'
import { queryKeys }  from './queryKeys'

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Cross-deck card-browser list. The filter object is part of the cache key
 * so each (deck/status/jlpt/search/missingField/sort) combination caches
 * independently. `apiCallSafe` keeps the action graceful: auth/5xx returns
 * the empty page rather than throwing, so the table renders an empty state
 * instead of an error.
 */
export function useCardsCrossDeckQuery(
  opts: CrossDeckCardsActionOptions = {},
): UseQueryResult<CrossDeckListResult, Error> {
  return useQuery({
    queryKey:  queryKeys.cards.crossDeck(opts),
    queryFn:   () => listCardsCrossDeckAction(opts),
    staleTime: staleTimes.cardsList,
  })
}

/**
 * Card-health summary for the /cards quality-bars panel. Six rows
 * `{ issueType, count }` keyed off the backend's enum — `CardsQualityBars`
 * maps them to its display labels at render time.
 */
export function useCardQualityIssuesQuery(): UseQueryResult<ReadonlyArray<ApiCardQualityIssue>, Error> {
  return useQuery({
    queryKey:  queryKeys.cards.qualityIssues(),
    queryFn:   () => getCardQualityIssuesAction(),
    staleTime: staleTimes.analytics,
  })
}

// ─── Single-card mutations ────────────────────────────────────────────────────

/** Invalidates every cards.* cache + the affected decks' rollups. */
function useCardCachesInvalidator(): () => Promise<void> {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() }),
    ])
  }
}

export function useDeleteCardMutation(): UseMutationResult<void, Error, string> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (cardId: string) => deleteCardAction(cardId),
    onSuccess:  () => invalidate(),
  })
}

export interface MoveCardVariables { cardId: string; targetDeckId: string }
export function useMoveCardMutation(): UseMutationResult<ApiCard, Error, MoveCardVariables> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (v) => moveCardAction(v.cardId, v.targetDeckId),
    onSuccess:  () => invalidate(),
  })
}

export function useCopyCardMutation(): UseMutationResult<ApiCard, Error, MoveCardVariables> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (v) => copyCardAction(v.cardId, v.targetDeckId),
    onSuccess:  () => invalidate(),
  })
}

export function useSuspendCardMutation(): UseMutationResult<ApiCard, Error, string> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (cardId: string) => suspendCardAction(cardId),
    onSuccess:  () => invalidate(),
  })
}

export function useUnsuspendCardMutation(): UseMutationResult<ApiCard, Error, string> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (cardId: string) => unsuspendCardAction(cardId),
    onSuccess:  () => invalidate(),
  })
}

// ─── Bulk mutations ───────────────────────────────────────────────────────────

export interface BulkMoveVariables { ids: readonly string[]; targetDeckId: string }
export function useBulkMoveCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, BulkMoveVariables> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (v) => bulkMoveCardsAction(v.ids, v.targetDeckId),
    onSuccess:  () => invalidate(),
  })
}

export function useBulkSuspendCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (ids: readonly string[]) => bulkSuspendCardsAction(ids),
    onSuccess:  () => invalidate(),
  })
}

export function useBulkUnsuspendCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (ids: readonly string[]) => bulkUnsuspendCardsAction(ids),
    onSuccess:  () => invalidate(),
  })
}

export function useBulkDeleteCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (ids: readonly string[]) => bulkDeleteCardsAction(ids),
    onSuccess:  () => invalidate(),
  })
}

export interface BulkTagVariables {
  ids:         readonly string[]
  addTags?:    readonly string[]
  removeTags?: readonly string[]
}
export function useBulkTagCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, BulkTagVariables> {
  const invalidate = useCardCachesInvalidator()
  return useMutation({
    mutationFn: (v) => bulkTagCardsAction(v.ids, {
      ...(v.addTags    !== undefined ? { addTags:    v.addTags }    : {}),
      ...(v.removeTags !== undefined ? { removeTags: v.removeTags } : {}),
    }),
    onSuccess:  () => invalidate(),
  })
}
