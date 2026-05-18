'use server'

import {
  ApiHeatmapDaySchema,
  ApiLayoutAccuracySchema,
  ApiJlptGapSchema,
  ApiMilestoneForecastSchema,
  ApiAnalyticsDashboardSchema,
  apiListEnvelope,
  type ApiHeatmapDay,
  type ApiLayoutAccuracy,
  type ApiList,
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
  heatmap:             emptyList<ApiHeatmapDay>(),
  accuracy:            emptyList<ApiLayoutAccuracy>(),
  jlptGap:             emptyList<ApiJlptGap>(),
  milestones:          emptyList<ApiMilestoneForecast>(),
  cardsAddedThisMonth: 0,
}

/**
 * Bundled fetch for the analytics page — collapses 4 prior round-trips
 * (heatmap + accuracy + jlpt-gap + milestones) into one request.
 */
export async function getDashboardAction(): Promise<ApiAnalyticsDashboard> {
  return apiCallSafe<ApiAnalyticsDashboard>(
    '/api/v1/analytics/dashboard',
    ApiAnalyticsDashboardSchema,
    {},
    dashboardFallback,
  )
}
