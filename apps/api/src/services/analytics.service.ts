import { z } from 'zod'
import {
  ApiAnalyticsDashboardSchema,
  type ApiAnalyticsDashboard,
  type ApiHeatmapDay,
  type ApiJlptGap,
  type ApiLayoutAccuracy,
  type ApiList,
  type ApiMilestoneForecast,
} from '@fsrs-japanese/shared-types'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { normalizeTimeZone } from '../lib/timezone.ts'
import { dbError } from '../middleware/errorHandler.ts'
import {
  HeatmapRpcSchema,
  AccuracyRpcSchema,
  JlptGapRpcSchema,
  MilestoneForecastRpcSchema,
} from '../schemas/analytics.schema.ts'

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Wrap a fixed-dimension array (no real cursor pagination) in the universal list envelope. */
function bounded<T>(items: T[]): ApiList<T> {
  return { items, nextCursor: null, hasMore: false }
}

// ─── Bundled dashboard ────────────────────────────────────────────────────────

/**
 * Bundled response from the get_dashboard_data RPC. The RPC returns the four
 * analytics result sets in a single JSONB envelope (snake_case at the SQL
 * boundary), validated here, then reshaped into the camelCase wire format.
 *
 * Stage 8 dropped `streak` from this envelope when the legacy streak surface
 * was removed end-to-end. The migration `20260604000000_remove_legacy_streaks.sql`
 * matches the shape below: no `streak` key in the RPC's JSONB output.
 */
const DashboardRpcEnvelopeSchema = z.object({
  heatmap:    HeatmapRpcSchema,
  accuracy:   AccuracyRpcSchema,
  jlpt_gap:   JlptGapRpcSchema,
  milestones: MilestoneForecastRpcSchema,
  // Added 2026-05-18. Tz-aware month-to-date personal-card count.
  cards_added_this_month: z.coerce.number().int().nonnegative(),
})

/**
 * Bundles heatmap, accuracy, JLPT gap, and milestone forecast into one
 * round-trip via the get_dashboard_data RPC. Returns the same camelCase
 * shapes the granular endpoints return — clients can drop in seamlessly.
 */
export async function getDashboardData(userId: string, timeZone = 'UTC'): Promise<ApiAnalyticsDashboard> {
  const normalizedTimeZone = normalizeTimeZone(timeZone)
  const { data, error } = await supabaseAdmin.rpc(
    'get_dashboard_data',
    asPayload({ p_user_id: userId, p_timezone: normalizedTimeZone }),
  )

  if (error !== null) throw dbError('fetch dashboard data', error)

  const env = DashboardRpcEnvelopeSchema.parse(data)

  // Reshape each section to the camelCase wire format using the existing
  // mappers' field renames. A small amount of duplication here vs. calling
  // the granular service functions; trade-off is one round-trip not five.
  const heatmap: ApiHeatmapDay[] = env.heatmap.map((r) => ({
    date:         r.date,
    retention:    r.retention,
    count:        r.count,
    totalSeconds: r.total_seconds,
  }))

  const accuracy: ApiLayoutAccuracy[] = env.accuracy.map((r) => {
    const accuracyPct = r.total === 0 ? 0 : Math.round((r.successful / r.total) * 1000) / 10
    return { layoutType: r.layout_type, total: r.total, successful: r.successful, accuracyPct }
  })

  const jlptGap: ApiJlptGap[] = env.jlpt_gap.map((r) => {
    const progressPct = r.total === 0 ? 0 : Math.round((r.learned / r.total) * 1000) / 10
    return {
      jlptLevel:   r.jlpt_level,
      total:       r.total,
      learned:     r.learned,
      due:         r.due,
      progressPct,
    }
  })

  const milestones: ApiMilestoneForecast[] = env.milestones.map((r) => ({
    jlptLevel:               r.jlpt_level,
    total:                   r.total,
    learned:                 r.learned,
    dailyPace:               r.daily_pace ?? 0,
    daysRemaining:           r.days_remaining,
    projectedCompletionDate: r.projected_completion_date,
  }))

  // Final shape validation against the wire-format schema — guarantees the
  // output matches what the controller declares it returns. Each inner array
  // is wrapped in the universal list envelope; the dashboard itself is a
  // multi-key bundle (one round-trip carrying five sub-results).
  return ApiAnalyticsDashboardSchema.parse({
    heatmap:             bounded(heatmap),
    accuracy:            bounded(accuracy),
    jlptGap:             bounded(jlptGap),
    milestones:          bounded(milestones),
    cardsAddedThisMonth: env.cards_added_this_month,
  })
}
