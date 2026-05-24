import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { readDueCache, writeDueCache } from '../lib/due-cache.ts'
import { normalizeTimeZone } from '../lib/timezone.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { processReviewBatch, type ProcessReviewResult } from './fsrs.service.ts'
import { toApiDueCard, DueCardRpcRowSchema } from './card.service.ts'
import type { Profile } from './profile.service.ts'
import type {
  ApiDueCard,
  ApiForecastDay,
  ApiBatchResult,
  ApiList,
  SessionSummary,
  SessionWeakSpot,
  SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

// ─── RPC envelope schemas ─────────────────────────────────────────────────────
// Module-level Zod schemas for the RPC return shapes consumed below. Mirrors
// the DashboardRpcEnvelopeSchema precedent in analytics.service.ts: parsed at
// runtime so any future shape drift surfaces as a clean ZodError.

const ForecastRpcRowSchema = z.object({
  date: z.string(),
  // BIGINT comes back as a string from PostgREST; INT comes back as a number.
  count:         z.union([z.string(), z.number()]),
  backlog_count: z.union([z.string(), z.number()]).optional(),
  review_count:  z.union([z.string(), z.number()]).optional(),
  new_count:     z.union([z.string(), z.number()]).optional(),
})

function toNumber(value: string | number | undefined): number {
  if (value === undefined) return 0
  return typeof value === 'string' ? Number.parseInt(value, 10) : value
}

/**
 * Session-summary RPC envelope. `card_id: z.string()` (non-null) is correct
 * only because `get_session_summary` filters `WHERE l.card_id IS NOT NULL` in
 * the weakSpots CTE (added in migration 20260519000000). If that filter ever
 * changes, this schema must be updated to mark `card_id: z.string().nullable()`.
 */
const SessionSummaryEnvelopeSchema = z.object({
  total:         z.number(),
  breakdown:     z.object({
    again: z.number(),
    hard:  z.number(),
    good:  z.number(),
    easy:  z.number(),
  }),
  total_time_ms: z.number(),
  next_due_at:   z.string().nullable(),
  // The RPC emits this key as `weak_spots` (snake_case, matching every
  // other envelope field). The leech→weak-spot rename in migration
  // 20260615000000 carried the SQL key over snake-cased; this schema
  // must match the wire literally.
  weak_spots: z.array(z.object({
    leech_id:     z.string(),
    card_id:      z.string(),
    deck_id:      z.string().nullable(),
    word:         z.string().nullable(),
    reading:      z.string().nullable(),
    // Nullable because the CTE LEFT JOINs `cards`; orphan weak spots
    // (parent card deleted) won't have a value. Added by migration
    // 20260626000000.
    lapses:       z.number().int().nonnegative().nullable(),
    diagnosis:    z.string().nullable(),
    prescription: z.string().nullable(),
    resolved:     z.boolean(),
    created_at:   z.string(),
  })),
  // Added by migration 20260628000000. Capped at 2 in the RPC so the
  // frontend can branch between "first session" and "returning" copy
  // without leaking the user's full history count.
  user_total_sessions: z.number().int().nonnegative(),
  // DISTINCT session_id count for the user-local day containing this
  // session. Drives the closure card's pluralized label.
  sessions_today:      z.number().int().nonnegative(),
})

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns the cards the user should review now, respecting their daily limits.
 *
 * Order: overdue non-new cards (learning/review/relearning) sorted by due ASC,
 * followed by new cards sorted by created_at ASC (oldest first — fifo).
 *
 * Cap logic:
 *   - Count today's total reviews from review_logs, starting at learner-local midnight.
 *   - Count today's new-card reviews (state_before = 0, i.e. FSRS New state).
 *   - Remaining total  = daily_review_limit    - totalReviewedToday
 *   - Remaining new    = daily_new_cards_limit - newReviewedToday
 *   - Overdue cards fill up to remainingTotal.
 *   - New cards fill up to min(remainingNew, remainingTotal - overdueCount).
 */
export async function getDueCards(
  userId:  string,
  profile: Profile,
): Promise<ApiList<ApiDueCard>> {
  // Cache short-circuit. 60s TTL caps any staleness from non-invalidating
  // mutation paths (deck archive, suspend, create/delete). The four FSRS
  // write paths (processReview, processReviewBatch, forgetCard,
  // rescheduleFromHistory) call `invalidateDueCache` explicitly so a user
  // who JUST rated a card doesn't see it again on the next fetch.
  const cached = await readDueCache<ApiDueCard>(userId)
  if (cached !== null) {
    return { items: cached.items, nextCursor: null, hasMore: cached.hasMore }
  }

  const timeZone = normalizeTimeZone(profile.timezone)
  const { data, error } = await supabaseAdmin.rpc(
    'get_due_cards',
    asPayload({
      p_user_id:               userId,
      p_daily_review_limit:    profile.dailyReviewLimit,
      p_daily_new_cards_limit: profile.dailyNewCardsLimit,
      p_timezone:              timeZone,
    }),
  )

  if (error !== null) {
    throw dbError('fetch due cards', error)
  }

  const rows  = z.array(DueCardRpcRowSchema).parse(data ?? [])
  const items = rows.map(toApiDueCard)
  // Bounded by FSRS daily caps; no cursor pagination.
  const payload: ApiList<ApiDueCard> = { items, nextCursor: null, hasMore: false }

  // Fire-and-forget write — a Redis hiccup must not delay the response.
  void writeDueCache<ApiDueCard>(userId, { items, nextCursor: null, hasMore: false })

  return payload
}

/**
 * Returns the number of cards due per day for the next `days` days (default 14),
 * split into overdue backlog, scheduled reviews, and actual new cards.
 * Days with zero due cards are omitted — the frontend fills those gaps as 0.
 *
 * Aggregation runs server-side via the get_review_forecast RPC. Bucketing
 * uses the learner's profile timezone so the forecast aligns with the
 * dashboard date, greeting, and daily caps.
 */
export async function getReviewForecast(
  userId:   string,
  profile:  Profile,
  days      = 14,
): Promise<ApiList<ApiForecastDay>> {
  const normalizedTimeZone = normalizeTimeZone(profile.timezone)
  const { data, error } = await supabaseAdmin.rpc('get_review_forecast', {
    p_user_id:               userId,
    p_days:                  days,
    p_timezone:              normalizedTimeZone,
    p_daily_review_limit:    profile.dailyReviewLimit,
    p_daily_new_cards_limit: profile.dailyNewCardsLimit,
  })

  if (error !== null) {
    throw dbError('fetch review forecast', error)
  }

  // RPC returns BIGINTs, which can serialize as either strings or numbers; the
  // schema accepts both and we normalize before crossing the API boundary.
  const rows  = z.array(ForecastRpcRowSchema).parse(data ?? [])
  const items = rows.map((r) => {
    const count = toNumber(r.count)
    const explicitSplit =
      r.backlog_count !== undefined ||
      r.review_count  !== undefined ||
      r.new_count     !== undefined

    return {
      date:         r.date,
      count,
      backlogCount: explicitSplit ? toNumber(r.backlog_count) : 0,
      reviewCount:  explicitSplit ? toNumber(r.review_count) : count,
      newCount:     explicitSplit ? toNumber(r.new_count) : 0,
    }
  })
  // Fixed forecast window (`days`); no cursor pagination.
  return { items, nextCursor: null, hasMore: false }
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
  opts?:   { signal?: AbortSignal | undefined },
): Promise<ApiBatchResult<ProcessReviewResult>> {
  return processReviewBatch(reviews, userId, opts)
}

/**
 * Returns aggregate stats for all reviews that share the given session_id.
 *
 * Backed by the `get_session_summary` RPC, which collapses logs aggregation,
 * weakSpot lookup, and card-detail enrichment into one round-trip and one
 * SQL transaction. WeakSpots are matched on `session_id` directly (added in
 * migration 20260509000001); pre-L2 weakSpots with NULL session_id are
 * excluded.
 */
export async function getSessionSummary(
  sessionId: string,
  userId:    string,
  profile:   Profile,
): Promise<SessionSummary> {
  const timeZone = normalizeTimeZone(profile.timezone)
  const { data, error } = await supabaseAdmin.rpc(
    'get_session_summary',
    asPayload({ p_session_id: sessionId, p_user_id: userId, p_timezone: timeZone }),
  )

  if (error !== null) {
    // PL/pgSQL's `no_data_found` raises with SQLSTATE `P0002`, not the
    // SQL-standard `02000` — the two are distinct condition codes that
    // share a name. Match both, plus the message text, so the 404 path
    // fires regardless of which one the runtime surfaces.
    const isSessionNotFound =
      (error.code === 'P0002' || error.code === '02000') ||
      error.message.includes('session_not_found')
    if (isSessionNotFound) {
      throw new AppError(404, 'Session not found', { code: 'SESSION_NOT_FOUND' })
    }
    throw dbError('fetch session summary', error)
  }

  const env = SessionSummaryEnvelopeSchema.parse(data)

  const accuracyPct = env.total === 0
    ? 0
    : Math.round(((env.breakdown.good + env.breakdown.easy) / env.total) * 1000) / 10

  const weakSpots: SessionWeakSpot[] = env.weak_spots.map((l) => ({
    weakSpotId:      l.leech_id,
    cardId:       l.card_id,
    deckId:       l.deck_id   ?? '',
    word:         l.word      ?? '',
    reading:      l.reading   ?? null,
    ...(l.lapses !== null && { lapses: l.lapses }),
    diagnosis:    l.diagnosis ?? null,
    prescription: l.prescription ?? null,
    resolved:     l.resolved,
    createdAt:    l.created_at,
  }))

  return {
    sessionId,
    totalCards:        env.total,
    totalTimeMs:       env.total_time_ms,
    accuracyPct,
    nextDueAt:         env.next_due_at,
    ratingBreakdown:   env.breakdown,
    weakSpots,
    userTotalSessions: env.user_total_sessions,
    sessionsToday:     env.sessions_today,
  }
}
