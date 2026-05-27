/**
 * Redis-backed sliding-window circuit breaker for external dependencies
 * (OpenAI chat + embeddings, Supabase, Upstash). When recent failures
 * exceed a per-namespace threshold, the breaker opens and callers
 * fast-fail instead of paying the full slow-failure path on every request.
 *
 * Storage:
 *   - Failure counter: `circuit:${name}:failures` — INT counter, TTL = config.windowSeconds.
 *     First failure within a window initialises the counter+TTL atomically
 *     (`SET NX EX`); subsequent failures only `INCR`. A success deletes the
 *     counter (closes the breaker).
 *   - Half-open probe: `circuit:${name}:probe` — string '1', TTL = PROBE_TTL_SECONDS.
 *     When the breaker is open, exactly one caller acquires the probe slot
 *     via `SET NX EX`. That caller runs `fn()` as a probe. Other concurrent
 *     callers fast-fail until the probe completes (or the slot TTLs out and
 *     someone else can probe).
 *
 * Visibility:
 *   - Threshold-crossing transitions log at `warn` so they show up alongside
 *     the rate-limit hit logs in `apps/api/src/middleware/rateLimit.ts`.
 *   - Per-failure logs stay at `debug` to avoid noise during outages.
 *
 * Per-dependency tuning lives in BREAKER_CONFIG. Different dependencies have
 * different failure characteristics — Supabase and Upstash trip on a higher
 * threshold over a shorter window than OpenAI to reflect that DB/cache outages
 * are typically shorter and more severe (a sustained Supabase 5xx flood IS the
 * outage signal).
 */

// Use rawRedis (unwrapped) here — wrapping the breaker's own counter writes
// through the upstash breaker would cause infinite recursion (every
// recordFailure call would trigger another breaker check).
import { rawRedis as redis } from "../db/redis.ts";
import { AppError, ServiceUnavailableError } from "../middleware/errorHandler.ts";
import { componentLogger } from "./logger.ts";

const log = componentLogger("circuit-breaker");

interface BreakerConfig {
	/** Failures within `windowSeconds` that opens the breaker. */
	threshold: number;
	/** Sliding-window length (seconds). Failures accumulate; success or expiry resets. */
	windowSeconds: number;
}

/**
 * Per-namespace breaker tuning. Add a new entry when introducing a new
 * dependency. Unknown names fall back to OpenAI defaults with a warn log.
 */
const BREAKER_CONFIG: Record<string, BreakerConfig> = {
	"openai-chat": { threshold: 10, windowSeconds: 300 },
	"openai-embeddings": { threshold: 10, windowSeconds: 300 },
	"supabase": { threshold: 50, windowSeconds: 60 },
	"upstash": { threshold: 30, windowSeconds: 60 },
};

const FALLBACK_CONFIG: BreakerConfig = { threshold: 10, windowSeconds: 300 };

/**
 * Default `Retry-After` (seconds) when an inline call fails *before* the
 * breaker has tripped. Long enough for a transient blip to clear; short enough
 * that legit retries resume quickly. Once the breaker IS open, callers get the
 * remaining failure-window TTL via `getRetryAfterSeconds` instead.
 */
const INLINE_RETRY_AFTER_SECONDS = 30;

/**
 * Half-open probe slot lifetime (seconds). When the breaker is open, exactly
 * one caller acquires this slot to test the upstream; others fast-fail until
 * the probe completes (which clears the slot) or this TTL expires (which
 * lets a new caller probe).
 */
const PROBE_TTL_SECONDS = 5;

/**
 * Maximum jitter (seconds) added to the Retry-After value returned to clients.
 * Spreads the retry-storm across a window after the breaker reopens — without
 * this, 1000 clients all seeing `Retry-After: 245` would retry simultaneously
 * at T+245 and re-trip the breaker.
 */
const RETRY_AFTER_JITTER_SECONDS = 30;

