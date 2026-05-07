/**
 * Redis-backed sliding-window circuit breaker for external dependencies
 * (currently OpenAI chat + embeddings). When recent failures exceed a
 * threshold, the breaker opens and callers fast-fail instead of paying the
 * full slow-failure path on every request.
 *
 * Storage:
 *   - Key  `circuit:${name}:failures` — INT counter, TTL = WINDOW_SECONDS.
 *   - First failure within a window initialises the counter+TTL atomically
 *     (`SET NX EX`); subsequent failures only `INCR`.
 *   - A success deletes the counter (closes the breaker).
 *
 * Visibility:
 *   - Threshold-crossing transitions log at `warn` so they show up alongside
 *     the rate-limit hit logs in `apps/api/src/middleware/rateLimit.ts`.
 *   - Per-failure logs stay at `debug` to avoid noise during outages.
 */

import { redis } from '../db/redis.ts'
import { componentLogger } from './logger.ts'

const log = componentLogger('circuit-breaker')

/** Sliding-window length. Failures accumulate; success or expiry resets. */
const WINDOW_SECONDS = 5 * 60

/** Number of failures within WINDOW_SECONDS that opens the breaker. */
const THRESHOLD = 10

const failureKey = (name: string): string => `circuit:${name}:failures`

/**
 * Increment the failure counter. The first failure in a window sets the TTL
 * atomically via `SET NX EX`, so concurrent first-failures don't race.
 *
 * Threshold-crossing emits one `warn` log line so monitoring picks up the
 * closed → open transition without per-failure noise.
 */
export async function recordFailure(name: string): Promise<void> {
  const key = failureKey(name)
  await redis.set(key, 0, { ex: WINDOW_SECONDS, nx: true })
  const count = await redis.incr(key)
  if (count === THRESHOLD) {
    log.warn({ name, count, threshold: THRESHOLD }, 'circuit breaker opened')
  }
}

/**
 * Clear the failure counter on a successful call. Only emits a `warn` log
 * when the breaker was actually open (count ≥ threshold) — successful calls
 * during normal operation stay silent.
 */
export async function recordSuccess(name: string): Promise<void> {
  const key = failureKey(name)
  const raw = await redis.get<number | string>(key)
  if (raw === null || raw === undefined) return
  const count = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw
  await redis.del(key)
  if (Number.isFinite(count) && count >= THRESHOLD) {
    log.warn({ name }, 'circuit breaker closed')
  }
}

/** True when the failure count in the current window meets or exceeds the threshold. */
export async function isOpen(name: string): Promise<boolean> {
  const raw = await redis.get<number | string>(failureKey(name))
  if (raw === null || raw === undefined) return false
  const count = typeof raw === 'string' ? Number.parseInt(raw, 10) : raw
  return Number.isFinite(count) && count >= THRESHOLD
}

/**
 * Seconds until the breaker's failure window expires. Used to populate
 * `Retry-After` on 503 responses.
 *
 * Falls back to the full window when the key has no TTL or doesn't exist —
 * Upstash returns `-2` for missing keys and `-1` for keys without TTL.
 */
export async function getRetryAfterSeconds(name: string): Promise<number> {
  const ttl = await redis.ttl(failureKey(name))
  return ttl > 0 ? ttl : WINDOW_SECONDS
}
