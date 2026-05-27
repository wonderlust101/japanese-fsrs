/**
 * Single source of truth for every timeout value in the API. Values compose
 * in layers — outer is server, inner is per-call:
 *
 *   server.requestTimeout (30s)        — destroys the socket; outer cap
 *     ↓
 *     handler request body
 *       ↓
 *       per-call:
 *         supabase fetch  (10s)         — global.fetch timeout in db/supabase.ts
 *           ↓ in turn invokes Postgres:
 *           statement_timeout  (10s)    — service_role role setting (migration)
 *           lock_timeout        (2s)    — service_role role setting (migration)
 *         upstash fetch    (2s)         — Redis signal generator in db/redis.ts
 *         openai call      (15s)        — OpenAI SDK timeout option in lib/openai.ts
 *
 * The OpenAI call (15s) deliberately exceeds the supabase fetch (10s) because
 * chat completions for a long prompt can legitimately take 10–14s, while no
 * Postgres query in this app should ever take that long.
 *
 * The server timeout (30s) is the outer cap: even if every downstream completes
 * under its budget, the worst-case multi-step handler stays under it (e.g.
 * AI-path card create: profile fetch 10s + OpenAI 15s + insert 10s is
 * theoretically 35s but in practice <20s p99).
 *
 * Bumping any value here should consider the COMPOSITION: a Supabase call
 * inside a transaction inside a handler must complete within the smallest
 * applicable budget.
 *
 *   ── SDK retry composition (worst-case, capped by req.signal) ──
 *   OpenAI:   3 attempts × 15s timeout = 45s theoretical, ~30s in practice
 *             (req.signal aborts the in-flight SDK call when
 *             server.requestTimeout fires; the SDK propagates abort
 *             through its internal AbortController).
 *   Upstash:  6 attempts × 2s timeout + ~5s jittered backoff ≈ 17s.
 *             SDK default RetryConfig with our jittered backoff override
 *             in db/redis.ts.
 *   Supabase: 3 attempts × 10s timeout + ~3s jittered backoff ≈ 23s.
 *             Custom retry layer in db/supabase.ts using lib/retry.ts.
 *
 *   ── Dependency failure semantics ──
 *   Supabase down  → 503 ServiceUnavailableError (Retry-After) via the
 *                    breaker after retry exhaust. Breaker opens at 50/60s
 *                    threshold. REQUIRED dep — boot probe fails fast.
 *   Upstash down   → fail-soft for cache reads/writes and signup-cancel
 *                    tokens (warn + continue, callers degrade gracefully).
 *                    Fail-open for rate limiters (warn + allow request).
 *                    Breaker opens at 30/60s threshold; remaining callers
 *                    receive SUE. OPTIONAL dep — no boot probe.
 *   OpenAI down    → 503 ServiceUnavailableError via withBreaker. Card
 *                    creation succeeds without embedding (fire-and-forget
 *                    decoupled from request lifecycle). AI endpoints
 *                    (generate-card, etc.) fail. OPTIONAL dep — boot probe
 *                    is warn-and-continue for transient failures.
 */

export const TIMEOUTS = {
	/** Express server-level request timeout — apps/api/src/index.ts */
	serverRequest: 30_000,

	/** supabase-js global.fetch wrapper — apps/api/src/db/supabase.ts */
	supabaseFetch: 10_000,

	/** Postgres statement_timeout for service_role — migration 20260512000000 */
	postgresStatement: "10s",

	/** Postgres lock_timeout for service_role — migration 20260512000000 */
	postgresLock: "2s",

	/** Upstash @upstash/redis signal generator — apps/api/src/db/redis.ts */
	upstashFetch: 2_000,

	/** OpenAI SDK per-client timeout — apps/api/src/lib/openai.ts */
	openaiCall: 15_000,

	/**
	 * Startup-probe OpenAI timeout — apps/api/src/lib/startup-probe.ts. Tighter
	 *  than the request-path budget so misconfigurations fail fast at boot.
	 */
	startupProbe: 10_000,
} as const;
