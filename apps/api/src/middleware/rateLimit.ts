import type { RequestHandler, Response } from 'express'
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
 */
function applyRateLimitHeaders(res: Response, r: RatelimitResponse): void {
  res.setHeader('X-RateLimit-Limit',     String(r.limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, r.remaining)))
  // r.reset is an epoch-ms timestamp; expose as epoch-seconds.
  res.setHeader('X-RateLimit-Reset',     String(Math.floor(r.reset / 1000)))
  if (!r.success) {
    const retryAfterSec = Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))
    res.setHeader('Retry-After', String(retryAfterSec))
  }
}

/**
 * Pick the more-restrictive of two parallel rate-limit results for the
 * purpose of header reporting. Used by `authRateLimitMiddleware` which runs
 * a per-email and a per-IP check in parallel; the headers should reflect
 * whichever budget is closer to exhaustion so the client backs off correctly.
 */
function tighter(a: RatelimitResponse, b: RatelimitResponse): RatelimitResponse {
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
    const result = await aiRatelimit.limit(`${req.user.id}:ai`)
    applyRateLimitHeaders(res, result)
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
    const result = await aiDailyQuotaRatelimit.limit(`${req.user.id}:ai-daily`)
    applyRateLimitHeaders(res, result)
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
 * Rate-limits public auth endpoints. Runs two parallel checks per request:
 *   • per-email: 5 / 15 min — caps single-account brute force.
 *   • per-ip:   30 / 15 min — caps distributed credential stuffing while
 *                              staying generous for shared NAT/CGNAT.
 * Either tripping → 429 with the more-restrictive budget reflected in headers.
 *
 * `email` is read from the body when present; absent (refresh, cancel-signup)
 * → 'anon' so the email limiter still applies a global anonymous bucket.
 */
export const authRateLimitMiddleware: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const ip    = req.ip ?? 'unknown'

    const [emailResult, ipResult] = await Promise.all([
      authEmailRatelimit.limit(email || 'anon'),
      authIpRatelimit.limit(ip),
    ])

    applyRateLimitHeaders(res, tighter(emailResult, ipResult))

    if (!emailResult.success || !ipResult.success) {
      throw new AppError(429, 'Too many auth attempts. Try again later.')
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
    const result = await authOtpVerifyRatelimit.limit(email || 'anon')
    applyRateLimitHeaders(res, result)
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
    const result = await defaultUserRatelimit.limit(`${req.user.id}:default`)
    applyRateLimitHeaders(res, result)
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
    const result = await batchRatelimit.limit(`${req.user.id}:batch`)
    applyRateLimitHeaders(res, result)
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
    const result = await subscribeRatelimit.limit(`${req.user.id}:subscribe`)
    applyRateLimitHeaders(res, result)
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
    const result = await submitRatelimit.limit(`${req.user.id}:submit`)
    applyRateLimitHeaders(res, result)
    if (!result.success) {
      throw new AppError(429, 'Submit rate limit exceeded. Please slow down.')
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
    const result = await accountDeleteRatelimit.limit(`${req.user.id}:account-delete`)
    applyRateLimitHeaders(res, result)
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
    const result = await unsubscribeRatelimit.limit(`${req.user.id}:unsubscribe`)
    applyRateLimitHeaders(res, result)
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
    const result = await similarSearchRatelimit.limit(`${req.user.id}:similar`)
    applyRateLimitHeaders(res, result)
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
    const result = await analyticsDashboardRatelimit.limit(`${req.user.id}:analytics-dashboard`)
    applyRateLimitHeaders(res, result)
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
    const result = await resourceDeleteRatelimit.limit(`${req.user.id}:resource-delete`)
    applyRateLimitHeaders(res, result)
    if (!result.success) {
      throw new AppError(429, 'Resource-delete rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}
