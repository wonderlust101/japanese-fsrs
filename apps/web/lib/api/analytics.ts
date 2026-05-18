'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { ApiAnalyticsDashboard } from '@fsrs-japanese/shared-types'

import { queryKeys } from './queryKeys'
import { staleTimes } from './config'
import { getDashboardAction } from '../actions/analytics.actions'

/**
 * Bundled fetch for the analytics page — combines heatmap, accuracy, JLPT
 * gap, and milestone forecast into a single round-trip. Every live caller
 * uses this hook; the granular variants were retired in the dead-code
 * sweep because no surface needed partial refresh.
 */
export function useAnalyticsDashboard(): UseQueryResult<ApiAnalyticsDashboard, Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.dashboard(),
    queryFn:   getDashboardAction,
    staleTime: staleTimes.analytics,
  })
}
