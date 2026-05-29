import { http, HttpResponse } from "msw";

import { defaultHandlers } from "./handlers/index";

/**
 * Default MSW handler set.
 *
 * The per-resource defaults in `./handlers/*.ts` cover happy-path GETs and
 * canonical mutations (auth, decks, cards, reviews, insights). A test that
 * needs a specific failure mode or a richer fixture overrides with
 * `server.use(...)` and a named helper from the same module — e.g.
 * `server.use(mockLoginInvalidCredentials())`.
 *
 * The health-check handler stays inline because it isn't per-resource and
 * is small enough that putting it in its own module is more navigation
 * cost than reuse.
 *
 * The API base is `http://localhost:3001` in dev (`NEXT_PUBLIC_API_URL` in
 * `apps/web/.env.local`). MSW intercepts at the `fetch` boundary regardless
 * of base URL, so we glob the path.
 */
export const handlers = [
	// Healthcheck — some tests may indirectly poke it; default to OK so it's
	// never the failure under investigation.
	http.get("*/api/v1/health", () => {
		return HttpResponse.json({ ok: true });
	}),
	...defaultHandlers,
];
