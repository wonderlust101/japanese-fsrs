import { z } from "zod";

import { env } from "@/lib/env";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import "server-only";

/**
 * Shared helper for server actions that call the Express API.
 *
 * Reads the user's Supabase session from cookies, attaches a Bearer token,
 * fetches the path, and validates the JSON response against the supplied
 * schema. JSON Content-Type is set automatically when an `init.body` is
 * supplied.
 *
 * Throws `Error('Not authenticated')` when no session is present.
 * Throws `Error(<api error message>)` when the API returns a non-2xx status.
 * Throws `ZodError` when the response body doesn't match the schema —
 * surfacing a real contract drift instead of letting it propagate as a
 * mistyped value through the UI.
 */

/** Tiny schema for the API's standard error envelope. Used at error paths. */
const apiErrorBodySchema = z.object({ error: z.string() }).partial();

/**
 * Thrown by `apiCall` on non-2xx responses. Extends `Error` so existing
 * `err instanceof Error` / `err.message` callers keep working unchanged;
 * adds `status` so callers that need to distinguish (e.g. 412 If-Match
 * conflicts from 5xx) can branch without parsing the message string.
 *
 * IMPORTANT — `status` is reliable ONLY server-side. This module is
 * `server-only`, so an `ApiHttpError` is always thrown inside a Server Action
 * or RSC read. When such an error propagates across the Server Action → client
 * boundary, Next.js (in production) replaces it with a generic `Error` + a
 * `digest`, stripping both `message` and `status`. So do NOT branch on
 * `err.status` (or `err instanceof ApiHttpError`) in client components — it
 * works in dev and silently fails in prod. Handle status-dependent cases
 * inside the action: map them there, or RETURN a typed result (e.g.
 * `{ ok: false, conflict: true }`), which serializes intact, instead of
 * throwing.
 */
export class ApiHttpError extends Error {
	readonly status: number;
	constructor(status: number, message: string) {
		super(message);
		this.name = "ApiHttpError";
		this.status = status;
	}
}

/**
 * Per-call request budget for the Express API. These helpers run inside Next.js
 * server actions / RSC reads on the Node runtime, where a bare `fetch` has no
 * timeout: a half-open TCP connection or DNS black-hole (bytes never arrive, no
 * FIN) would park the request promise — and with it a server worker — until the
 * platform kills the invocation.
 *
 * Sized just ABOVE the API's own `server.requestTimeout` (30s, see
 * apps/api/src/index.ts). A slow-but-alive upstream hits its 30s cap first and
 * resets the socket, so the caller still observes the server's real behaviour;
 * this 35s signal only fires for connections the server's own cap can't reach.
 */
const API_TIMEOUT_MS = 35_000;

/**
 * Builds the abort signal for a single API fetch: a fresh 35s timeout, composed
 * with any caller-supplied `init.signal` via `AbortSignal.any` so the earliest
 * abort wins. Mirrors the server-side compose pattern in apps/api/src/db/supabase.ts.
 */
function apiTimeoutSignal(init: RequestInit): AbortSignal {
	const timeout = AbortSignal.timeout(API_TIMEOUT_MS);
	return init.signal != null ? AbortSignal.any([init.signal, timeout]) : timeout;
}

export async function apiCall<T>(
	path: string,
	responseSchema: z.ZodType<T>,
	init: RequestInit = {},
	errorPrefix: string = "Request failed",
): Promise<T> {
	const supabase = await createSupabaseServerClient();
	const { data: { session } } = await supabase.auth.getSession();
	if (session === null)
		throw new Error("Not authenticated");

	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${session.access_token}`);
	if (init.body !== undefined && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
		...init,
		headers,
		cache: init.cache ?? "no-store",
		signal: apiTimeoutSignal(init),
	});

	if (!res.ok) {
		const raw = await res.json().catch(() => ({}));
		const body = apiErrorBodySchema.safeParse(raw).data ?? {};
		throw new ApiHttpError(res.status, body.error ?? errorPrefix);
	}

	// 204 No Content — for void responses, callers pass `voidResponseSchema`.
	if (res.status === 204)
		return responseSchema.parse(undefined);
	const body = await res.json();
	return responseSchema.parse(body);
}

/**
 * Variant that returns `fallback` instead of throwing when no session exists,
 * the API returns a non-2xx status, or the response body fails schema parse.
 * Use for non-critical reads where the caller would rather render an empty
 * state than surface an error.
 */
export async function apiCallSafe<T>(
	path: string,
	responseSchema: z.ZodType<T>,
	init: RequestInit = {},
	fallback: T,
): Promise<T> {
	const supabase = await createSupabaseServerClient();
	const { data: { session } } = await supabase.auth.getSession();
	if (session === null)
		return fallback;

	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${session.access_token}`);
	if (init.body !== undefined && !headers.has("Content-Type")) {
		headers.set("Content-Type", "application/json");
	}

	const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
		...init,
		headers,
		cache: init.cache ?? "no-store",
		signal: apiTimeoutSignal(init),
	});

	if (!res.ok) {
		const raw = await res.json().catch(() => ({}));
		const body = apiErrorBodySchema.safeParse(raw).data ?? {};
		console.warn(`[apiCallSafe] ${path} → ${res.status}: ${body.error ?? "(no body)"}`);
		return fallback;
	}
	if (res.status === 204)
		return fallback;
	const body = await res.json();
	const parsed = responseSchema.safeParse(body);
	if (!parsed.success) {
		console.warn(`[apiCallSafe] ${path} response failed schema validation:`, parsed.error.message);
		return fallback;
	}
	return parsed.data;
}
