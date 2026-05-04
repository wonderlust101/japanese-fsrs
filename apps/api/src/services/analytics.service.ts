import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface HeatmapDay {
  date:      string  // YYYY-MM-DD (UTC)
  retention: number  // 0–100, one decimal place
  count:     number  // total reviews that day
}

export interface LayoutAccuracy {
  layout:      string  // comprehension | production | listening
  total:       number
  successful:  number  // good + easy ratings
  accuracyPct: number  // 0–100, one decimal place
}

export interface StreakStats {
  currentStreak:   number
  longestStreak:   number
  lastReviewDate:  string | null  // YYYY-MM-DD or null if no reviews
}

export interface JlptGapRow {
  jlptLevel:    string
  total:        number
  learned:      number
  due:          number
  progressPct:  number  // 0–100, one decimal place
}

export interface MilestoneForecastRow {
  jlptLevel:                 string
  total:                     number
  learned:                   number
  dailyPace:                 number
  daysRemaining:             number | null
  projectedCompletionDate:   string | null  // YYYY-MM-DD or null if no projection
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns daily retention rates for the last 365 days.
 *
 * Days with zero reviews are omitted from the result — the frontend fills those
 * gaps as 0, consistent with the forecast data pattern.
 *
 * @param userId - Authenticated user's ID
 */
export async function getHeatmapData(userId: string): Promise<HeatmapDay[]> {
  const { data, error } = await supabaseAdmin.rpc('get_heatmap_data', {
    p_user_id: userId,
  })

  if (error !== null) {
    throw new AppError(500, `Failed to fetch heatmap data: ${error.message}`)
  }

  return (data ?? []).map((row: unknown) => {
    const r = row as { date: string; retention: number; count: number }
    return {
      date:      r.date,
      retention: Number(r.retention),
      count:     Number(r.count),
    }
  })
}

/**
 * Returns review accuracy broken down by layout (cognitive modality).
 *
 * Groups all of the user's review history by card_type
 * (comprehension | production | listening). accuracyPct is the percentage of
 * reviews rated "good" or "easy".
 *
 * @param userId - Authenticated user's ID
 */
export async function getAccuracyByLayout(userId: string): Promise<LayoutAccuracy[]> {
  const { data, error } = await supabaseAdmin.rpc('get_accuracy_by_layout', {
    p_user_id: userId,
  })

  if (error !== null) {
    throw new AppError(500, `Failed to fetch accuracy breakdown: ${error.message}`)
  }

  return (data ?? []).map((row: unknown) => {
    const r          = row as { layout: string; total: number; successful: number }
    const total      = Number(r.total)
    const successful = Number(r.successful)
    const accuracyPct = total === 0
      ? 0
      : Math.round((successful / total) * 1000) / 10
    return { layout: r.layout, total, successful, accuracyPct }
  })
}

/**
 * Returns the user's current and longest review streak plus their last review date.
 * Uses UTC calendar days. Empty history → `{ 0, 0, null }`.
 */
export async function getStreak(userId: string): Promise<StreakStats> {
  const { data, error } = await supabaseAdmin.rpc('get_streak', { p_user_id: userId })

  if (error !== null) {
    throw new AppError(500, `Failed to fetch streak: ${error.message}`)
  }

  const row = (data ?? [])[0] as
    | { current_streak: number; longest_streak: number; last_review_date: string | null }
    | undefined

  if (row === undefined) {
    return { currentStreak: 0, longestStreak: 0, lastReviewDate: null }
  }

  return {
    currentStreak:  Number(row.current_streak ?? 0),
    longestStreak:  Number(row.longest_streak ?? 0),
    lastReviewDate: row.last_review_date ?? null,
  }
}

/**
 * Returns per-JLPT-level totals plus learned and due counts. progressPct is
 * computed in the service layer so the RPC stays focused on aggregation.
 */
export async function getJlptGap(userId: string): Promise<JlptGapRow[]> {
  const { data, error } = await supabaseAdmin.rpc('get_jlpt_gap', { p_user_id: userId })

  if (error !== null) {
    throw new AppError(500, `Failed to fetch JLPT gap: ${error.message}`)
  }

  return (data ?? []).map((row: unknown) => {
    const r       = row as { jlpt_level: string; total: number; learned: number; due: number }
    const total   = Number(r.total)
    const learned = Number(r.learned)
    const progressPct = total === 0
      ? 0
      : Math.round((learned / total) * 1000) / 10
    return {
      jlptLevel: r.jlpt_level,
      total,
      learned,
      due:       Number(r.due),
      progressPct,
    }
  })
}

/**
 * Returns per-JLPT-level milestone projections based on the user's daily pace
 * over the last 30 days. Levels with no projectable data return
 * `daysRemaining = null` and `projectedCompletionDate = null`.
 */
export async function getMilestoneForecast(userId: string): Promise<MilestoneForecastRow[]> {
  const { data, error } = await supabaseAdmin.rpc('get_milestone_forecast', { p_user_id: userId })

  if (error !== null) {
    throw new AppError(500, `Failed to fetch milestone forecast: ${error.message}`)
  }

  return (data ?? []).map((row: unknown) => {
    const r = row as {
      jlpt_level:                string
      total:                     number
      learned:                   number
      daily_pace:                number | string | null
      days_remaining:            number | null
      projected_completion_date: string | null
    }
    return {
      jlptLevel:               r.jlpt_level,
      total:                   Number(r.total),
      learned:                 Number(r.learned),
      dailyPace:               r.daily_pace === null ? 0 : Number(r.daily_pace),
      daysRemaining:           r.days_remaining === null ? null : Number(r.days_remaining),
      projectedCompletionDate: r.projected_completion_date,
    }
  })
}
