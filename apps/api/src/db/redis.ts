import { Redis } from '@upstash/redis'

/**
 * Upstash Redis client. Reads UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN from the environment automatically.
 *
 * Used for: AI response caching, AI endpoint rate limiting,
 * and offline review submission buffering.
 */
export const redis = Redis.fromEnv()
