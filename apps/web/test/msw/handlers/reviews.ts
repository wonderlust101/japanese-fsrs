/**
 * MSW handlers for `/api/v1/reviews/*`.
 *
 * Endpoints covered:
 *   • GET  /api/v1/reviews/due                           — review queue
 *   • POST /api/v1/reviews/submit                        — submit a single rating
 *   • GET  /api/v1/reviews/session-summary/:sessionId    — post-session summary
 *   • GET  /api/v1/reviews/day-reflection/:sessionId     — AI day reflection
 *   • GET  /api/v1/reviews/:cardId/preview               — rate preview ("next intervals")
 *
 * The submit handler is intentionally permissive (it ignores the body) —
 * tests assert against `req.bodyUsed` or via spies, not against schema
 * validation here.
 */

import type {
	ApiDayReflection,
	ApiRatingsPreview,
	ApiReviewedCard,
	SessionSummary,
} from "@fsrs-japanese/shared-types";
import type { HttpHandler } from "msw";

import { http, HttpResponse } from "msw";

import { makeDueCard } from "../../factories/card";
import { makeRatingsPreview, makeReviewLog, makeSessionSummary } from "../../factories/review";

interface ListEnvelope<T> {
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
}

function envelope<T>(items: T[]): ListEnvelope<T> {
	return { items, nextCursor: null, hasMore: false };
}

const DEFAULT_DAY_REFLECTION: ApiDayReflection = {
	body: "Solid session. Your again-rate on counter words is trending down — that pattern is finally sticking.",
	source: "fallback",
	dateKey: "2026-05-27",
	sessionCount: 1,
};

// ─── Happy-path defaults ────────────────────────────────────────────────────

const reviewsHandlers: HttpHandler[] = [
	http.get("*/api/v1/reviews/due", () => HttpResponse.json(envelope([makeDueCard()]))),

	http.post("*/api/v1/reviews/submit", () => HttpResponse.json(makeReviewLog())),

	http.get("*/api/v1/reviews/session-summary/:sessionId", ({ params }) => HttpResponse.json(
		makeSessionSummary({ sessionId: String(params.sessionId) }),
	)),

	http.get("*/api/v1/reviews/day-reflection/:sessionId", () => HttpResponse.json(DEFAULT_DAY_REFLECTION)),

	http.get("*/api/v1/reviews/:cardId/preview", () => HttpResponse.json(makeRatingsPreview())),
];

export default reviewsHandlers;

// ─── Named per-test helpers ─────────────────────────────────────────────────

export function mockDueQueueSuccess(items: ReturnType<typeof makeDueCard>[] = [makeDueCard()]): HttpHandler {
	return http.get("*/api/v1/reviews/due", () => HttpResponse.json(envelope(items)));
}

export function mockDueQueueEmpty(): HttpHandler {
	return http.get("*/api/v1/reviews/due", () => HttpResponse.json(envelope<ReturnType<typeof makeDueCard>>([])));
}

export function mockSubmitReviewSuccess(card: ApiReviewedCard = makeReviewLog()): HttpHandler {
	return http.post("*/api/v1/reviews/submit", () => HttpResponse.json(card));
}

export function mockSubmitReviewServerError(): HttpHandler {
	return http.post("*/api/v1/reviews/submit", () => HttpResponse.json(
		{ error: "Internal server error", code: "INTERNAL_ERROR" },
		{ status: 500 },
	));
}

export function mockSessionSummarySuccess(summary: SessionSummary = makeSessionSummary()): HttpHandler {
	return http.get("*/api/v1/reviews/session-summary/:sessionId", () => HttpResponse.json(summary));
}

export function mockSessionSummaryNotFound(): HttpHandler {
	return http.get("*/api/v1/reviews/session-summary/:sessionId", () => HttpResponse.json(
		{ error: "Session not found", code: "SESSION_NOT_FOUND" },
		{ status: 404 },
	));
}

export function mockDayReflectionSuccess(reflection: ApiDayReflection = DEFAULT_DAY_REFLECTION): HttpHandler {
	return http.get("*/api/v1/reviews/day-reflection/:sessionId", () => HttpResponse.json(reflection));
}

export function mockRatingsPreviewSuccess(preview: ApiRatingsPreview = makeRatingsPreview()): HttpHandler {
	return http.get("*/api/v1/reviews/:cardId/preview", () => HttpResponse.json(preview));
}
