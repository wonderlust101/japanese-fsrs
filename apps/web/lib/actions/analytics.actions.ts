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
