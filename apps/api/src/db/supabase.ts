import type { Database } from "./database.types.ts";
import { createClient } from "@supabase/supabase-js";
import { withBreaker } from "../lib/circuit-breaker.ts";
import { env } from "../lib/env.ts";
import { isNetworkError, isTransientHttp, retry, TransientHttpError } from "../lib/retry.ts";
import { TIMEOUTS } from "../lib/timeouts.ts";

const SUPABASE_UNAVAILABLE_MSG = "Database temporarily unavailable; please retry shortly";

/**
 * Per-call fetch wrapper with three layers of resilience:
 *
 *   withBreaker('supabase')
 *     └── retry (2 retries, 5xx + network only)
 *         └── fetch (with TIMEOUTS.supabaseFetch via AbortSignal)
 *
 * Composition rationale (matches the OpenAI breaker pattern in ai.service.ts):
 *
 *   - Breaker (outermost): fast-fails when 50 failures accumulate within 60s
 *     (configured in lib/circuit-breaker.ts BREAKER_CONFIG). Half-open probe
 *     gates the post-recovery first-call to avoid thundering herds.
 *
 *   - Retry: handles transient PostgREST 5xx (502/503/504) and native fetch
 *     network errors (TypeError) with full-jitter exponential backoff. supabase-js
 *     v2 has no built-in retry layer; without this every blip surfaces to the
 *     user. 5xx detection: `fetch` returns a Response on any status — the inner
 *     fn throws `TransientHttpError` so retry can catch it.
 *
 *   - fetch + AbortSignal.timeout: existing 10s per-call cap (Phase A timeout
 *     refactor). Composes with any caller-supplied `init.signal` via
 *     AbortSignal.any.
 *
 * Worst-case wall time: 3 attempts × 10s + ~3s jittered backoff ≈ 23s.
 * Outer cap: server.requestTimeout 30s.
 *
 * `as typeof fetch` cast preserves Bun's runtime fetch shape (which carries a
 * `preconnect` method that a plain function can't replicate). supabase-js
 * never invokes preconnect, so the cast is safe in practice.
 */
const timeoutFetch = ((...args: Parameters<typeof fetch>) => {
	const [input, init] = args;

	return withBreaker("supabase", SUPABASE_UNAVAILABLE_MSG, () =>
		retry(
			async () => {
				const timeoutSignal = AbortSignal.timeout(TIMEOUTS.supabaseFetch);
				const signal = init?.signal != null
					? AbortSignal.any([init.signal, timeoutSignal])
					: timeoutSignal;
				const res = await fetch(input, { ...init, signal });
				if (res.status >= 502 && res.status <= 504) {
					// Cancel the body so the underlying socket releases back to the
					// agent pool — without this, abandoned 5xx bodies pin sockets in
					// the fetch agent pool until GC, which under sustained Supabase
					// 5xx amplifies the outage by exhausting available sockets.
					// Cancellation is best-effort: failure to cancel just means GC
					// catches up later, no behavioral impact on the retry path.
					res.body?.cancel().catch(() => undefined);
					throw new TransientHttpError(res.status);
				}
				return res;
			},
			{
				maxAttempts: 3,
				baseMs: 200,
				maxMs: 2000,
				factor: 2,
				isRetryable: err => isNetworkError(err) || isTransientHttp(err),
				label: "supabase",
				// Pass through the caller's signal so retry's backoff sleep is
				// cancellable on client disconnect — without this, aborted requests
				// still wait out the full jittered backoff before the retry loop
				// exits.
				signal: init?.signal ?? undefined,
			},
		));
}) as typeof fetch;

/**
 * Service-role Supabase client. Bypasses RLS — use only after the request's
 * auth middleware has already verified the caller's identity.
 * Never expose this client or its key to the browser or frontend.
 *
 * Defense-in-depth on timeouts: timeoutFetch caps the HTTP-level call at 10s,
 * the migration `20260512000000_add_role_timeouts.sql` sets
 * `statement_timeout = '10s'` on the service_role so Postgres also kills slow
 * queries. The retry layer above handles transients within those budgets.
 *
 * Explicit `<Database, 'public', 'public'>` pins the schema-name generic so
 * the inferred return type matches the bare `SupabaseClient` default that
 * integration tests use (`let supabaseAdmin: SupabaseClient`). Without all
 * three pins, passing the options bag triggers conditional inference that
 * fails to assign under `exactOptionalPropertyTypes: true`.
 */
export const supabaseAdmin = createClient<Database, "public", "public">(
	env.SUPABASE_URL,
	env.SUPABASE_SERVICE_ROLE_KEY,
	{ global: { fetch: timeoutFetch } },
);

/**
 * Dedicated client for user-facing GoTrue operations (signIn / signUp /
 * verifyOtp / refreshSession / resend). Each of those sets an in-memory session
 * on whatever client issues it. Routing them through `supabaseAdmin` — the
 * singleton used for every service_role data query — would leave it acting as
 * the just-authenticated user, so subsequent `.from()` calls run under that
 * user's RLS instead of service_role. Under concurrency that is a cross-user
 * hazard (request B's query running as the user who logged in via request A);
 * in the integration suite it surfaced as createDeck → RLS 42501 in every
 * suite that ran after the auth tests.
 *
 * Isolating these ops here keeps `supabaseAdmin` session-less = always
 * service_role. `persistSession` / `autoRefreshToken` are off: callers read the
 * returned tokens and never rely on this client's own session, so there is
 * nothing to persist or refresh (and no background refresh timers to leak).
 * Admin operations (`auth.admin.*`) stay on `supabaseAdmin` — they use the
 * service_role key directly and do not set a session.
 */
export const supabaseAuth = createClient<Database, "public", "public">(
	env.SUPABASE_URL,
	env.SUPABASE_SERVICE_ROLE_KEY,
	{ global: { fetch: timeoutFetch }, auth: { persistSession: false, autoRefreshToken: false } },
);