const failureKey = (name: string): string => `circuit:${name}:failures`;
const probeKey = (name: string): string => `circuit:${name}:probe`;

/**
 * Names already warned-about for unknown-namespace fallback. Per-process cache
 *  so the warn fires once per name (not on every call), keeping test logs and
 *  production logs both clean.
 */
const warnedFallbackNames = new Set<string>();

function configFor(name: string): BreakerConfig {
	const config = BREAKER_CONFIG[name];
	if (config !== undefined)
		return config;
	if (!warnedFallbackNames.has(name)) {
		warnedFallbackNames.add(name);
		log.warn({ name }, "circuit breaker: unknown namespace; using fallback config");
	}
	return FALLBACK_CONFIG;
}

/**
 * Increment the failure counter. The first failure in a window sets the TTL
 * atomically via `SET NX EX`, so concurrent first-failures don't race.
 *
 * Threshold-crossing emits one `warn` log line so monitoring picks up the
 * closed → open transition without per-failure noise.
 */
export async function recordFailure(name: string): Promise<void> {
	const config = configFor(name);
	const key = failureKey(name);
	await redis.set(key, 0, { ex: config.windowSeconds, nx: true });
	const count = await redis.incr(key);
	if (count === config.threshold) {
		log.warn({ name, count, threshold: config.threshold }, "circuit breaker opened");
		invalidateIsOpenCache(name); // refresh state for callers within the next ISOPEN_CACHE_MS
	}
}

/**
 * Clear the failure counter on a successful call. Only emits a `warn` log
 * when the breaker was actually open (count ≥ threshold) — successful calls
 * during normal operation stay silent.
 *
 * Atomic via `GETDEL` so a concurrent `recordFailure` cannot `INCR` between
 * the read and the delete (which would silently discard a fresh failure).
 * Single round-trip is also one fewer Redis op than the previous get+del pair.
 */
export async function recordSuccess(name: string): Promise<void> {
	const config = configFor(name);
	const key = failureKey(name);
	const raw = await redis.getdel<number | string>(key);
	if (raw === null || raw === undefined)
		return;
	const count = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
	invalidateIsOpenCache(name); // breaker may have just transitioned closed
	if (Number.isFinite(count) && count >= config.threshold) {
		log.warn({ name }, "circuit breaker closed");
	}
}

/**
 * In-memory cache for isOpen results, scoped to the API process.
 *
 * Without this cache, every withBreaker call performs one Redis GET to check
 * isOpen. For Supabase calls (5+ per typical request), that's 5+ extra
 * round-trips per request — 200-500ms of overhead at typical Upstash REST
 * latency. The 200ms cache TTL means multiple Supabase calls within a single
 * HTTP request share one isOpen result.
 *
 * Trade-off: when the breaker opens, calls within the next 200ms still see
 * "closed" and proceed (they may fail and trip recordFailure normally). Acceptable
 * given the alternative is materially slower normal-path latency.
 */
const ISOPEN_CACHE_MS = 200;
const isOpenCache = new Map<string, { open: boolean; cachedAt: number }>();

/** True when the failure count in the current window meets or exceeds the threshold. */
export async function isOpen(name: string): Promise<boolean> {
	const now = Date.now();
	const cached = isOpenCache.get(name);
	if (cached !== undefined && (now - cached.cachedAt) < ISOPEN_CACHE_MS) {
		return cached.open;
	}
	const config = configFor(name);
	const raw = await redis.get<number | string>(failureKey(name));
	let open = false;
	if (raw !== null && raw !== undefined) {
		const count = typeof raw === "string" ? Number.parseInt(raw, 10) : raw;
		open = Number.isFinite(count) && count >= config.threshold;
	}
	isOpenCache.set(name, { open, cachedAt: now });
	return open;
}

/**
 * Force a refresh of the isOpen cache for `name`. Called from recordFailure
 * (on threshold-crossing) and recordSuccess so subsequent calls don't see
 * stale state. Tests also call this directly to reset state between cases.
 */
