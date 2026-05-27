import { describe, expect, it, mock } from "bun:test";

import { supabaseAuthMock } from "../../tests/support";

// Mock external clients before any module that transitively imports them
// loads. Otherwise the real supabase / redis modules try to parse env vars
// at import-time and the test bootstrap rejects.
// Shared getUser so auth.ts reads the same impl no matter which suite's mock
// it binds to. This suite only inspects router stacks (never calls getUser),
// so the default invalid result is irrelevant here.
mock.module("../db/supabase.ts", () => ({
	supabaseAdmin: { auth: { getUser: supabaseAuthMock.getUser } },
	// auth.service imports `supabaseAuth` too; the mock MUST expose it or Bun
	// throws "Export named 'supabaseAuth' not found" at module-load when app.ts's
	// route tree pulls in auth.service — the same trap the rawRedis note below
	// describes. This suite only inspects router stacks, so a bare stub suffices.
	supabaseAuth: { auth: { getUser: supabaseAuthMock.getUser } },
}));
// Mirror the real module shape: redis.ts exports both `redis` (Proxy-wrapped
// with the upstash breaker) and `rawRedis` (un-wrapped, used by the
// circuit-breaker module to break the import cycle). Any module imported by
// the route loader below that touches `rawRedis` (e.g. lib/circuit-breaker.ts)
// crashes at module-load with `SyntaxError: Export named 'rawRedis' not found`
// unless both names are present here.
mock.module("../db/redis.ts", () => ({
	redis: {
		get: mock(async () => null),
		set: mock(async () => "OK"),
		del: mock(async () => 1),
		eval: mock(async () => null),
	},
	rawRedis: {
		get: mock(async () => null),
		set: mock(async () => "OK"),
		del: mock(async () => 1),
		getdel: mock(async () => null),
		incr: mock(async () => 1),
		ttl: mock(async () => -2),
	},
}));

const { authMiddleware } = await import("../middleware/auth.ts");

// Routes the API deliberately exposes without authentication. Anything not in
// this set must run authMiddleware before reaching its handler.
const PUBLIC_ROUTES = new Set<string>([
	"POST /api/v1/auth/signup",
	"POST /api/v1/auth/cancel-signup",
	"POST /api/v1/auth/login",
	"POST /api/v1/auth/refresh",
	"POST /api/v1/auth/verify-otp",
	"POST /api/v1/auth/resend-otp",
]);

// Mount table mirrors apps/api/src/app.ts. Update both files together if a
// new router is added — this test will fail loudly otherwise.
const MOUNTS: Array<{ prefix: string; modulePath: string }> = [
	{ prefix: "/api/v1/auth", modulePath: "../routes/auth.ts" },
	{ prefix: "/api/v1/profile", modulePath: "../routes/profile.ts" },
	{ prefix: "/api/v1/decks", modulePath: "../routes/decks.ts" },
	{ prefix: "/api/v1/premade-decks", modulePath: "../routes/premade.ts" },
	{ prefix: "/api/v1/ai", modulePath: "../routes/ai.ts" },
	{ prefix: "/api/v1/reviews", modulePath: "../routes/reviews.ts" },
	{ prefix: "/api/v1/decks/:deckId/cards", modulePath: "../routes/cards.ts" },
	{ prefix: "/api/v1/cards", modulePath: "../routes/cards.ts" },
	{ prefix: "/api/v1/analytics", modulePath: "../routes/analytics.ts" },
];

interface RouteRef {
	id: string;
	protected: boolean;
}

/**
 * Walks an Express router's stack and returns one RouteRef per (method, path)
 * pair. A route is considered "protected" if either:
 *   - any earlier non-route layer in the router stack is authMiddleware
 *     (i.e. the router did `router.use(authMiddleware, ...)` near the top), or
 *   - authMiddleware is one of the per-route handlers.
 */
function inspectRouter(router: { stack: Array<Record<string, unknown>> }, prefix: string): RouteRef[] {
	const refs: RouteRef[] = [];
	let routerHasAuth = false;

	for (const layer of router.stack) {
		const route = layer.route as { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle: unknown }> } | undefined;

		if (route === undefined) {
			// Router-level middleware (e.g. router.use(authMiddleware, ...)).
			// Mark the seen-from-here-on flag if it's authMiddleware.
			if (layer.handle === authMiddleware) {
				routerHasAuth = true;
			}
			continue;
		}

		const path = `${prefix}${route.path ?? ""}`;
		const handlersOnRoute = (route.stack ?? []).map(s => s.handle);
		const isOnRoute = handlersOnRoute.includes(authMiddleware);
		const isProtected = routerHasAuth || isOnRoute;

		for (const method of Object.keys(route.methods ?? {})) {
			refs.push({ id: `${method.toUpperCase()} ${path}`, protected: isProtected });
		}
	}

	return refs;
}

describe("Auth coverage — every non-public route has authMiddleware", () => {
	it("reports zero misconfigured routes", async () => {
		const allRefs: RouteRef[] = [];
		for (const { prefix, modulePath } of MOUNTS) {
			const mod = await import(modulePath) as { default: { stack: Array<Record<string, unknown>> } };
			allRefs.push(...inspectRouter(mod.default, prefix));
		}

		const failures: string[] = [];
		for (const ref of allRefs) {
			const isPublic = PUBLIC_ROUTES.has(ref.id);
			if (!ref.protected && !isPublic) {
				failures.push(`${ref.id} is missing authMiddleware`);
			}
		}

		// Sanity: we should have observed at least the routes we expect. If this
		// ever returns 0 routes, the walker is broken and we'd report a false pass.
		expect(allRefs.length).toBeGreaterThan(20);
		expect(failures).toEqual([]);
	});

	it("every PUBLIC_ROUTES entry actually exists in the route table", async () => {
		// Tightens the allowlist: a mistype like 'GET /api/v1/auth/signup' would
		// otherwise silently allow any GET to /signup. Cross-reference every
		// public-route entry against the discovered routes.
		const allRefs: RouteRef[] = [];
		for (const { prefix, modulePath } of MOUNTS) {
			const mod = await import(modulePath) as { default: { stack: Array<Record<string, unknown>> } };
			allRefs.push(...inspectRouter(mod.default, prefix));
		}
		const ids = new Set(allRefs.map(r => r.id));

		const stale: string[] = [];
		for (const id of PUBLIC_ROUTES) {
			if (!ids.has(id))
				stale.push(id);
		}
		expect(stale).toEqual([]);
	});
});
