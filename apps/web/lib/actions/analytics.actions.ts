'use server'

import {
  ApiHeatmapDaySchema,
  ApiLayoutAccuracySchema,
  ApiStreakStatsSchema,
  ApiJlptGapSchema,
  ApiMilestoneForecastSchema,
  ApiAnalyticsDashboardSchema,
  apiListEnvelope,
  type ApiHeatmapDay,
  type ApiLayoutAccuracy,
  type ApiList,
  type ApiStreakStats,
  type ApiJlptGap,
  type ApiMilestoneForecast,
  type ApiAnalyticsDashboard,
} from '@fsrs-japanese/shared-types'

import { apiCall, apiCallSafe } from '@/lib/api/client'

const emptyList = <T>(): ApiList<T> => ({ items: [], nextCursor: null, hasMore: false })

export async function getHeatmapAction(): Promise<ApiList<ApiHeatmapDay>> {
  return apiCall<ApiList<ApiHeatmapDay>>(
    '/api/v1/analytics/heatmap',
    apiListEnvelope(ApiHeatmapDaySchema),
    {},
    'Failed to fetch heatmap data',
  )
}

export async function getAccuracyAction(): Promise<ApiList<ApiLayoutAccuracy>> {
  return apiCall<ApiList<ApiLayoutAccuracy>>(
    '/api/v1/analytics/accuracy',
    apiListEnvelope(ApiLayoutAccuracySchema),
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

export async function getJlptGapAction(): Promise<ApiList<ApiJlptGap>> {
  return apiCallSafe<ApiList<ApiJlptGap>>(
    '/api/v1/analytics/jlpt-gap',
    apiListEnvelope(ApiJlptGapSchema),
    {},
    emptyList<ApiJlptGap>(),
  )
}

export async function getMilestoneForecastAction(): Promise<ApiList<ApiMilestoneForecast>> {
  return apiCallSafe<ApiList<ApiMilestoneForecast>>(
    '/api/v1/analytics/milestones',
    apiListEnvelope(ApiMilestoneForecastSchema),
    {},
    emptyList<ApiMilestoneForecast>(),
  )
}

const dashboardFallback: ApiAnalyticsDashboard = {
  heatmap:    emptyList<ApiHeatmapDay>(),
  accuracy:   emptyList<ApiLayoutAccuracy>(),
  streak:     { currentStreak: 0, longestStreak: 0, lastReviewDate: null },
  jlptGap:    emptyList<ApiJlptGap>(),
  milestones: emptyList<ApiMilestoneForecast>(),
}

/**
 * Bundled fetch for the analytics page — collapses 5 prior round-trips
 * (heatmap + accuracy + streak + jlpt-gap + milestones) into one request.
 */
export async function getDashboardAction(): Promise<ApiAnalyticsDashboard> {
  return apiCallSafe<ApiAnalyticsDashboard>(
    '/api/v1/analytics/dashboard',
    ApiAnalyticsDashboardSchema,
    {},
    dashboardFallback,
  )
}
