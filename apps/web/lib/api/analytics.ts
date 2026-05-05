'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  ApiHeatmapDay,
  ApiLayoutAccuracy,
  ApiStreakStats,
  ApiJlptGap,
  ApiMilestoneForecast,
} from '@fsrs-japanese/shared-types'

import { queryKeys } from './queryKeys'
import { staleTimes } from './config'
import {
  getHeatmapAction,
  getAccuracyAction,
  getStreakAction,
  getJlptGapAction,
  getMilestoneForecastAction,
} from '../actions/analytics.actions'

export function useHeatmapData(): UseQueryResult<ApiHeatmapDay[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.heatmap(),
    queryFn:   getHeatmapAction,
    staleTime: staleTimes.analytics,
  })
}

export function useAccuracyByLayout(): UseQueryResult<ApiLayoutAccuracy[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.accuracy(),
    queryFn:   getAccuracyAction,
    staleTime: staleTimes.analytics,
  })
}

export function useStreak(): UseQueryResult<ApiStreakStats, Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.streak(),
    queryFn:   getStreakAction,
    staleTime: staleTimes.analytics,
  })
}

export function useJlptGap(): UseQueryResult<ApiJlptGap[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.jlptGap(),
    queryFn:   getJlptGapAction,
    staleTime: staleTimes.analytics,
  })
}

export function useMilestoneForecast(): UseQueryResult<ApiMilestoneForecast[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.milestones(),
    queryFn:   getMilestoneForecastAction,
    staleTime: staleTimes.analytics,
  })
}
