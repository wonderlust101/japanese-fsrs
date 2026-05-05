'use server'

import type {
  ApiHeatmapDay,
  ApiLayoutAccuracy,
  ApiStreakStats,
  ApiJlptGap,
  ApiMilestoneForecast,
} from '@fsrs-japanese/shared-types'

import { apiCall, apiCallSafe } from '@/lib/api/client'

export async function getHeatmapAction(): Promise<ApiHeatmapDay[]> {
  return apiCall<ApiHeatmapDay[]>('/api/v1/analytics/heatmap', {}, 'Failed to fetch heatmap data')
}

export async function getAccuracyAction(): Promise<ApiLayoutAccuracy[]> {
  return apiCall<ApiLayoutAccuracy[]>('/api/v1/analytics/accuracy', {}, 'Failed to fetch accuracy data')
}

export async function getStreakAction(): Promise<ApiStreakStats> {
  return apiCallSafe<ApiStreakStats>(
    '/api/v1/analytics/streak',
    {},
    { currentStreak: 0, longestStreak: 0, lastReviewDate: null },
  )
}

export async function getJlptGapAction(): Promise<ApiJlptGap[]> {
  return apiCallSafe<ApiJlptGap[]>('/api/v1/analytics/jlpt-gap', {}, [])
}

export async function getMilestoneForecastAction(): Promise<ApiMilestoneForecast[]> {
  return apiCallSafe<ApiMilestoneForecast[]>('/api/v1/analytics/milestones', {}, [])
}