export function invalidateIsOpenCache(name: string): void {
	isOpenCache.delete(name);
}

/**
 * Seconds until the breaker's failure window expires. Used to populate
 * `Retry-After` on 503 responses.
 *
 * Adds 0–RETRY_AFTER_JITTER_SECONDS of jitter so that 1000 clients all seeing
 * the same Retry-After don't synchronize their retries at T+ttl. Spreads the
 * herd across a window so the breaker doesn't immediately re-trip.
 *
 * Falls back to the full window when the key has no TTL or doesn't exist —
 * Upstash returns `-2` for missing keys and `-1` for keys without TTL.
 */
export async function getRetryAfterSeconds(name: string): Promise<number> {
	const config = configFor(name);
	const ttl = await redis.ttl(failureKey(name));
	const base = ttl > 0 ? ttl : config.windowSeconds;
	const jitter = Math.floor(Math.random() * RETRY_AFTER_JITTER_SECONDS);
	return base + jitter;
}

/**
 * Public list of breaker namespaces. Exported for ops surfaces (e.g.
 * `/_health/deep`) so they can iterate over all known breakers without
 * hard-coding the names. Adding a namespace requires updating both
 * BREAKER_CONFIG above and this array.
 */
export const BREAKER_NAMES = ["openai-chat", "openai-embeddings", "supabase", "upstash"] as const;
export type BreakerName = typeof BREAKER_NAMES[number];

/**
 * Snapshot of a breaker's runtime state for ops introspection (used by
 * `/_health/deep`). Reads four Redis keys; safe to call from any
 * unauthenticated path because the data exposed is purely internal
 * counters (no user PII).
 */
export interface BreakerSnapshot {
	/**
	 * Current failure count in the sliding window. 0 when the counter key
	 *  has expired or never existed.
	 */
	failures: number;
	/**
	 * Seconds until the failure-counter key TTL expires. -2 = key missing,
	 *  -1 = no TTL set.
	 */
	windowTtl: number;
	/** Threshold above which the breaker opens. */
	threshold: number;
	/** True when failures >= threshold. */
	isOpen: boolean;
	/** True when the half-open probe slot is currently held by some caller. */
	probeHeld: boolean;
	/** Seconds until the probe slot TTL expires. -2 = no probe held. */
	probeTtl: number;
}

export async function getBreakerSnapshot(name: string): Promise<BreakerSnapshot> {
	const config = configFor(name);
	const fk = failureKey(name);
	const pk = probeKey(name);
	const [rawFailures, windowTtl, rawProbe, probeTtl] = await Promise.all([
		redis.get<number | string>(fk),
		redis.ttl(fk),
		redis.get<string>(pk),
		redis.ttl(pk),
	]);
	let failures = 0;
	if (rawFailures !== null && rawFailures !== undefined) {
		const n = typeof rawFailures === "string" ? Number.parseInt(rawFailures, 10) : rawFailures;
		failures = Number.isFinite(n) ? n : 0;
	}
	return {
		failures,
		windowTtl,
		threshold: config.threshold,
		isOpen: failures >= config.threshold,
		probeHeld: rawProbe !== null && rawProbe !== undefined,
		probeTtl,
	};
}

/**
 * Try to acquire the half-open probe slot. Atomic via Redis `SET NX EX`.
 * Returns true if claimed (caller may run as the probe); false otherwise
 * (someone else is already probing — fast-fail).
 */
async function tryAcquireProbe(name: string): Promise<boolean> {
	const result = await redis.set(probeKey(name), "1", { ex: PROBE_TTL_SECONDS, nx: true });
	return result === "OK";
}

/** Release the probe slot. Called whether the probe succeeded or failed. */
async function releaseProbe(name: string): Promise<void> {
	await redis.del(probeKey(name));
}

