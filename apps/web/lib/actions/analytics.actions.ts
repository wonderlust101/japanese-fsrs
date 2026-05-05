'use server'

import { z } from 'zod'

import {
  ApiHeatmapDaySchema,
  ApiLayoutAccuracySchema,
  ApiStreakStatsSchema,
  ApiJlptGapSchema,
  ApiMilestoneForecastSchema,
  type ApiHeatmapDay,
  type ApiLayoutAccuracy,
  type ApiStreakStats,
  type ApiJlptGap,
  type ApiMilestoneForecast,
} from '@fsrs-japanese/shared-types'

import { apiCall, apiCallSafe } from '@/lib/api/client'

export async function getHeatmapAction(): Promise<ApiHeatmapDay[]> {
  return apiCall<ApiHeatmapDay[]>(
    '/api/v1/analytics/heatmap',
    z.array(ApiHeatmapDaySchema),
    {},
    'Failed to fetch heatmap data',
  )
}

export async function getAccuracyAction(): Promise<ApiLayoutAccuracy[]> {
  return apiCall<ApiLayoutAccuracy[]>(
    '/api/v1/analytics/accuracy',
    z.array(ApiLayoutAccuracySchema),
    {},
    'Failed to fetch accuracy data',
  )
}

export async function getStreakAction(): Promise<ApiStreakStats> {
  return apiCallSafe<ApiStreakStats>(
    '/api/v1/analytics/streak',
    ApiStreakStatsSchema,
    {},
    { currentStreak: 0, longestStreak: 0, lastReviewDate: null },
  )
}

export async function getJlptGapAction(): Promise<ApiJlptGap[]> {
  return apiCallSafe<ApiJlptGap[]>('/api/v1/analytics/jlpt-gap', z.array(ApiJlptGapSchema), {}, [])
}

export async function getMilestoneForecastAction(): Promise<ApiMilestoneForecast[]> {
  return apiCallSafe<ApiMilestoneForecast[]>(
    '/api/v1/analytics/milestones',
    z.array(ApiMilestoneForecastSchema),
    {},
    [],
  )
}
