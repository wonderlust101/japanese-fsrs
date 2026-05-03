import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import { processReview, type ProcessReviewResult } from './fsrs.service.ts'
import { CARD_COLUMNS, toCardRow, type CardRow } from './card.service.ts'
import type { Profile } from './profile.service.ts'
import type { SubmitReviewInput } from '../schemas/review.schema.ts'

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
    throw new AppError(500, `Failed to count today's reviews: ${totalResult.error.message}`)
  }
  if (newResult.error !== null) {
    throw new AppError(500, `Failed to count today's new reviews: ${newResult.error.message}`)
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
    throw new AppError(500, `Failed to fetch due cards: ${overdueError.message}`)
  }

  const overdueCards = (overdueData ?? []).map(
    (row) => toCardRow(row as unknown as Record<string, unknown>),
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
    throw new AppError(500, `Failed to fetch new cards: ${newError.message}`)
  }

  const newCards = (newData ?? []).map(
    (row) => toCardRow(row as unknown as Record<string, unknown>),
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
    throw new AppError(500, `Failed to fetch review forecast: ${error.message}`)
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
