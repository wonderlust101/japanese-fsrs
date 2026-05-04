import type { RequestHandler } from 'express'
import { Ratelimit } from '@upstash/ratelimit'

import { redis } from '../db/redis.ts'
import { AppError } from './errorHandler.ts'

// Sliding window: 20 AI endpoint calls per user per minute.
// Key pattern in Redis: ratelimit:{userId}:ai  (per TDD §10.1)
const aiRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  prefix: 'ratelimit',
})

/**
 * Rate-limits AI endpoints per authenticated user.
 * Must be applied after authMiddleware (requires req.user).
 *
 * Returns 429 when the user exceeds 20 AI calls per minute.
 * Apply to every route under /api/v1/ai/.
 */
export const aiRateLimitMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const { success } = await aiRatelimit.limit(`${req.user.id}:ai`)

    if (!success) {
      throw new AppError(429, 'AI rate limit exceeded. Please wait before making another request.')
    }

    next()
  } catch (err) {
    next(err)
  }
}

// Sliding window: 5 attempts per 15 minutes.
// Keyed by email+IP so brute-force on a known account and credential-stuffing
// from a single host both hit the limit. Anonymous bodies fall back to IP only.
const authRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '15 m'),
  prefix: 'ratelimit:auth',
})

/**
 * Rate-limits public auth endpoints (signup/login/refresh/verify-otp/resend-otp).
 * Apply BEFORE the controller; body must already be parsed by express.json.
 *
 * Returns 429 when the (email, ip) tuple exceeds 5 attempts per 15 minutes.
 */
export const authRateLimitMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const rawEmail: unknown = (req.body as { email?: unknown } | undefined)?.email
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
    const key = `${email || 'anon'}:${req.ip ?? 'unknown'}`
    const { success } = await authRatelimit.limit(key)

    if (!success) {
      throw new AppError(429, 'Too many auth attempts. Try again later.')
    }

    next()
  } catch (err) {
    next(err)
  }
}

// Sliding window: 5 batch flushes per 5 minutes per user. Bounds the worst case
// (5 × 500 reviews × ~50 ms ≈ 125 s of CPU per 5 min) while leaving headroom
// for legitimate offline-buffer flushes.
const batchRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '5 m'),
  prefix: 'ratelimit:batch',
})

/**
 * Rate-limits POST /api/v1/reviews/batch — the offline-buffer sync endpoint.
 * Must be applied after authMiddleware (requires req.user).
 */
export const batchRateLimitMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const { success } = await batchRatelimit.limit(`${req.user.id}:batch`)
    if (!success) {
      throw new AppError(429, 'Batch sync rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// Sliding window: 15 subscribes per 15 mins per user. The subscribe RPC clones
// every source card into a new owned deck — most expensive write path.
const subscribeRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(15, '15 m'),
  prefix: 'ratelimit:subscribe',
})

/**
 * Rate-limits POST /api/v1/premade-decks/:id/subscribe.
 * Must be applied after authMiddleware (requires req.user).
 */
export const subscribeRateLimitMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const { success } = await subscribeRatelimit.limit(`${req.user.id}:subscribe`)
    if (!success) {
      throw new AppError(429, 'Subscription rate limit exceeded. Please wait before retrying.')
    }
    next()
  } catch (err) {
    next(err)
  }
}

// Sliding window: 60 single-review submits per minute per user. Bounds review-log
// spam without hampering active study (typical pace is 0.2–0.5 cards/sec).
const submitRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'ratelimit:submit',
})

/**
 * Rate-limits POST /api/v1/reviews/submit — single-review writes.
 * Must run after authMiddleware (requires req.user).
 */
export const submitRateLimitMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const { success } = await submitRatelimit.limit(`${req.user.id}:submit`)
    if (!success) {
      throw new AppError(429, 'Submit rate limit exceeded. Please slow down.')
    }
    next()
  } catch (err) {
    next(err)
  }
}
