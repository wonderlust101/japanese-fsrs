'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiDeck, ApiList } from '@fsrs-japanese/shared-types'

import { listDecksAction } from '../actions/decks.actions'
import { queryKeys } from './queryKeys'

export function useDecks(limit = 8): UseQueryResult<ApiList<ApiDeck>, Error> {
  return useQuery({
    queryKey:  [...queryKeys.decks.list(), { limit }] as const,
    queryFn:   () => listDecksAction({ limit }),
    staleTime: 1000 * 60 * 5,
  })
}
