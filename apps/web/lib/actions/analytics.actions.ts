'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'

export interface HeatmapDay {
  date:      string  // YYYY-MM-DD (UTC)
  retention: number  // 0–100, one decimal place
  count:     number  // total reviews that day
}

export interface LayoutAccuracy {
  layout:      string  // comprehension | production | listening
  total:       number
  successful:  number
  accuracyPct: number  // 0–100, one decimal place
}

export interface StreakStats {
  currentStreak:  number
  longestStreak:  number
  lastReviewDate: string | null
}

export interface JlptGapRow {
  jlptLevel:   string
  total:       number
  learned:     number
  due:         number
  progressPct: number
}

export interface MilestoneForecastRow {
  jlptLevel:                string
  total:                    number
  learned:                  number
  dailyPace:                number
  daysRemaining:            number | null
  projectedCompletionDate:  string | null
}

export async function getHeatmapAction(): Promise<HeatmapDay[]> {
  return apiCall<HeatmapDay[]>('/api/v1/analytics/heatmap', {}, 'Failed to fetch heatmap data')
}

export async function getAccuracyAction(): Promise<LayoutAccuracy[]> {
  return apiCall<LayoutAccuracy[]>('/api/v1/analytics/accuracy', {}, 'Failed to fetch accuracy data')
}

export async function getStreakAction(): Promise<StreakStats> {
  return apiCallSafe<StreakStats>(
    '/api/v1/analytics/streak',
    {},
    { currentStreak: 0, longestStreak: 0, lastReviewDate: null },
  )
}

export async function getJlptGapAction(): Promise<JlptGapRow[]> {
  return apiCallSafe<JlptGapRow[]>('/api/v1/analytics/jlpt-gap', {}, [])
}

export async function getMilestoneForecastAction(): Promise<MilestoneForecastRow[]> {
  return apiCallSafe<MilestoneForecastRow[]>('/api/v1/analytics/milestones', {}, [])
}
