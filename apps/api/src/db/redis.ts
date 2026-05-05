import { Redis } from '@upstash/redis'
import { env } from '../lib/env.ts'

/**
 * Upstash Redis client. Used for AI response caching, AI endpoint rate
 * limiting, and offline review submission buffering.
 */
export const redis = new Redis({
  url:   env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
})
