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
    },
  })
}
