import type { RequestHandler } from 'express'
import { Ratelimit } from '@upstash/ratelimit'

import { redis } from '../db/redis.ts'
import { AppError } from './errorHandler.ts'

// Sliding window: 20 AI endpoint calls per user per minute.
// Key pattern in Redis: ratelimit:ai:{userId}
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
    const { success } = await aiRatelimit.limit(`ai:${req.user.id}`)

    if (!success) {
      throw new AppError(429, 'AI rate limit exceeded. Please wait before making another request.')
    }

    next()
  } catch (err) {
    next(err)
  }
}
