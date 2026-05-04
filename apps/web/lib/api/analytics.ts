'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { queryKeys } from './queryKeys'
import { staleTimes } from './config'
import {
  getHeatmapAction,
  getAccuracyAction,
  getStreakAction,
  getJlptGapAction,
  getMilestoneForecastAction,
  type HeatmapDay,
  type LayoutAccuracy,
  type StreakStats,
  type JlptGapRow,
  type MilestoneForecastRow,
} from '../actions/analytics.actions'

export function useHeatmapData(): UseQueryResult<HeatmapDay[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.heatmap(),
    queryFn:   getHeatmapAction,
    staleTime: staleTimes.analytics,
  })
}

export function useAccuracyByLayout(): UseQueryResult<LayoutAccuracy[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.accuracy(),
    queryFn:   getAccuracyAction,
    staleTime: staleTimes.analytics,
  })
}

export function useStreak(): UseQueryResult<StreakStats, Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.streak(),
    queryFn:   getStreakAction,
    staleTime: staleTimes.analytics,
  })
}

export function useJlptGap(): UseQueryResult<JlptGapRow[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.jlptGap(),
    queryFn:   getJlptGapAction,
    staleTime: staleTimes.analytics,
  })
}

export function useMilestoneForecast(): UseQueryResult<MilestoneForecastRow[], Error> {
  return useQuery({
    queryKey:  queryKeys.analytics.milestones(),
    queryFn:   getMilestoneForecastAction,
    staleTime: staleTimes.analytics,
  })
}
