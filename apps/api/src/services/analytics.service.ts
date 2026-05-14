import { z } from 'zod'
import type { ZodType } from 'zod'
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
import type { Database } from '../db/database.types.ts'
import { asPayload } from '../lib/db.ts'
import { normalizeTimeZone } from '../lib/timezone.ts'
import { dbError } from '../middleware/errorHandler.ts'
import {
  HeatmapRpcSchema,
  AccuracyRpcSchema,
  JlptGapRpcSchema,
  MilestoneForecastRpcSchema,
} from '../schemas/analytics.schema.ts'

type RpcName = keyof Database['public']['Functions'] & string

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Calls a Supabase RPC, validates the result through a Zod schema, and surfaces
 * Postgres / Zod errors as AppError so the global error handler can format them.
 */
async function callRpc<T>(
  fn:     RpcName,
  params: Record<string, unknown>,
  schema: ZodType<T>,
  label:  string,
): Promise<T> {
  const { data, error } = await supabaseAdmin.rpc(fn, asPayload(params))
  if (error !== null) throw dbError(`fetch ${label}`, error)
  return schema.parse(data ?? [])
}

// ─── Service functions ────────────────────────────────────────────────────────

/** Wrap a fixed-dimension array (no real cursor pagination) in the universal list envelope. */
function bounded<T>(items: T[]): ApiList<T> {
  return { items, nextCursor: null, hasMore: false }
}

/**
 * Returns daily retention rates for the last 365 learner-local days.
 *
 * Days with zero reviews are omitted from the result — the frontend fills those
 * gaps as 0, consistent with the forecast data pattern.
 */
export async function getHeatmapData(userId: string, timeZone = 'UTC'): Promise<ApiList<ApiHeatmapDay>> {
  const normalizedTimeZone = normalizeTimeZone(timeZone)
  const rows = await callRpc(
    'get_heatmap_data',
    { p_user_id: userId, p_timezone: normalizedTimeZone },
    HeatmapRpcSchema,
    'heatmap data',
  )
  return bounded(rows)
}

/**
 * Returns review accuracy broken down by layout (cognitive modality).
 *
 * Groups all of the user's review history by card_type
 * (comprehension | production | listening). accuracyPct is the percentage of
 * reviews rated "good" or "easy".
 */
export async function getAccuracyByLayout(userId: string): Promise<ApiList<ApiLayoutAccuracy>> {
  const rows  = await callRpc('get_accuracy_by_layout', { p_user_id: userId }, AccuracyRpcSchema, 'accuracy breakdown')
  const items = rows.map((r) => {
    const accuracyPct = r.total === 0 ? 0 : Math.round((r.successful / r.total) * 1000) / 10
    return { layout: r.layout, total: r.total, successful: r.successful, accuracyPct }
  })
  return bounded(items)
}

/**
 * Returns per-JLPT-level totals plus learned and due counts. progressPct is
 * computed in the service layer so the RPC stays focused on aggregation.
 */
export async function getJlptGap(userId: string): Promise<ApiList<ApiJlptGap>> {
  const rows  = await callRpc('get_jlpt_gap', { p_user_id: userId }, JlptGapRpcSchema, 'JLPT gap')
  const items = rows.map((r) => {
    const progressPct = r.total === 0 ? 0 : Math.round((r.learned / r.total) * 1000) / 10
    return {
      jlptLevel:   r.jlpt_level,
      total:       r.total,
      learned:     r.learned,
      due:         r.due,
      progressPct,
    }
  })
  return bounded(items)
}

/**
 * Returns per-JLPT-level milestone projections based on the user's daily pace
 * over the last 30 days. Levels with no projectable data return
 * `daysRemaining = null` and `projectedCompletionDate = null`.
 */
export async function getMilestoneForecast(userId: string): Promise<ApiList<ApiMilestoneForecast>> {
  const rows = await callRpc(
    'get_milestone_forecast',
    { p_user_id: userId },
    MilestoneForecastRpcSchema,
    'milestone forecast',
  )
  const items = rows.map((r) => ({
    jlptLevel:               r.jlpt_level,
    total:                   r.total,
    learned:                 r.learned,
    dailyPace:               r.daily_pace ?? 0,
    daysRemaining:           r.days_remaining,
    projectedCompletionDate: r.projected_completion_date,
  }))
  return bounded(items)
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
    date:      r.date,
    retention: r.retention,
    count:     r.count,
  }))

  const accuracy: ApiLayoutAccuracy[] = env.accuracy.map((r) => {
    const accuracyPct = r.total === 0 ? 0 : Math.round((r.successful / r.total) * 1000) / 10
    return { layout: r.layout, total: r.total, successful: r.successful, accuracyPct }
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
    heatmap:    bounded(heatmap),
    accuracy:   bounded(accuracy),
    jlptGap:    bounded(jlptGap),
    milestones: bounded(milestones),
  })
}
