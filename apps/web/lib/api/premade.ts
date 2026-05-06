'use client'

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'

import { queryKeys }  from './queryKeys'
import { staleTimes } from './config'
import {
  listPremadeDecksAction,
  listMySubscriptionsAction,
  subscribeToPremadeDeckAction,
  unsubscribeFromPremadeDeckAction,
} from '../actions/premade.actions'
import type {
  ApiPremadeDeck,
  ApiPremadeSubscription,
  ApiSubscribeResult,
} from '@fsrs-japanese/shared-types'

export function usePremadeDecks(): UseQueryResult<ApiPremadeDeck[], Error> {
  return useQuery({
    queryKey:  queryKeys.premadeDecks.list(),
    queryFn:   listPremadeDecksAction,
    staleTime: staleTimes.deckList,
  })
}

export function useMySubscriptions(): UseQueryResult<ApiPremadeSubscription[], Error> {
  return useQuery({
    queryKey:  queryKeys.premadeDecks.subscriptions(),
    queryFn:   listMySubscriptionsAction,
    staleTime: staleTimes.deckList,
  })
}

export function useSubscribeToPremadeDeck(): UseMutationResult<ApiSubscribeResult, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (premadeDeckId: string) => subscribeToPremadeDeckAction(premadeDeckId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.premadeDecks.subscriptions() })
      // Subscribing forks the premade and clones N cards (state=0). Those
      // cards belong in the review queue immediately; without these
      // invalidations the /review page keeps its stale (empty) snapshot
      // for the full 5-minute staleTime window.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })
}

export function useUnsubscribeFromPremadeDeck(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (premadeDeckId: string) => unsubscribeFromPremadeDeckAction(premadeDeckId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.premadeDecks.subscriptions() })
      // Unsubscribing cascade-deletes the user's forked cards — they must
      // disappear from the review queue immediately.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })
}
