import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { Ratelimit } from '@upstash/ratelimit'

import { redis } from '../db/redis.ts'
import { env } from '../lib/env.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError } from './errorHandler.ts'

// Module-scoped fallback logger. Used only when `req.log` is unexpectedly
// missing (pino-http ran but failed to decorate, or the middleware order ever
// changes). Mirrors the `req.log ?? apiLog` pattern in errorHandler.ts.
const log = componentLogger('rate-limit')

/**
 * Catch-block helper for rate-limit middlewares.
 *
 * Distinguishes the two error sources that can land here:
 *
 *   1. AppError (typically the 429 thrown immediately above when a limiter
 *      reports !success). This is the legitimate rate-limit-hit path —
 *      propagate via next(err) so the global error handler returns 429
 *      with X-RateLimit-* headers + Retry-After.
 *
 *   2. Anything else — Upstash REST throw, breaker SUE, network blip. This
 *      is INFRASTRUCTURE failure of the rate-limit substrate itself. The
 *      API fails OPEN on Upstash failure (logs warn, lets the request
 *      through) rather than 503'ing every client request when our cache is
 *      down. Trade-off: brief abuse-risk windows during Upstash outages
 *      vs. availability. The 30-failure / 60s Upstash circuit-breaker
 *      threshold bounds the warn-log volume during sustained outages.
 *
 * Documented in CLAUDE.md so ops can find this behavior without reading
 * the middleware source.
 */
function failOpenOnInfraError(err: unknown, req: Request, next: NextFunction): void {
  if (err instanceof AppError) {
    next(err)
    return
  }
  ;(req.log ?? log).warn(
    {
      err: err instanceof Error
        ? { name: err.name, message: err.message }
        : { detail: String(err) },
    },
    'rate limiter unavailable; failing open',
  )
  next()
}

/**
 * Production-only rate limiting. Each middleware below short-circuits
 * with `next()` when not in production, so dev iteration and the
 * integration test suite don't trigger Upstash rate-limit calls. The
 * Upstash REST round-trip per check is cheap individually but
 * cumulative across the 14 limiter sites — disabling in test/dev
 * keeps the suite fast and removes the hot path that previously made
 * an Upstash circuit-breaker proxy too expensive.
 *
 * In production, every middleware runs as before. Limits aren't a
 * "nice to have" outside dev — abuse protection lives at this layer.
 */
const RATE_LIMITING_ENABLED = env.NODE_ENV === 'production'

// `RatelimitResponse` is declared but not exported from @upstash/ratelimit;
// derive it from `Ratelimit.prototype.limit`'s awaited return type so this
// stays accurate across SDK upgrades.
type RatelimitResponse = Awaited<ReturnType<Ratelimit['limit']>>

// Upstash's Duration string type isn't exported either; derive from the
// `slidingWindow` parameter so a future Duration-string addition (e.g. '7 d')
// stays type-correct without manual maintenance here.
type SlidingWindowDuration = Parameters<typeof Ratelimit.slidingWindow>[1]

// ─── Header helper ────────────────────────────────────────────────────────────

/**
 * Set RFC 9331-style rate-limit headers on the response. Called from every
 * middleware below regardless of success so well-behaved clients can pace
 * themselves on the headers from a 200 response, and pace recovery on
 * `Retry-After` from a 429.
 *
 * On 429, also emits a structured WARN log line so sustained limiter trips
 * (the signature of brute-force / scripted-abuse attempts) surface as a
 * security signal instead of being silent.
 */
export function applyRateLimitHeaders(req: Request, res: Response, r: RatelimitResponse, limiter: string, key: string): void {
  res.setHeader('X-RateLimit-Limit',     String(r.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, r.remaining)))
  // r.reset is an epoch-ms timestamp; expose as epoch-seconds.
  res.setHeader('X-RateLimit-Reset',     String(Math.floor(r.reset / 1000)))
  if (!r.success) {
    const retryAfterSec = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfterSec))
    ;(req.log ?? log).warn(
      { limiter, key, resetAt: r.reset, retryAfterSec },
      '[rate-limit] hit',
    )
  }
}

/**
 * Pick the more-restrictive of two parallel rate-limit results for the
 * purpose of header reporting. Used by `authRateLimitMiddleware` which runs
 * a per-email and a per-IP check in parallel; the headers should reflect
 * whichever budget is closer to exhaustion so the client backs off correctly.
 */
