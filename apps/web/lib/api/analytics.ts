'use client'

import { useQuery } from '@tanstack/react-query'

import { queryKeys }                           from './queryKeys'
import { staleTimes }                          from './config'
import { getHeatmapAction, getAccuracyAction } from '../actions/analytics.actions'

export function useHeatmapData() {
  return useQuery({
    queryKey:  queryKeys.analytics.heatmap(),
    queryFn:   getHeatmapAction,
    staleTime: staleTimes.analytics,
  })
}

export function useAccuracyByLayout() {
  return useQuery({
    queryKey:  queryKeys.analytics.accuracy(),
    queryFn:   getAccuracyAction,
    staleTime: staleTimes.analytics,
  })
}
