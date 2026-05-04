import { Redis } from '@upstash/redis'

if (!process.env['UPSTASH_REDIS_REST_URL']) {
  throw new Error('UPSTASH_REDIS_REST_URL environment variable is not set')
}
if (!process.env['UPSTASH_REDIS_REST_TOKEN']) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN environment variable is not set')
}

/**
 * Upstash Redis client. Reads UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN from the environment automatically.
 *
 * Used for: AI response caching, AI endpoint rate limiting,
 * and offline review submission buffering.
 */
export const redis = Redis.fromEnv()
