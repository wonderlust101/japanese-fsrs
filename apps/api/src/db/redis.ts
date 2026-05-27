import { Redis } from "@upstash/redis";
import { withBreaker } from "../lib/circuit-breaker.ts";
import { env } from "../lib/env.ts";
import { TIMEOUTS } from "../lib/timeouts.ts";

const UPSTASH_UNAVAILABLE_MSG = "Cache temporarily unavailable; please retry shortly";

/**
 * Underlying Upstash Redis client. Used directly by the circuit breaker
 * (`lib/circuit-breaker.ts`) to record/read failure counters and probe slots
 * — wrapping it through itself would cause infinite recursion when a breaker
 * operation triggers another breaker check. Application code should use the
 * exported `redis` Proxy below instead.
 *
 * Config:
 *   - `signal: () => AbortSignal.timeout(...)` (function form) ensures each
 *     call gets a fresh 2s budget. A static AbortSignal would already be
 *     aborted by the time the second call ran. Per @upstash/redis 1.37+,
 *     RedisConfigNodejs.signal accepts `AbortSignal | (() => AbortSignal)`.
 *   - `retry.backoff` overrides the SDK default `Math.exp(n) * 50` with an
 *     additive jitter component. Default has no jitter, which causes
 *     synchronized retry storms when many callers retry the same upstream.
 */
const realRedis = new Redis({
	url: env.UPSTASH_REDIS_REST_URL,
	token: env.UPSTASH_REDIS_REST_TOKEN,
	signal: () => AbortSignal.timeout(TIMEOUTS.upstashFetch),
	retry: {
		backoff: (retryCount: number) => Math.exp(retryCount) * 50 + Math.random() * 100,
	},
});

/**
 * Raw Upstash client without breaker wrapping. ONLY for use by
 * `lib/circuit-breaker.ts` to break the import cycle: the breaker manages the
 * `circuit:upstash:*` keys itself and must not be subject to its own
 * breaker (which would recurse on every recordFailure call).
 *
 * Do NOT import this from anywhere else. Application code should use the
 * Proxy-wrapped `redis` export below so Upstash failures count toward the
 * breaker.
 */
export const rawRedis = realRedis;

/**
 * Application-facing Upstash Redis client, wrapped with circuit-breaker
 * protection. Every method call goes through `withBreaker('upstash', ...)`
 * so a sustained Upstash outage opens the breaker (30 failures within 60s
 * per `BREAKER_CONFIG` in `lib/circuit-breaker.ts`) and subsequent calls
 * fast-fail with `ServiceUnavailableError + Retry-After`.
 *
 * Used by:
 *   - `lib/idempotency.ts` (claim/store/delete keys — actually goes through
 *     supabaseAdmin.rpc, NOT this client; documenting for completeness)
 *   - `services/ai.service.ts` (response cache reads/writes)
 *   - `services/auth.service.ts` (signup-cancel tokens)
 *   - `middleware/rateLimit.ts` in production (via `@upstash/ratelimit`'s
 *     internal calls). Rate-limit middleware is gated to NODE_ENV='production'
 *     in middleware/rateLimit.ts so dev/test paths bypass it entirely —
 *     which is why this Proxy can be re-introduced without re-creating the
 *     hot-path overhead that forced its earlier revert.
 *
 * The Proxy intercepts top-level method calls only. Methods that return
 * sub-objects (Pipeline via `redis.pipeline()`, Script via `redis.script.*`)
 * have their nested method calls bypass the breaker. We don't use those
 * primitives today; if added later, those nested calls won't have breaker
 * protection. Document inline before introducing them.
 *
 * The closed-path optimization in `withBreaker` (skip recordSuccess and
 * releaseProbe when isOpen returned false) plus the in-memory `isOpen` cache
 * (200ms TTL) keep per-call overhead at roughly one Redis round-trip per
 * 200ms window, not per call.
 */
export const redis = new Proxy(realRedis, {
	get(target, prop, receiver) {
		const original = Reflect.get(target, prop, receiver) as unknown;
		if (typeof original !== "function")
			return original;
		return (...args: unknown[]) =>
			withBreaker("upstash", UPSTASH_UNAVAILABLE_MSG, async () =>
				(original as (...a: unknown[]) => unknown).apply(target, args));
	},
});