export function tighter(a: RatelimitResponse, b: RatelimitResponse): RatelimitResponse {
  if (!a.success || !b.success) return a.success ? b : a
  return a.remaining <= b.remaining ? a : b
}

// ─── Factory ──────────────────────────────────────────────────────────────────
//
// Most limiters share the same shape: derive a key from the request, run one
// `Ratelimit.limit(key)`, emit headers, throw 429 on `!success`. The factory
// below captures that pattern so each limiter is defined as a small spec
// object instead of a ~25-line imperative middleware function. The two
// exceptions are `authRateLimitMiddleware` (runs two parallel limiters with
// conditional fall-through) and the bespoke OTP-verify limiter (keys off
// email-or-IP) — both kept as explicit handlers below.

interface LimiterSpec {
  /** Header / log label, e.g. 'ai'. */
  readonly label: string
  /** Redis key prefix passed to `new Ratelimit`, e.g. 'ratelimit:ai'. */
  readonly prefix: string
  /** Sliding-window length string, e.g. '1 m'. */
  readonly window: SlidingWindowDuration
  /** Sliding-window capacity. */
  readonly max: number
  /** Stable error code from the registry in errorHandler.ts. */
  readonly code: string
  /** User-facing 429 message. */
  readonly message: string
  /** Derives the per-request bucket key. Typically `${req.user.id}:label`. */
  readonly keyFn: (req: Request) => string
}

/** Convenience: every per-user limiter keys on `${userId}:label`. */
function userKey(label: string): (req: Request) => string {
  return (req) => `${req.user.id}:${label}`
}

function createLimiterMiddleware(spec: LimiterSpec): RequestHandler {
  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(spec.max, spec.window),
    prefix:  spec.prefix,
  })

  return async (req, res, next): Promise<void> => {
    if (!RATE_LIMITING_ENABLED) { next(); return }
    try {
      const key    = spec.keyFn(req)
      const result = await ratelimit.limit(key)
      applyRateLimitHeaders(req, res, result, spec.label, key)
      if (!result.success) {
        throw new AppError(429, spec.message, { code: spec.code })
      }
      next()
    } catch (err) {
      failOpenOnInfraError(err, req, next)
    }
  }
}

// ─── Per-user limiters (uniform pattern) ──────────────────────────────────────
//
// Each block is the spec + the corresponding export. The order matches the
// historic file order so a git blame on any specific limiter still surfaces
// the original commit. The error-code table in errorHandler.ts is the source
// of truth for `code` values; do not invent new codes here without adding the
// matching row there.

/**
 * Rate-limits AI endpoints per authenticated user (20/min). Must run after
 * authMiddleware. Apply alongside `aiDailyQuotaMiddleware` for cost control.
 */
export const aiRateLimitMiddleware = createLimiterMiddleware({
  label:   'ai',
  prefix:  'ratelimit:ai',
  window:  '1 m',
  max:     20,
  code:    'RATE_LIMITED_AI_MINUTE',
  message: 'AI rate limit exceeded. Please wait before making another request.',
  keyFn:   userKey('ai'),
})

/**
 * Daily-quota cap on AI endpoints (200/24h per user). Cost-control alongside
 * the per-minute `aiRateLimitMiddleware`. Must run after authMiddleware.
 */
export const aiDailyQuotaMiddleware = createLimiterMiddleware({
  label:   'ai-daily',
  prefix:  'ratelimit:ai-daily',
  window:  '24 h',
  max:     200,
  code:    'RATE_LIMITED_AI_DAILY',
  message: 'Daily AI quota exceeded. Try again tomorrow.',
  keyFn:   userKey('ai-daily'),
})

/**
 * Generous floor on every authenticated request. Catches scripted abuse from
 * a token holder; never trips legitimate UI traffic. Per-endpoint limiters
 * (which always have lower thresholds) trip first on costly endpoints.
 * Must run after authMiddleware.
 */
export const defaultUserRateLimitMiddleware = createLimiterMiddleware({
  label:   'default-user',
  prefix:  'ratelimit:default-user',
  window:  '1 m',
  max:     240,
  code:    'RATE_LIMITED_DEFAULT_USER',
  message: 'Request rate limit exceeded. Please slow down.',
  keyFn:   userKey('default'),
})

/**
 * Batch-flush limiter (5 / 5 min / user). Bounds the worst case
 * (5 × 500 reviews × ~50 ms ≈ 125 s of CPU per 5 min) while leaving headroom
 * for legitimate offline-buffer flushes.
 */
