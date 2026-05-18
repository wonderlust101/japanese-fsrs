'use server'

import {
  ApiAnalyticsDashboardSchema,
  type ApiHeatmapDay,
  type ApiLayoutAccuracy,
  type ApiList,
  type ApiJlptGap,
  type ApiMilestoneForecast,
  type ApiAnalyticsDashboard,
} from '@fsrs-japanese/shared-types'

import { apiCallSafe } from '@/lib/api/client'

const emptyList = <T>(): ApiList<T> => ({ items: [], nextCursor: null, hasMore: false })

const dashboardFallback: ApiAnalyticsDashboard = {
  heatmap:             emptyList<ApiHeatmapDay>(),
  accuracy:            emptyList<ApiLayoutAccuracy>(),
  jlptGap:             emptyList<ApiJlptGap>(),
  milestones:          emptyList<ApiMilestoneForecast>(),
  cardsAddedThisMonth: 0,
}

/**
 * Bundled fetch for the analytics page — collapses 4 prior round-trips
 * (heatmap + accuracy + jlpt-gap + milestones) into one request. The
 * granular fetch actions were retired in the dead-code sweep; this is the
 * only path the client takes today.
 */
export async function getDashboardAction(): Promise<ApiAnalyticsDashboard> {
  return apiCallSafe<ApiAnalyticsDashboard>(
    '/api/v1/analytics/dashboard',
    ApiAnalyticsDashboardSchema,
    {},
    dashboardFallback,
  )
}
