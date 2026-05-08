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
import { AppError, ServiceUnavailableError } from '../middleware/errorHandler.ts'

const log = componentLogger('circuit-breaker')

/** Sliding-window length. Failures accumulate; success or expiry resets. */
const WINDOW_SECONDS = 5 * 60

/** Number of failures within WINDOW_SECONDS that opens the breaker. */
const THRESHOLD = 10

/**
 * Default `Retry-After` (seconds) when an inline call fails *before* the
 * breaker has tripped. Long enough for a transient blip to clear; short enough
 * that legit retries resume quickly. Once the breaker IS open, callers get the
 * remaining failure-window TTL via `getRetryAfterSeconds` instead.
 */
const INLINE_RETRY_AFTER_SECONDS = 30

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

/**
 * Wraps an external-dependency call with the full breaker integration:
 * pre-call open-check, post-call success / failure recording, and 503
 * conversion of any non-`AppError` failure.
 *
 * Behaviour:
 *   - Breaker open  → throws `ServiceUnavailableError(serviceMessage, ttl)`
 *     where `ttl` is the remaining failure-window seconds. `fn` is not run.
 *   - Inner success → records success (closes the breaker if it was open),
 *     returns `fn`'s value.
 *   - Inner throws non-`ServiceUnavailableError` `AppError` → re-throws
 *     verbatim WITHOUT recording a failure. Deterministic application errors
 *     (e.g. `AppError(500, 'OPENAI_API_KEY not configured')` config bug,
 *     `AppError(502, 'OpenAI returned an empty response')` upstream malformed
 *     content) shouldn't trip the breaker because retrying the same request
 *     won't help — and tripping the breaker on a config error would mask the
 *     underlying issue by fast-failing every subsequent caller.
 *   - Inner throws `ServiceUnavailableError` directly → records failure,
 *     re-throws verbatim (preserves the original `retryAfterSeconds`). This
 *     IS the breaker's signal of degradation and must count.
 *   - Inner throws anything else (network, ZodError, plain `Error`) →
 *     records failure, wraps as `ServiceUnavailableError(serviceMessage,
 *     INLINE_RETRY_AFTER_SECONDS)`.
 *
 * `serviceMessage` is the user-facing string for the 503 body in both the
 * open-breaker and catch-wrap paths. Pick one stable phrase per dependency.
 *
 * @example
 * const result = await withBreaker(
 *   'openai-chat',
 *   'AI service temporarily unavailable; please retry shortly',
 *   () => openai.chat.completions.create({ ... }),
 * )
 */
export async function withBreaker<T>(
  name:           string,
  serviceMessage: string,
  fn:             () => Promise<T>,
): Promise<T> {
  if (await isOpen(name)) {
    throw new ServiceUnavailableError(serviceMessage, await getRetryAfterSeconds(name))
  }
  try {
    const result = await fn()
    await recordSuccess(name)
    return result
  } catch (err) {
    // Skip the failure record for deterministic AppError throws — they're
    // not infrastructure outages, just deliberate semantic errors from the
    // inner fn that retrying won't fix. ServiceUnavailableError extends
    // AppError, so the second clause is critical: it IS the breaker's
    // signal of degradation and MUST count.
    if (err instanceof AppError && !(err instanceof ServiceUnavailableError)) {
      throw err
    }
    await recordFailure(name)
    if (err instanceof AppError) throw err
    throw new ServiceUnavailableError(serviceMessage, INLINE_RETRY_AFTER_SECONDS)
  }
}
