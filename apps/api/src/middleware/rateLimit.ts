import type { Request, RequestHandler, Response } from 'express'
import { Ratelimit } from '@upstash/ratelimit'

import { redis } from '../db/redis.ts'
import { AppError } from './errorHandler.ts'

// `RatelimitResponse` is declared but not exported from @upstash/ratelimit;
// derive it from `Ratelimit.prototype.limit`'s awaited return type so this
// stays accurate across SDK upgrades.
type RatelimitResponse = Awaited<ReturnType<Ratelimit['limit']>>

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
    req.log.warn(
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

// ─── AI rate limit (per-minute) ───────────────────────────────────────────────

const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'ratelimit:ai',
})

/**
 * Rate-limits AI endpoints per authenticated user (20/min). Must run after
 * authMiddleware. Apply alongside `aiDailyQuotaMiddleware` for cost control.
 */
export const aiRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:ai`
    const result = await aiRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'ai', key)
    if (!result.success) {
      throw new AppError(429, 'AI rate limit exceeded. Please wait before making another request.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── AI daily quota ───────────────────────────────────────────────────────────

const aiDailyQuotaRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '24 h'),
  prefix: 'ratelimit:ai-daily',
})

/**
 * Daily-quota cap on AI endpoints (200/24h per user). Cost-control alongside
 * the per-minute `aiRateLimitMiddleware`. Must run after authMiddleware.
 */
export const aiDailyQuotaMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:ai-daily`
    const result = await aiDailyQuotaRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'ai-daily', key)
    if (!result.success) {
      throw new AppError(429, 'Daily AI quota exceeded. Try again tomorrow.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Auth rate limit (split: per-email + per-IP) ──────────────────────────────

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
        throw new AppError(429, 'Too many auth attempts. Try again later.')
      }
    } else {
      const ipResult = await authIpRatelimit.limit(ip)
      applyRateLimitHeaders(req, res, ipResult, 'auth:ip', ip)
      if (!ipResult.success) {
        throw new AppError(429, 'Too many auth attempts. Try again later.')
      }
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── OTP-verify limit (stricter; per email) ───────────────────────────────────

const authOtpVerifyRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'ratelimit:auth:otp-verify',
})

/**
 * Stricter limiter for `POST /verify-otp` specifically. Six-digit OTPs have a
 * 1M-deep search space; the standard 5/15min/email plus distributed IPs
 * could make sustained guessing feasible. 5/hour/email closes that.
 * Apply AFTER `authRateLimitMiddleware`.
 */
export const authOtpVerifyRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const key = email || 'anon'
    const result = await authOtpVerifyRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'auth:otp-verify', key)
    if (!result.success) {
      throw new AppError(429, 'Too many OTP attempts. Try again in an hour.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Default per-user backstop ────────────────────────────────────────────────

const defaultUserRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(240, '1 m'),
  prefix: 'ratelimit:default-user',
})

/**
 * Generous floor on every authenticated request. Catches scripted abuse from
 * a token holder; never trips legitimate UI traffic. Per-endpoint limiters
 * (which always have lower thresholds) trip first on costly endpoints.
 * Must run after authMiddleware.
 */
export const defaultUserRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:default`
    const result = await defaultUserRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'default-user', key)
    if (!result.success) {
      throw new AppError(429, 'Request rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Batch-review limit ───────────────────────────────────────────────────────

// Sliding window: 5 batch flushes per 5 minutes per user. Bounds the worst case
// (5 × 500 reviews × ~50 ms ≈ 125 s of CPU per 5 min) while leaving headroom
// for legitimate offline-buffer flushes.
const batchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  prefix: 'ratelimit:batch',
})

export const batchRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:batch`
    const result = await batchRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'batch', key)
    if (!result.success) {
      throw new AppError(429, 'Batch sync rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Subscribe (premade fork) limit ───────────────────────────────────────────

// Sliding window: 15 subscribes per 15 mins per user. The subscribe RPC clones
// every source card into a new owned deck — most expensive write path.
const subscribeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '15 m'),
  prefix: 'ratelimit:subscribe',
})

export const subscribeRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:subscribe`
    const result = await subscribeRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'subscribe', key)
    if (!result.success) {
      throw new AppError(429, 'Subscription rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Single-review submit limit ───────────────────────────────────────────────

// Sliding window: 60 single-review submits per minute per user. Bounds review-log
// spam without hampering active study (typical pace is 0.2–0.5 cards/sec).
const submitRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'ratelimit:submit',
})

export const submitRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:submit`
    const result = await submitRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'submit', key)
    if (!result.success) {
      throw new AppError(429, 'Submit rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Password-change limit ────────────────────────────────────────────────────

// Sliding window: 5 password-change attempts per 15 mins per user. Bounds
// brute-force of the `currentPassword` field on POST /api/v1/auth/change-password
// while leaving room for typo retries.
const passwordChangeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:password-change',
})

export const passwordChangeRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:password-change`
    const result = await passwordChangeRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'password-change', key)
    if (!result.success) {
      throw new AppError(429, 'Password-change rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Account-deletion limit ───────────────────────────────────────────────────

// Sliding window: 3 account deletions per hour per user. Account deletion is
// irreversible — caps abuse from a stolen access token without hampering
// legitimate retries on a flaky network.
const accountDeleteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(3, '1 h'),
  prefix: 'ratelimit:account-delete',
})

export const accountDeleteRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:account-delete`
    const result = await accountDeleteRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'account-delete', key)
    if (!result.success) {
      throw new AppError(429, 'Account deletion rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Unsubscribe (premade fork) limit ─────────────────────────────────────────

// Sliding window: 10 unsubscribes per hour per user. Unsubscribe cascade-deletes
// the forked deck and all of its cards — large blast radius.
const unsubscribeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'ratelimit:unsubscribe',
})

export const unsubscribeRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:unsubscribe`
    const result = await unsubscribeRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'unsubscribe', key)
    if (!result.success) {
      throw new AppError(429, 'Unsubscribe rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// ─── Per-endpoint targeted limits ─────────────────────────────────────────────

// 120/min/user on costly reads (pgvector cosine + 5-RPC dashboard bundle) and
// cascade DELETEs. Trips before the 240/min default-user backstop on these
// specific endpoints.

const similarSearchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'ratelimit:similar',
})

export const similarSearchRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:similar`
    const result = await similarSearchRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'similar', key)
    if (!result.success) {
      throw new AppError(429, 'Similar-card search rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

const analyticsDashboardRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'ratelimit:analytics-dashboard',
})

export const analyticsDashboardRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:analytics-dashboard`
    const result = await analyticsDashboardRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'analytics-dashboard', key)
    if (!result.success) {
      throw new AppError(429, 'Dashboard rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

const resourceDeleteRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(120, '1 m'),
  prefix: 'ratelimit:resource-delete',
})

/**
 * Shared limiter for cascade-DELETE endpoints (decks, cards). The work is
 * symmetric (cascade fan-out via FK constraints) and the actor is the same
 * authenticated user; one bucket is sufficient.
 */
export const resourceDeleteRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const key = `${req.user.id}:resource-delete`
    const result = await resourceDeleteRatelimit.limit(key)
    applyRateLimitHeaders(req, res, result, 'resource-delete', key)
    if (!result.success) {
      throw new AppError(429, 'Resource-delete rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}
