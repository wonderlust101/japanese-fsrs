import { createHash } from 'node:crypto'
import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { componentLogger } from '../lib/logger.ts'
import { normalizeTimeZone } from '../lib/timezone.ts'
import { asPayload } from '../lib/db.ts'
import { AppError, ServiceUnavailableError } from '../middleware/errorHandler.ts'
import { generateDayReflection } from './ai.service.ts'
import {
  assertNever,
  classifySession,
  type ApiDayReflection,
} from '@fsrs-japanese/shared-types'

const log = componentLogger('day-reflection.service')

// Envelope returned by the `get_day_review_aggregate` RPC (migration
// 20260627000000). Locked to a Zod schema at the service boundary so any
// drift from the SQL surfaces as a clean parse error rather than a runtime
// undefined in the prompt assembly.
const AggregateEnvelopeSchema = z.object({
  date_key:        z.string(),
  session_ids:     z.array(z.string()),
  session_count:   z.number().int().nonnegative(),
  total_cards:     z.number().int().nonnegative(),
  total_time_ms:   z.number().int().nonnegative(),
  breakdown: z.object({
    again: z.number().int().nonnegative(),
    hard:  z.number().int().nonnegative(),
    good:  z.number().int().nonnegative(),
    easy:  z.number().int().nonnegative(),
  }),
  weak_spot_words: z.array(z.string()),
})

const ProfileRowSchema = z.object({
  timezone:        z.string(),
  jlpt_target:     z.string().nullable(),
  native_language: z.string(),
})

/**
 * SHA-256 fingerprint of the day's session-ID set, sorted for determinism.
 * The cache key in the AI generator includes this fingerprint, so adding a
 * new session to the day naturally invalidates the previous cache entry
 * and triggers a fresh generation that incorporates the new session's data.
 */
function fingerprintSessions(sessionIds: readonly string[]): string {
  const sorted = [...sessionIds].sort()
  return createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 12)
}

/**
 * Rule-based fallback prose used when the AI generator is unavailable
 * (breaker open, missing key, empty response, schema drift, …). Delegates
 * pattern classification to the shared `classifySession` so the backend
 * fallback and the frontend's rule-based prose can never disagree on
 * which pattern a given metric shape produces. The per-pattern prose
 * lookup below stays terse on purpose — fallback copy doesn't need the
 * longer rationale the UI's `summary-pattern.ts` carries.
 */
function ruleBasedReflection(args: {
  totalCards:    number
  accuracyPct:   number
  again:         number
  hard:          number
  good:          number
  easy:          number
  weakSpotCount: number
}): string {
  const pattern = classifySession({
    totalCards:  args.totalCards,
    accuracyPct: args.accuracyPct,
    again:       args.again,
    hard:        args.hard,
    good:        args.good,
    easy:        args.easy,
    leechCount:  args.weakSpotCount,
    endedEarly:  false,
  })
  switch (pattern) {
    case 'no-pattern':  return 'Short session today. Not enough cards to call a pattern.'
    case 'weakSpot':    return 'A handful of cards keep slipping. They look like weak spots.'
    case 'difficult':   return 'Recall sat lower than usual. A short focused drill will help.'
    case 'strong':      return 'No clear weak spot today.'
    case 'ended-early': return 'A short stop is fine; the rough spots will come back around.'
    case 'mixed':       return 'A few rough spots, nothing alarming.'
    default:            return assertNever(pattern)
  }
}

/**
 * Returns one Tomo-voice reflection over the user's review work for the
 * local calendar day that contains the given session. Aggregates ALL
 * sessions on that date; regenerates whenever a new session is added
 * (the session-IDs fingerprint changes → cache miss).
 *
 * Failure modes:
 *   - Profile missing → 404 PROFILE_NOT_FOUND
 *   - Session missing → 404 SESSION_NOT_FOUND
 *   - AI breaker open / key missing / empty / Zod failure → returns the
 *     `source: 'fallback'` rule-based prose. The endpoint never surfaces
 *     a 5xx for content-availability reasons — the Session details card
 *     must always have a body to render.
 */
export async function getDayReflection(
  sessionId: string,
  userId:    string,
): Promise<ApiDayReflection> {
  // 1) Load profile (timezone, JLPT target, native language).
  const { data: profileData, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('timezone, jlpt_target, native_language')
    .eq('id', userId)
    .single()
  if (profileError !== null || profileData === null) {
    throw new AppError(404, 'Profile not found', { code: 'PROFILE_NOT_FOUND' })
  }
  const profile  = ProfileRowSchema.parse(profileData)
  const timeZone = normalizeTimeZone(profile.timezone)

  // 2) Aggregate the day's review work via the new RPC. SECURITY DEFINER +
  //    user-bound filters inside the function; the service-role key here
  //    is the standard pattern for `get_*` RPCs.
  const { data, error } = await supabaseAdmin.rpc(
    'get_day_review_aggregate',
    asPayload({
      p_session_id: sessionId,
      p_user_id:    userId,
      p_timezone:   timeZone,
    }),
  )
  if (error !== null) {
    const isSessionNotFound =
      error.code === 'P0002' || error.code === '02000' ||
      error.message.includes('session_not_found')
    if (isSessionNotFound) {
      throw new AppError(404, 'Session not found', { code: 'SESSION_NOT_FOUND' })
    }
    log.error({ userId, sessionId, err: { code: error.code, message: error.message } },
      'get_day_review_aggregate failed')
    throw new AppError(500, 'Failed to load day aggregate', { code: 'DAY_AGGREGATE_FAILED' })
  }
  const agg = AggregateEnvelopeSchema.parse(data)

  const accuracyPct = agg.total_cards === 0
    ? 0
    : Math.round(((agg.breakdown.good + agg.breakdown.easy) / agg.total_cards) * 1000) / 10

  // 3) AI generation with fallback. The catch surfaces an explicit
  //    `source: 'fallback'` so the UI can subtly indicate provenance.
  try {
    const generated = await generateDayReflection({
      userId,
      dateKey:        agg.date_key,
      fingerprint:    fingerprintSessions(agg.session_ids),
      userLevel:      profile.jlpt_target ?? 'N5',
      nativeLanguage: profile.native_language,
      totalCards:     agg.total_cards,
      totalTimeMs:    agg.total_time_ms,
      accuracyPct,
      breakdown:      agg.breakdown,
      sessionCount:   agg.session_count,
      weakSpotWords:  agg.weak_spot_words,
    })
    return {
      body:         generated.body,
      source:       'ai',
      dateKey:      agg.date_key,
      sessionCount: agg.session_count,
    }
  } catch (err) {
    if (err instanceof ServiceUnavailableError) {
      log.warn({ userId, dateKey: agg.date_key }, 'AI breaker open; serving rule-based day-reflection')
    } else if (err instanceof AppError && err.code === 'OPENAI_KEY_MISSING') {
      log.info({ userId, dateKey: agg.date_key }, 'OPENAI_API_KEY missing; serving rule-based day-reflection')
    } else {
      const message = err instanceof Error ? err.message : String(err)
      log.error({ userId, dateKey: agg.date_key, err: { message } },
        'generateDayReflection failed; serving rule-based day-reflection')
    }
    return {
      body:         ruleBasedReflection({
        totalCards:    agg.total_cards,
        accuracyPct,
        again:         agg.breakdown.again,
        hard:          agg.breakdown.hard,
        good:          agg.breakdown.good,
        easy:          agg.breakdown.easy,
        weakSpotCount: agg.weak_spot_words.length,
      }),
      source:       'fallback',
      dateKey:      agg.date_key,
      sessionCount: agg.session_count,
    }
  }
}
