import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import {
  ApiCardQualityIssueTypeSchema,
  type ApiAnswerRatingDistribution,
  type ApiHistogramBucket,
  type ApiInsightsDistributions,
  type ApiList,
  type ApiCardQualityIssue,
  type ApiMaturitySnapshot,
  type ApiMaturityHistoryDaysSchema,
} from '@fsrs-japanese/shared-types'

type MaturityHistoryDays = z.infer<typeof ApiMaturityHistoryDaysSchema>

// ─── Stage 8 — card-quality issue counts ─────────────────────────────────────

const CardQualityIssueRpcRowSchema = z.object({
  // Mirrors the RPC's TEXT column. The Zod enum at the API boundary narrows
  // this back to the wire-format enum, so an unknown value from a future
  // RPC drift surfaces as a clean ZodError instead of leaking through.
  issue_type: ApiCardQualityIssueTypeSchema,
  count:      z.number().int().nonnegative(),
})

/**
 * Backend Completion Plan Stage 8. Returns one row per known issue type
 * (six total), with the count of the user's vocabulary+grammar cards
 * exhibiting that issue. Sentence-layout cards are excluded server-side.
 *
 * The contract guarantees all six issue types are present in every
 * response, even when every count is zero — the SQL `LATERAL VALUES`
 * unpivot emits them unconditionally, so frontend consumers can iterate
 * a stable shape without conditionally handling missing keys.
 *
 * `missing_picture` and `missing_nuance` are zero today on most rows
 * (the AI generator path under Stage 2 produces `nuance` only, and
 * `picture` requires an asset-hosting story that hasn't shipped). The
 * counts will populate naturally as generated content lands; no service
 * change required.
 */
export async function listCardQualityIssues(
  userId: string,
): Promise<ApiList<ApiCardQualityIssue>> {
  const { data, error } = await supabaseAdmin.rpc('get_card_quality_issues', asPayload({
    p_user_id: userId,
  }))

  if (error !== null) {
    throw dbError('list card-quality issues', error)
  }

  const rows = z.array(CardQualityIssueRpcRowSchema).parse(data ?? [])
  const items: ApiCardQualityIssue[] = rows.map((r) => ({
    issueType: r.issue_type,
    count:     r.count,
  }))

  return { items, nextCursor: null, hasMore: false }
}

// ─── Stage 9 — maturity-pipeline history ─────────────────────────────────────

const MaturitySnapshotRpcRowSchema = z.object({
  // Postgres returns DATE as an ISO YYYY-MM-DD string over the supabase-js
  // wire. The RPC's "today" row is computed in the learner's timezone.
  snapshot_date:    z.string(),
  new_count:        z.number().int().nonnegative(),
  learning_count:   z.number().int().nonnegative(),
  review_count:     z.number().int().nonnegative(),
  relearning_count: z.number().int().nonnegative(),
  mature_count:     z.number().int().nonnegative(),
  // Optional + default 0 so the API parses cleanly whether or not migration
  // 20260701000000 (which adds suspended_count to the RPC) has been applied
  // to the target DB yet. Pre-migration rows simply read 0; post-migration
  // they carry the live tally. Avoids a deploy-order ZodError → 400.
  suspended_count:  z.number().int().nonnegative().optional().default(0),
})

/**
 * Backend Completion Plan Stage 9. Returns up to `days` rows of per-state
 * card counts, one per learner-local day. Historical rows come from the
 * `card_state_snapshots` table; today's row is always computed live from
 * `cards` so the chart reflects the current moment between cron runs.
 *
 * The `days` enum is the shared wire-format enum ('90' | '180' | '365');
 * the RPC takes an int, so we parse here. The Zod layer at the controller
 * rejects unknown enum values first; the RPC's SQLSTATE 22023 guard is
 * defence in depth for direct-SQL callers.
 *
 * A user with no reviews and no cards still gets a non-empty response —
 * the live `today` row is always emitted, with zeros across every count.
 * Historical rows may be sparse until the daily cron has run for several
 * days; that's expected per the plan ("a user with no reviews still gets
 * a sparse history").
 */
