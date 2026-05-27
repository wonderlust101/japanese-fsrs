import { createClient } from "@supabase/supabase-js";
import { describe } from "bun:test";

/**
 * Integration tests need a real Supabase instance.
 * Gate on a non-stub SUPABASE_URL so CI/local can opt in by setting it.
 */
export function isIntegrationEnabled(): boolean {
	const url = process.env.SUPABASE_URL;
	return url !== undefined && url.length > 0 && url !== "https://test-supabase";
}

/** describe block that runs only when integration env vars are real. */
export const describeIntegration: typeof describe = isIntegrationEnabled()
	? describe
	: describe.skip;

/** Whether a REAL OpenAI key is configured (not absent, not the test dummy). */
export function isOpenAIEnabled(): boolean {
	const key = process.env.OPENAI_API_KEY;
	return key !== undefined && key.length > 0 && key !== "sk-test-dummy";
}

/**
 * Like `describeIntegration`, but also requires a real OpenAI key. For suites
 * that call OpenAI with no cache to short-circuit (embedding generation, the
 * readiness probe's OpenAI check). Skips when no real key is set, so the
 * integration job stays green and token-free unless OPENAI_API_KEY is supplied.
 */
export const describeOpenAI: typeof describe
	= isIntegrationEnabled() && isOpenAIEnabled() ? describe : describe.skip;

// ─── User sign-in WITHOUT polluting the shared service-role client ───────────
//
// signInWithPassword sets a session on whichever client calls it. Tests import
// ONE shared `supabaseAdmin` (the app's service-role client); signing in on it
// leaves it acting as that user under RLS for every later `.from()` call — its
// own AND the app's (same singleton). That makes any fixture that touches
// another user's or system rows fail (e.g. assertDeckActive can't see user A's
// deck while the client is signed in as B → card create 404s). Mint tokens on a
// dedicated client instead so supabaseAdmin stays session-less = service_role.

let cachedAuthClient: ReturnType<typeof createClient> | null = null;
function authClient(): ReturnType<typeof createClient> {
	cachedAuthClient ??= createClient(
		process.env.SUPABASE_URL ?? "",
		process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);
	return cachedAuthClient;
}

/** Sign in and return the access token without touching supabaseAdmin's session. */
export async function signInUser(email: string, password = "integration-pass"): Promise<string> {
	const { data, error } = await authClient().auth.signInWithPassword({ email, password });
	if (error !== null || data.session === null) {
		throw new Error(`signInUser failed: ${error?.message ?? "no session"}`);
	}
	return data.session.access_token;
}

// ─── Service-role seeding via raw PostgREST ──────────────────────────────────
//
// Direct fixture seeds of SYSTEM rows (premade_decks, user_id=NULL source
// cards) and cross-user rows must run as service_role to bypass RLS. The
// supabase-js client does not reliably present the service_role bearer against
// the local stack (a raw curl with the same key bypasses RLS, but the client
// hits "violates row-level security policy"), so these helpers issue raw fetch
// calls that mirror the working curl: apikey + Authorization: Bearer <key>.

function restBase(): { url: string; key: string } {
	return {
		url: process.env.SUPABASE_URL ?? "",
		key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
	};
}

function authHeaders(key: string): Record<string, string> {
	return { apikey: key, Authorization: `Bearer ${key}` };
}

/** Insert one row or an array of rows as service_role. Throws on non-2xx. */
export async function restSeed(table: string, rows: unknown): Promise<void> {
	const { url, key } = restBase();
	const res = await fetch(`${url}/rest/v1/${table}`, {
		method: "POST",
		headers: { ...authHeaders(key), "Content-Type": "application/json", "Prefer": "return=minimal" },
		body: JSON.stringify(rows),
	});
	if (!res.ok)
		throw new Error(`restSeed ${table} failed: ${res.status} ${await res.text()}`);
}

/** Call a SECURITY DEFINER RPC as service_role. Throws on non-2xx. */
export async function restRpc(fn: string, args: Record<string, unknown> = {}): Promise<void> {
	const { url, key } = restBase();
	const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
		method: "POST",
		headers: { ...authHeaders(key), "Content-Type": "application/json" },
		body: JSON.stringify(args),
	});
	if (!res.ok)
		throw new Error(`restRpc ${fn} failed: ${res.status} ${await res.text()}`);
}

/**
 * Read rows as service_role (RLS-bypassing). `query` is a raw PostgREST query
 *  string, e.g. `user_id=eq.<uuid>&select=user_id,mature_count`.
 */
export async function restSelect<T = Record<string, unknown>>(table: string, query: string): Promise<T[]> {
	const { url, key } = restBase();
	const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: authHeaders(key) });
	if (!res.ok)
		throw new Error(`restSelect ${table} failed: ${res.status} ${await res.text()}`);
	return res.json() as Promise<T[]>;
}

/**
 * Best-effort cleanup delete as service_role. `filter` is a raw PostgREST
 *  query string, e.g. `id=eq.<uuid>`. Swallows errors.
 */
export async function restDelete(table: string, filter: string): Promise<void> {
	const { url, key } = restBase();
	await fetch(`${url}/rest/v1/${table}?${filter}`, { method: "DELETE", headers: authHeaders(key) })
		.catch(() => undefined);
}