export const batchRateLimitMiddleware = createLimiterMiddleware({
  label:   'batch',
  prefix:  'ratelimit:batch',
  window:  '5 m',
  max:     5,
  code:    'RATE_LIMITED_BATCH',
  message: 'Batch sync rate limit exceeded. Please wait before retrying.',
  keyFn:   userKey('batch'),
})

/**
 * Subscribe limiter (15 / 15 min / user). The subscribe RPC clones every
 * source card into a new owned deck — most expensive write path.
 */
export const subscribeRateLimitMiddleware = createLimiterMiddleware({
  label:   'subscribe',
  prefix:  'ratelimit:subscribe',
  window:  '15 m',
  max:     15,
  code:    'RATE_LIMITED_SUBSCRIBE',
  message: 'Subscription rate limit exceeded. Please wait before retrying.',
  keyFn:   userKey('subscribe'),
})

/**
 * Single-review submit limiter (60 / min / user). Bounds review-log spam
 * without hampering active study (typical pace is 0.2–0.5 cards/sec).
 */
export const submitRateLimitMiddleware = createLimiterMiddleware({
  label:   'submit',
  prefix:  'ratelimit:submit',
  window:  '1 m',
  max:     60,
  code:    'RATE_LIMITED_SUBMIT',
  message: 'Submit rate limit exceeded. Please slow down.',
  keyFn:   userKey('submit'),
})

/**
 * Password-change limiter (5 / 15 min / user). Bounds brute-force of the
 * `currentPassword` field on POST /api/v1/auth/change-password while leaving
 * room for typo retries.
 */
export const passwordChangeRateLimitMiddleware = createLimiterMiddleware({
  label:   'password-change',
  prefix:  'ratelimit:password-change',
  window:  '15 m',
  max:     5,
  code:    'RATE_LIMITED_PASSWORD_CHANGE',
  message: 'Password-change rate limit exceeded. Please wait before retrying.',
  keyFn:   userKey('password-change'),
})

/**
 * Account-deletion limiter (3 / hour / user). Account deletion is irreversible
 * — caps abuse from a stolen access token without hampering legitimate retries
 * on a flaky network.
 */
export const accountDeleteRateLimitMiddleware = createLimiterMiddleware({
  label:   'account-delete',
  prefix:  'ratelimit:account-delete',
  window:  '1 h',
  max:     3,
  code:    'RATE_LIMITED_ACCOUNT_DELETE',
  message: 'Account deletion rate limit exceeded. Please wait before retrying.',
  keyFn:   userKey('account-delete'),
})

/**
 * Unsubscribe limiter (10 / hour / user). Unsubscribe cascade-deletes the
 * forked deck and all of its cards — large blast radius.
 */
export const unsubscribeRateLimitMiddleware = createLimiterMiddleware({
  label:   'unsubscribe',
  prefix:  'ratelimit:unsubscribe',
  window:  '1 h',
  max:     10,
  code:    'RATE_LIMITED_UNSUBSCRIBE',
  message: 'Unsubscribe rate limit exceeded. Please wait before retrying.',
  keyFn:   userKey('unsubscribe'),
})

/**
 * Costly-read limiter (120 / min / user) for pgvector cosine search. Trips
 * before the 240/min default-user backstop on this specific endpoint.
 */
export const similarSearchRateLimitMiddleware = createLimiterMiddleware({
  label:   'similar',
  prefix:  'ratelimit:similar',
  window:  '1 m',
  max:     120,
  code:    'RATE_LIMITED_SIMILAR',
  message: 'Similar-card search rate limit exceeded. Please slow down.',
  keyFn:   userKey('similar'),
})

/**
 * Dashboard limiter (120 / min / user) for the 5-RPC analytics bundle.
 * Trips before the 240/min default-user backstop on this endpoint.
 */
export const analyticsDashboardRateLimitMiddleware = createLimiterMiddleware({
  label:   'analytics-dashboard',
  prefix:  'ratelimit:analytics-dashboard',
  window:  '1 m',
  max:     120,
  code:    'RATE_LIMITED_DASHBOARD',
  message: 'Dashboard rate limit exceeded. Please slow down.',
  keyFn:   userKey('analytics-dashboard'),
})

/**
 * Shared limiter for cascade-DELETE endpoints (decks, cards) — 120 / min / user.
 * The work is symmetric (cascade fan-out via FK constraints) and the actor is
 * the same authenticated user; one bucket is sufficient.
 */