/**
 * Wraps an external-dependency call with the full breaker integration:
 * pre-call open-check (with half-open probe gating), post-call success /
 * failure recording, and 503 conversion of any non-`AppError` failure.
 *
 * Behaviour:
 *   - Breaker closed → run `fn`. Inner success records success; inner failure
 *     records failure (and may open the breaker on the threshold-crossing
 *     attempt).
 *   - Breaker open + probe slot available → exactly one caller acquires the
 *     slot and runs `fn` as a probe. Probe success closes the breaker; probe
 *     failure releases the slot so another can probe after PROBE_TTL_SECONDS.
 *   - Breaker open + probe slot held by another caller → fast-fail with
 *     `ServiceUnavailableError` (the held probe is testing the upstream;
 *     piling on would defeat the half-open purpose).
 *   - Inner throws non-`ServiceUnavailableError` `AppError` → re-throws
 *     verbatim WITHOUT recording a failure. Deterministic application errors
 *     (e.g. `AppError(500, 'OPENAI_API_KEY not configured')` config bug)
 *     shouldn't trip the breaker because retrying the same request won't help.
 *   - Inner throws `ServiceUnavailableError` directly → records failure,
 *     re-throws verbatim (preserves the original `retryAfterSeconds`). This
 *     IS the breaker's signal of degradation and must count.
 *   - Inner throws anything else (network, ZodError, plain `Error`) →
 *     records failure, wraps as `ServiceUnavailableError(serviceMessage,
 *     INLINE_RETRY_AFTER_SECONDS)` with the original error as `cause`.
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
	name: string,
	serviceMessage: string,
	fn: () => Promise<T>,
): Promise<T> {
	// Fast-path: when the breaker is closed (the 99% case), the only Redis
	// round-trip on the success path is this one isOpen check. recordSuccess
	// and releaseProbe are skipped unless we actually entered the open-branch
	// (acquiredProbe = true), which keeps per-call overhead at one Redis op
	// for the common case. Without this guard the breaker added 3 round-trips
	// per call (isOpen + recordSuccess + releaseProbe), which for hot paths
	// like rate-limit middleware was prohibitive.
	let acquiredProbe = false;
	if (await isOpen(name)) {
		if (!(await tryAcquireProbe(name))) {
			// Someone else is probing — fast-fail.
			throw new ServiceUnavailableError(serviceMessage, await getRetryAfterSeconds(name));
		}
		acquiredProbe = true;
		// We're the prober — fall through to the inner try/catch. The probe slot
		// is held until success/failure path releases it below.
	}

	try {
		const result = await fn();
		if (acquiredProbe) {
			// Probe success → close the breaker and release the slot. On the
			// closed-path success (acquiredProbe = false) we skip both: the
			// failure-counter key auto-expires after windowSeconds, and there's
			// no probe to release.
			await recordSuccess(name);
			await releaseProbe(name);
		}
		return result;
	} catch (err) {
		// Skip the failure record for deterministic AppError throws — they're
		// not infrastructure outages, just deliberate semantic errors from the
		// inner fn that retrying won't fix. ServiceUnavailableError extends
		// AppError, so the second clause is critical: it IS the breaker's
		// signal of degradation and MUST count.
		if (err instanceof AppError && !(err instanceof ServiceUnavailableError)) {
			// Don't record a failure, but DO release the probe (we held it but
			// the call wasn't a real test of upstream health).
			if (acquiredProbe)
				await releaseProbe(name);
			throw err;
		}
		await recordFailure(name);
		if (acquiredProbe)
			await releaseProbe(name);
		if (err instanceof AppError)
			throw err;
		// Forward the original error as `cause` so the global handler's
		// `summarizeErr` can surface it in the log line — without this the
		// SDK / network failure that opened the breaker is invisible past
		// this boundary.
		throw new ServiceUnavailableError(serviceMessage, INLINE_RETRY_AFTER_SECONDS, { cause: err });
	}
}