export async function listMaturityHistory(
  userId: string,
  days:   MaturityHistoryDays,
): Promise<ApiList<ApiMaturitySnapshot>> {
  const daysInt = Number.parseInt(days, 10)
  const { data, error } = await supabaseAdmin.rpc('get_maturity_pipeline_history', asPayload({
    p_user_id: userId,
    p_days:    daysInt,
  }))

  if (error !== null) {
    if (error.code === '22023' && error.message.includes('invalid_days_parameter')) {
      throw new AppError(400, 'Unknown maturity-history window', {
        code: 'MATURITY_HISTORY_DAYS_INVALID',
      })
    }
    throw dbError('list maturity-pipeline history', error)
  }

  const rows  = z.array(MaturitySnapshotRpcRowSchema).parse(data ?? [])
  const items: ApiMaturitySnapshot[] = rows.map((r) => ({
    date:            r.snapshot_date,
    newCount:        r.new_count,
    learningCount:   r.learning_count,
    reviewCount:     r.review_count,
    relearningCount: r.relearning_count,
    matureCount:     r.mature_count,
    suspendedCount:  r.suspended_count,
  }))

  return { items, nextCursor: null, hasMore: false }
}

// ─── Statistics distributions ────────────────────────────────────────────────
//
// Bundle four small histograms behind one round-trip. The frontend uses a
// single React Query cache entry; the SQL side issues four parallel RPC
// calls in `Promise.all` because they're independent reads.

const RatingDistributionRpcRowSchema = z.object({
  rating: z.enum(['again', 'hard', 'good', 'easy']),
  count:  z.number().int().nonnegative(),
})

const HistogramBucketRpcRowSchema = z.object({
  bucket:    z.string(),
  // The interval/stability/difficulty RPCs carry a numeric `sort_key` so
  // the row order is stable even if the planner re-orders the underlying
  // LATERAL VALUES (it shouldn't, but the explicit ORDER BY in the RPC
  // depends on this column). We don't surface it on the wire.
  sort_key:  z.number().int().positive(),
  count:     z.number().int().nonnegative(),
})

function ratingRowsToDistribution(
  rows: ReadonlyArray<z.infer<typeof RatingDistributionRpcRowSchema>>,
): ApiAnswerRatingDistribution {
  const out: ApiAnswerRatingDistribution = { again: 0, hard: 0, good: 0, easy: 0 }
  for (const row of rows) out[row.rating] = row.count
  return out
}

function histogramRowsToBuckets(
  rows: ReadonlyArray<z.infer<typeof HistogramBucketRpcRowSchema>>,
): ApiHistogramBucket[] {
  return rows.map((r) => ({ label: r.bucket, count: r.count }))
}

export async function getDistributions(
  userId: string,
): Promise<ApiInsightsDistributions> {
  const [ratingResult, intervalResult, stabilityResult, difficultyResult] = await Promise.all([
    supabaseAdmin.rpc('get_answer_rating_distribution', asPayload({ p_user_id: userId })),
    supabaseAdmin.rpc('get_interval_distribution',      asPayload({ p_user_id: userId })),
    supabaseAdmin.rpc('get_stability_distribution',     asPayload({ p_user_id: userId })),
    supabaseAdmin.rpc('get_difficulty_distribution',    asPayload({ p_user_id: userId })),
  ])

  if (ratingResult.error !== null)     throw dbError('get rating distribution',     ratingResult.error)
  if (intervalResult.error !== null)   throw dbError('get interval distribution',   intervalResult.error)
  if (stabilityResult.error !== null)  throw dbError('get stability distribution',  stabilityResult.error)
  if (difficultyResult.error !== null) throw dbError('get difficulty distribution', difficultyResult.error)

  return {
    ratings:    ratingRowsToDistribution(
      z.array(RatingDistributionRpcRowSchema).parse(ratingResult.data ?? []),
    ),
    intervals:  histogramRowsToBuckets(
      z.array(HistogramBucketRpcRowSchema).parse(intervalResult.data ?? []),
    ),
    stability:  histogramRowsToBuckets(
      z.array(HistogramBucketRpcRowSchema).parse(stabilityResult.data ?? []),
    ),
    difficulty: histogramRowsToBuckets(
      z.array(HistogramBucketRpcRowSchema).parse(difficultyResult.data ?? []),
    ),
  }
}

// ─── Tz-aware cards-added-this-month (Progress page summary tile) ───────────

export async function getCardsAddedThisMonth(
  userId:   string,
  timezone: string,
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('get_cards_added_this_month', asPayload({
    p_user_id:  userId,
    p_timezone: timezone,
  }))
  if (error !== null) throw dbError('get cards added this month', error)
  return z.number().int().nonnegative().parse(data ?? 0)
}
