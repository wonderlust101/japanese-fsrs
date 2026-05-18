'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiMaturitySnapshot } from '@fsrs-japanese/shared-types'

import { queryKeys } from './queryKeys'
import { staleTimes } from './config'
import {
  getMaturityHistoryAction,
  type MaturityHistoryWindow,
} from '../actions/insights.actions'

/**
 * Backend Completion Plan Stage 9 — `GET /api/v1/insights/maturity-history`.
 * Reuses the analytics staleTime (1h) because the snapshot table is updated
 * by a daily cron; the live "today" row is computed on every server call so
 * the chart reflects the current moment without needing a tighter staleTime.
 */
export function useMaturityHistory(
  days: MaturityHistoryWindow = '90',
): UseQueryResult<ReadonlyArray<ApiMaturitySnapshot>, Error> {
  return useQuery({
    queryKey:  queryKeys.insights.maturityHistory(days),
    queryFn:   () => getMaturityHistoryAction(days),
    staleTime: staleTimes.analytics,
  })
}