export const resourceDeleteRateLimitMiddleware = createLimiterMiddleware({
  label:   'resource-delete',
  prefix:  'ratelimit:resource-delete',
  window:  '1 m',
  max:     120,
  code:    'RATE_LIMITED_RESOURCE_DELETE',
  message: 'Resource-delete rate limit exceeded. Please slow down.',
  keyFn:   userKey('resource-delete'),
})

/**
 * Stricter limiter for `POST /verify-otp` specifically (5 / hour / email).
 * Six-digit OTPs have a 1M-deep search space; the standard 5/15min/email plus
 * distributed IPs could make sustained guessing feasible. Apply AFTER
 * `authRateLimitMiddleware`.
 *
 * Email-missing fallback: keys off the request IP rather than a global
 * `'anon'` bucket. The previous fallback shared one 5/hour budget across
 * every email-less call from any client — a single malformed-body caller
 * could DoS the whole flow system-wide. Mirrors the IP-keyed fallback
 * pattern in `authRateLimitMiddleware`.
 */
export const authOtpVerifyRateLimitMiddleware = createLimiterMiddleware({
  label:   'auth:otp-verify',
  prefix:  'ratelimit:auth:otp-verify',
  window:  '1 h',
  max:     5,
  code:    'RATE_LIMITED_OTP_VERIFY',
  message: 'Too many OTP attempts. Try again in an hour.',
  keyFn:   (req) => {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const ip    = req.ip ?? 'unknown'
    return email || `ip:${ip}`
  },
})

// ─── Bespoke: auth (parallel email + IP limiters) ─────────────────────────────
//
// Doesn't fit the factory because it runs two limiters in parallel and reports
// the more-restrictive of the two via `tighter()`. Falls back to IP-only when
// the request body has no `email` field (refresh / cancel-signup).

// Two parallel limiters. The previous tuple `${email}:${ip}` collapsed both
// dimensions into a single counter that an attacker could circumvent by
// rotating either axis. Keying on each axis separately means N emails or
// N IPs no longer give a fresh budget.
const authEmailRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:auth:email',
})

const authIpRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '15 m'),
  prefix: 'ratelimit:auth:ip',
})

/**
 * Rate-limits public auth endpoints.
 *
 * When the body carries an `email` field (signup / login / verify-otp /
 * resend-otp), runs two parallel checks:
 *   • per-email: 5 / 15 min — caps single-account brute force.
 *   • per-ip:   30 / 15 min — caps distributed credential stuffing while
 *                              staying generous for shared NAT/CGNAT.
 * Either tripping → 429 with the more-restrictive budget reflected in headers.
 *
 * When the body has no email (refresh / cancel-signup), only the per-IP
 * limiter applies. The previous `email || 'anon'` fallback created a single
 * GLOBAL bucket shared across every email-less call from any client — an
 * unauthenticated visitor could drain 5/15min and DoS legitimate calls
 * system-wide. The IP limiter alone is sufficient defense for these flows.
 */
export const authRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  if (!RATE_LIMITING_ENABLED) { next(); return }
  try {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const ip    = req.ip ?? 'unknown'

    if (email) {
      const [emailResult, ipResult] = await Promise.all([
        authEmailRatelimit.limit(email),
        authIpRatelimit.limit(ip),
      ])

      // Report whichever of the two budgets is closer to exhaustion. The
      // limiter label tags whichever one tripped (or 'auth' when both pass).
      const tighterResult = tighter(emailResult, ipResult)
      const trippedLabel  = !emailResult.success ? 'auth:email' : !ipResult.success ? 'auth:ip' : 'auth'
      const trippedKey    = !emailResult.success ? email : ip
      applyRateLimitHeaders(req, res, tighterResult, trippedLabel, trippedKey)

      if (!emailResult.success || !ipResult.success) {
        throw new AppError(429, 'Too many auth attempts. Try again later.', { code: 'RATE_LIMITED_AUTH' })
      }
    } else {
      const ipResult = await authIpRatelimit.limit(ip)
      applyRateLimitHeaders(req, res, ipResult, 'auth:ip', ip)
      if (!ipResult.success) {
        throw new AppError(429, 'Too many auth attempts. Try again later.', { code: 'RATE_LIMITED_AUTH' })
      }
    }
    next()
  } catch (err) {
    failOpenOnInfraError(err, req, next)
  }
}
