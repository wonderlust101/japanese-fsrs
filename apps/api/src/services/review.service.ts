import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { processReview, type ProcessReviewResult } from './fsrs.service.ts'
import { CARD_COLUMNS, toCardRow, type CardRow, type CardDbRow } from './card.service.ts'
import type { Profile } from './profile.service.ts'
import type { SubmitReviewInput } from '../schemas/review.schema.ts'
import type { SessionSummary, SessionLeech } from '@fsrs-japanese/shared-types'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ForecastDay {
  date:  string  // YYYY-MM-DD
  count: number
}

export interface BatchResult {
  results: ProcessReviewResult[]
  errors:  Array<{ cardId: string; error: string }>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns UTC midnight of the current day as an ISO string. */
function startOfTodayISO(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

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
export async function getDueCards(userId: string, profile: Profile): Promise<CardRow[]> {
  const todayISO = startOfTodayISO()

  // ── Count today's reviews ──────────────────────────────────────────────────
  const [totalResult, newResult] = await Promise.all([
    supabaseAdmin
      .from('review_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('reviewed_at', todayISO),
    supabaseAdmin
      .from('review_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('state_before', 0)
      .gte('reviewed_at', todayISO),
  ])

  if (totalResult.error !== null) {
    throw dbError("count today's reviews", totalResult.error)
  }
  if (newResult.error !== null) {
    throw dbError("count today's new reviews", newResult.error)
  }

  const totalReviewedToday = totalResult.count ?? 0
  const newReviewedToday   = newResult.count   ?? 0

  const remainingTotal = Math.max(0, profile.daily_review_limit    - totalReviewedToday)
  const remainingNew   = Math.max(0, profile.daily_new_cards_limit - newReviewedToday)

  if (remainingTotal === 0) return []

  // ── Fetch overdue non-new cards ────────────────────────────────────────────
  const now = new Date().toISOString()

  const { data: overdueData, error: overdueError } = await supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('user_id', userId)
    .in('status', ['learning', 'review', 'relearning'])
    .lte('due', now)
    .order('due', { ascending: true })
    .limit(remainingTotal)

  if (overdueError !== null) {
    throw dbError('fetch due cards', overdueError)
  }

  const overdueCards = (overdueData ?? []).map(
    (row) => toCardRow(row as unknown as CardDbRow),
  )

  // ── Fetch new cards ────────────────────────────────────────────────────────
  const newSlots = Math.min(remainingNew, remainingTotal - overdueCards.length)

  if (newSlots <= 0) return overdueCards

  const { data: newData, error: newError } = await supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'new')
    .order('created_at', { ascending: true })
    .limit(newSlots)

  if (newError !== null) {
    throw dbError('fetch new cards', newError)
  }

  const newCards = (newData ?? []).map(
    (row) => toCardRow(row as unknown as CardDbRow),
  )

  return [...overdueCards, ...newCards]
}

/**
 * Returns the number of cards due per day for the next `days` days (default 14).
 * Days with zero due cards are omitted — the frontend fills those gaps as 0.
 */
export async function getReviewForecast(userId: string, days = 14): Promise<ForecastDay[]> {
  const todayISO     = new Date().toISOString().slice(0, 10)
  const windowEnd    = new Date()
  windowEnd.setUTCDate(windowEnd.getUTCDate() + days)
  const windowEndISO = windowEnd.toISOString()

  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('due')
    .eq('user_id', userId)
    .neq('status', 'suspended')
    .gte('due', todayISO)
    .lt('due', windowEndISO)

  if (error !== null) {
    throw dbError('fetch review forecast', error)
  }

  // Group by YYYY-MM-DD in TypeScript — avoids a new DB migration for GROUP BY.
  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const date = (row as { due: string }).due.slice(0, 10)
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

/**
 * Processes a batch of offline-buffered review submissions sequentially.
 *
 * Sequential (not parallel) to avoid race conditions when the same card
 * appears more than once in the batch. Partial failures are collected in
 * `errors` rather than aborting the whole batch.
 */
export async function submitBatch(
  reviews: SubmitReviewInput[],
  userId:  string,
): Promise<BatchResult> {
  const results: ProcessReviewResult[]              = []
  const errors:  Array<{ cardId: string; error: string }> = []

  for (const review of reviews) {
    try {
      const result = await processReview(
        review.cardId,
        review.rating,
        userId,
        review.reviewTimeMs,
        review.sessionId,
      )
      results.push(result)
    } catch (err) {
      errors.push({
        cardId: review.cardId,
        error:  err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return { results, errors }
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
  const { data: logs, error: logsError } = await supabaseAdmin
    .from('review_logs')
    .select('card_id, rating, review_time_ms, reviewed_at, due_after')
    .eq('session_id', sessionId)
    .eq('user_id', userId)

  if (logsError !== null) {
    throw dbError('fetch session logs', logsError)
  }
  if (logs === null || logs.length === 0) {
    throw new AppError(404, 'Session not found')
  }

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  const breakdown = { again: 0, hard: 0, good: 0, easy: 0 }
  let totalTimeMs = 0

  for (const log of logs) {
    const rating = log.rating as keyof typeof breakdown
    if (rating in breakdown) breakdown[rating]++
    totalTimeMs += (log.review_time_ms as number | null) ?? 0
  }

  const total      = logs.length
  const accuracyPct = total === 0
    ? 0
    : Math.round(((breakdown.good + breakdown.easy) / total) * 1000) / 10

  // Earliest scheduled due date across all cards reviewed in this session.
  // ISO string sort is lexicographically correct for TIMESTAMPTZ values.
  const nextDueAt = logs.length > 0
    ? (logs.map((l) => l.due_after as string).sort()[0] ?? null)
    : null

  // ── Leech lookup ─────────────────────────────────────────────────────────────
  const cardIds = [...new Set(logs.map((l) => l.card_id as string))]

  const reviewedAts = logs.map((l) => new Date(l.reviewed_at as string).getTime())
  const minReviewedAt = new Date(Math.min(...reviewedAts)).toISOString()
  const maxReviewedAtMs = Math.max(...reviewedAts)
  const maxReviewedAt = new Date(maxReviewedAtMs + 5_000).toISOString()

  const { data: leechRows, error: leechError } = await supabaseAdmin
    .from('leeches')
    .select('id, card_id, diagnosis, prescription, resolved, created_at')
    .in('card_id', cardIds)
    .eq('user_id', userId)
    .gte('created_at', minReviewedAt)
    .lte('created_at', maxReviewedAt)

  if (leechError !== null) {
    throw dbError('fetch session leeches', leechError)
  }

  // Enrich leech rows with card display data (word, reading) and deckId for linking.
  const cardDataMap = new Map<string, { deckId: string; word: string; reading: string | null }>()

  if ((leechRows ?? []).length > 0) {
    const leechCardIds = (leechRows ?? []).map((l) => l.card_id as string)

    const { data: cardRows, error: cardError } = await supabaseAdmin
      .from('cards')
      .select('id, deck_id, fields_data')
      .in('id', leechCardIds)

    if (cardError !== null) {
      throw dbError('fetch card data for leeches', cardError)
    }

    for (const c of cardRows ?? []) {
      const fields = c.fields_data as Record<string, unknown>
      cardDataMap.set(c.id as string, {
        deckId:  c.deck_id as string,
        word:    (fields['word']    as string)        ?? '',
        reading: (fields['reading'] as string | null) ?? null,
      })
    }
  }

  const leeches: SessionLeech[] = (leechRows ?? []).map((l) => {
    const card = cardDataMap.get(l.card_id as string)
    return {
      leechId:      l.id as string,
      cardId:       l.card_id as string,
      deckId:       card?.deckId  ?? '',
      word:         card?.word    ?? '',
      reading:      card?.reading ?? null,
      diagnosis:    (l.diagnosis    as string | null) ?? null,
      prescription: (l.prescription as string | null) ?? null,
      resolved:     l.resolved as boolean,
      createdAt:    l.created_at as string,
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
