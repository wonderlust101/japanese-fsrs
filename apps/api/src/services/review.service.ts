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
 * Leeches are matched by card_id + a time window anchored to the session's
 * reviewed_at range. A 5-second buffer is added to the upper bound because
 * leech rows are written inside the same DB transaction as the review log,
 * but their created_at may differ by a few milliseconds due to statement
 * ordering within the transaction.
 */
export async function getSessionSummary(
  sessionId: string,
  userId:    string,
): Promise<SessionSummary> {
  interface SessionLogRow {
    card_id:        string
    rating:         string
    review_time_ms: number | null
    reviewed_at:    string
    due_after:      string
  }
  const { data: logsData, error: logsError } = await supabaseAdmin
    .from('review_logs')
    .select('card_id, rating, review_time_ms, reviewed_at, due_after')
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (logsError !== null) {
    throw dbError('fetch session logs', logsError)
  }
  if (logsData === null || logsData.length === 0) {
    throw new AppError(404, 'Session not found')
  }
  const logs = narrowRow<SessionLogRow[]>(logsData)

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  const breakdown = { again: 0, hard: 0, good: 0, easy: 0 }
  let totalTimeMs = 0

  for (const log of logs) {
    if (log.rating in breakdown) breakdown[log.rating as keyof typeof breakdown]++
    totalTimeMs += log.review_time_ms ?? 0
  }

  const total      = logs.length
  const accuracyPct = total === 0
    ? 0
    : Math.round(((breakdown.good + breakdown.easy) / total) * 1000) / 10

  // Earliest scheduled due date across all cards reviewed in this session.
  // ISO string sort is lexicographically correct for TIMESTAMPTZ values.
  const nextDueAt = logs.length > 0
    ? (logs.map((l) => l.due_after).sort()[0] ?? null)
    : null

  // ── Leech lookup ─────────────────────────────────────────────────────────────
  // Match leeches on session_id directly (added in migration 20260509000001).
  // Pre-L2 leeches with session_id IS NULL are intentionally excluded — the
  // prior time-window heuristic was unreliable under clock skew or batch
  // submissions, and pre-existing leeches without session_id can't be
  // retroactively assigned to a session anyway.
  interface LeechRow {
    id:           string
    card_id:      string
    diagnosis:    string | null
    prescription: string | null
    resolved:     boolean
    created_at:   string
  }
  const { data: leechData, error: leechError } = await supabaseAdmin
    .from('leeches')
    .select('id, card_id, diagnosis, prescription, resolved, created_at')
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (leechError !== null) {
    throw dbError('fetch session leeches', leechError)
  }
  const leechRows = narrowRow<LeechRow[]>(leechData ?? [])

  // Enrich leech rows with card display data (word, reading) and deckId for linking.
  const cardDataMap = new Map<string, { deckId: string; word: string; reading: string | null }>()

  if (leechRows.length > 0) {
    const leechCardIds = leechRows.map((l) => l.card_id)

    interface LeechCardRow { id: string; deck_id: string; fields_data: Record<string, unknown> }
    const { data: cardData, error: cardError } = await supabaseAdmin
      .from('cards')
      .select('id, deck_id, fields_data')
      .in('id', leechCardIds)

    if (cardError !== null) {
      throw dbError('fetch card data for leeches', cardError)
    }

    for (const c of narrowRow<LeechCardRow[]>(cardData ?? [])) {
      const word    = typeof c.fields_data['word']    === 'string' ? c.fields_data['word']    : ''
      const reading = typeof c.fields_data['reading'] === 'string' ? c.fields_data['reading'] : null
      cardDataMap.set(c.id, { deckId: c.deck_id, word, reading })
    }
  }

  const leeches: SessionLeech[] = leechRows.map((l) => {
    const card = cardDataMap.get(l.card_id)
    return {
      leechId:      l.id,
      cardId:       l.card_id,
      deckId:       card?.deckId  ?? '',
      word:         card?.word    ?? '',
      reading:      card?.reading ?? null,
      diagnosis:    l.diagnosis    ?? null,
      prescription: l.prescription ?? null,
      resolved:     l.resolved,
      createdAt:    l.created_at,
    }
  })

  return {
    sessionId,
    totalCards: total,
    totalTimeMs,
    accuracyPct,
    nextDueAt,
    ratingBreakdown: breakdown,
    leeches,
  }
}
