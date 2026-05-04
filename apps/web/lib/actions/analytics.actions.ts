'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

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

export async function getHeatmapAction(): Promise<HeatmapDay[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/analytics/heatmap`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to fetch heatmap data')
  }
  return res.json() as Promise<HeatmapDay[]>
}

export async function getAccuracyAction(): Promise<LayoutAccuracy[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/analytics/accuracy`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to fetch accuracy data')
  }
  return res.json() as Promise<LayoutAccuracy[]>
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

async function getJSON<T>(path: string, fallback: T): Promise<T> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return fallback

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache:   'no-store',
  })
  if (!res.ok) return fallback
  return res.json() as Promise<T>
}

export async function getStreakAction(): Promise<StreakStats> {
  return getJSON<StreakStats>('/api/v1/analytics/streak', {
    currentStreak: 0, longestStreak: 0, lastReviewDate: null,
  })
}

export async function getJlptGapAction(): Promise<JlptGapRow[]> {
  return getJSON<JlptGapRow[]>('/api/v1/analytics/jlpt-gap', [])
}

export async function getMilestoneForecastAction(): Promise<MilestoneForecastRow[]> {
  return getJSON<MilestoneForecastRow[]>('/api/v1/analytics/milestones', [])
}
