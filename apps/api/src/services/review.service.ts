import { supabaseAdmin } from '../db/supabase.ts'
import { narrowRow, asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { processReviewBatch, type ProcessReviewResult } from './fsrs.service.ts'
import { toApiDueCard, type DueCardDbRow } from './card.service.ts'
import type { Profile } from './profile.service.ts'
import type {
  ApiDueCard,
  ApiForecastDay,
  ApiBatchResult,
  SessionSummary,
  SessionLeech,
  SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns the cards the user should review now, respecting their daily limits.
 *
 * Order: overdue non-new cards (learning/review/relearning) sorted by due ASC,
 * followed by new cards sorted by created_at ASC (oldest first — fifo).
 *
 * Cap logic:
 *   - Count today's total reviews from review_logs (reviewed_at >= UTC midnight).
 *   - Count today's new-card reviews (state_before = 0, i.e. FSRS New state).
 *   - Remaining total  = daily_review_limit    - totalReviewedToday
 *   - Remaining new    = daily_new_cards_limit - newReviewedToday
 *   - Overdue cards fill up to remainingTotal.
 *   - New cards fill up to min(remainingNew, remainingTotal - overdueCount).
 */
export async function getDueCards(userId: string, profile: Profile): Promise<ApiDueCard[]> {
  // Function name cast: database.types.ts is auto-generated and won't include
  // get_due_cards until `supabase gen types` runs post-deploy.
  const { data, error } = await supabaseAdmin.rpc(
    'get_due_cards' as never,
    asPayload({
      p_user_id:               userId,
      p_daily_review_limit:    profile.dailyReviewLimit,
      p_daily_new_cards_limit: profile.dailyNewCardsLimit,
    }),
  )

  if (error !== null) {
    throw dbError('fetch due cards', error)
  }

  return ((data ?? []) as DueCardDbRow[]).map(
    (row) => toApiDueCard(narrowRow<DueCardDbRow>(row)),
  )
}

/**
 * Returns the number of cards due per day for the next `days` days (default 14).
 * Days with zero due cards are omitted — the frontend fills those gaps as 0.
 *
 * Aggregation runs server-side via the get_review_forecast RPC. Bucketing
 * uses UTC calendar days, consistent with the heatmap and streak analytics.
 */
export async function getReviewForecast(userId: string, days = 14): Promise<ApiForecastDay[]> {
  const { data, error } = await supabaseAdmin.rpc('get_review_forecast', {
    p_user_id: userId,
    p_days:    days,
  })

  if (error !== null) {
    throw dbError('fetch review forecast', error)
  }

  // RPC returns rows shaped {date: TEXT, count: BIGINT}. BIGINT comes back as
  // a number in the JSON response (Supabase casts), but be defensive about it.
  interface ForecastRpcRow { date: string; count: number | string }
  const rows = narrowRow<ForecastRpcRow[]>(data ?? [])
  return rows.map((r) => ({
    date:  r.date,
    count: typeof r.count === 'string' ? Number.parseInt(r.count, 10) : r.count,
  }))
}

/**
 * Processes a batch of offline-buffered review submissions in a single
 * round-trip via the `process_review_batch` RPC. Per-review races on the
 * same card_id are still serialized — the RPC takes a row lock per card
 * before applying its update (matching `process_review`).
 *
 * Partial failures are collected in `errors` rather than aborting the
 * whole batch; preserves the existing wire contract.
 */
export async function submitBatch(
  reviews: SubmitReviewInput[],
  userId:  string,
): Promise<ApiBatchResult<ProcessReviewResult>> {
  return processReviewBatch(reviews, userId)
}

/**
 * Returns aggregate stats for all reviews that share the given session_id.
 *
 * Backed by the `get_session_summary` RPC, which collapses logs aggregation,
 * leech lookup, and card-detail enrichment into one round-trip and one
 * SQL transaction. Leeches are matched on `session_id` directly (added in
 * migration 20260509000001); pre-L2 leeches with NULL session_id are
 * excluded.
 */
export async function getSessionSummary(
  sessionId: string,
  userId:    string,
): Promise<SessionSummary> {
  interface SessionSummaryEnvelope {
    total:         number
    breakdown:     { again: number; hard: number; good: number; easy: number }
    total_time_ms: number
    next_due_at:   string | null
    leeches: Array<{
      leech_id:     string
      card_id:      string
      deck_id:      string | null
      word:         string | null
      reading:      string | null
      diagnosis:    string | null
      prescription: string | null
      resolved:     boolean
      created_at:   string
    }>
  }

  // Function name cast: database.types.ts is auto-generated and won't include
  // get_session_summary until `supabase gen types` runs post-deploy.
  const { data, error } = await supabaseAdmin.rpc(
    'get_session_summary' as never,
    asPayload({ p_session_id: sessionId, p_user_id: userId }),
  )

  if (error !== null) {
    if (error.code === '02000' || error.message.includes('session_not_found')) {
      throw new AppError(404, 'Session not found')
    }
    throw dbError('fetch session summary', error)
  }

  const env = narrowRow<SessionSummaryEnvelope>(data)

  const accuracyPct = env.total === 0
    ? 0
    : Math.round(((env.breakdown.good + env.breakdown.easy) / env.total) * 1000) / 10

  const leeches: SessionLeech[] = env.leeches.map((l) => ({
    leechId:      l.leech_id,
    cardId:       l.card_id,
    deckId:       l.deck_id   ?? '',
    word:         l.word      ?? '',
    reading:      l.reading   ?? null,
    diagnosis:    l.diagnosis ?? null,
    prescription: l.prescription ?? null,
    resolved:     l.resolved,
    createdAt:    l.created_at,
  }))

  return {
    sessionId,
    totalCards:      env.total,
    totalTimeMs:     env.total_time_ms,
    accuracyPct,
    nextDueAt:       env.next_due_at,
    ratingBreakdown: env.breakdown,
    leeches,
  }
}
