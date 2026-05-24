'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import type {
  ApiDeck,
  ApiInsightsDistributions,
  ApiList,
  ApiMaturitySnapshot,
} from '@fsrs-japanese/shared-types'

import {
  getInsightsDistributionsStrictAction,
  getMaturityHistoryStrictAction,
  type MaturityHistoryWindow,
} from '@/lib/actions/insights.actions'
import { listDecksStrictAction } from '@/lib/actions/decks.actions'

/**
 * Statistics-only query hooks that surface real errors. They call the throwing
 * (strict) action variants and use statistics-scoped keys so they never clash
 * with the fail-open shared caches used elsewhere (today, overview, decks
 * browser). This is the contained way to give the deep-dive a "couldn't load,
 * retry" state without changing app-wide resilience.
 */

const STALE = 1000 * 60 * 5

export function useStatisticsDistributions(): UseQueryResult<ApiInsightsDistributions, Error> {
  return useQuery({
    queryKey:  ['statistics', 'distributions'],
    queryFn:   getInsightsDistributionsStrictAction,
    staleTime: STALE,
  })
}

export function useStatisticsMaturityHistory(
  days: MaturityHistoryWindow = '90',
): UseQueryResult<ReadonlyArray<ApiMaturitySnapshot>, Error> {
  return useQuery({
    queryKey:  ['statistics', 'maturity-history', days],
    queryFn:   () => getMaturityHistoryStrictAction(days),
    staleTime: STALE,
  })
}

export function useStatisticsDecks(
  limit = 50,
): UseQueryResult<ApiList<ApiDeck>, Error> {
  return useQuery({
    queryKey:  ['statistics', 'decks', limit],
    queryFn:   () => listDecksStrictAction({ limit }),
    staleTime: STALE,
  })
}
