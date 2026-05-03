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
