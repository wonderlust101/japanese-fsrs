/**
 * MSW handlers for the insights / progress / statistics endpoints.
 *
 * Endpoints covered:
 *   • GET /api/v1/insights/maturity-history?days=…    — stacked-area pipeline
 *   • GET /api/v1/insights/distributions              — ratings + interval / stability / difficulty histograms
 *   • GET /api/v1/analytics/dashboard                 — heatmap / accuracy / jlpt-gap / milestones bundle
 *   • GET /api/v1/reviews/forecast                    — upcoming-due forecast
 *
 * The task brief references `/insights/statistics`; the live route is
 * `/api/v1/analytics/dashboard`. The bundle endpoint shape (the four
 * sub-arrays plus `cardsAddedThisMonth`) is what the Statistics page
 * consumes, so it's modelled here.
 */

import type {
	ApiAnalyticsDashboard,
	ApiForecastDay,
	ApiInsightsDistributions,
	ApiMaturitySnapshot,
} from "@fsrs-japanese/shared-types";
import type { HttpHandler } from "msw";

import { http, HttpResponse } from "msw";

interface ListEnvelope<T> {
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
}

function envelope<T>(items: T[]): ListEnvelope<T> {
	return { items, nextCursor: null, hasMore: false };
}

const DEFAULT_MATURITY_SNAPSHOT: ApiMaturitySnapshot = {
	date: "2026-05-27",
	newCount: 5,
	learningCount: 2,
	reviewCount: 30,
	relearningCount: 1,
	matureCount: 12,
	suspendedCount: 0,
};

const DEFAULT_DISTRIBUTIONS: ApiInsightsDistributions = {
	ratings: { again: 1, hard: 1, good: 6, easy: 2 },
	intervals: [
		{ label: "<1d", count: 3 },
		{ label: "1-7d", count: 8 },
		{ label: "7-30d", count: 5 },
		{ label: "30d+", count: 2 },
	],
	stability: [
		{ label: "0-1", count: 3 },
		{ label: "1-7", count: 8 },
		{ label: "7-30", count: 5 },
		{ label: "30+", count: 2 },
	],
	difficulty: [
		{ label: "easy", count: 6 },
		{ label: "medium", count: 10 },
		{ label: "hard", count: 2 },
	],
};

const DEFAULT_DASHBOARD: ApiAnalyticsDashboard = {
	heatmap: envelope([{ date: "2026-05-27", retention: 0.9, count: 10, totalSeconds: 320 }]),
	accuracy: envelope([{ layoutType: "vocabulary", total: 10, successful: 8, accuracyPct: 80 }]),
	jlptGap: envelope([{ jlptLevel: "N5", total: 800, learned: 50, due: 12, progressPct: 6.25 }]),
	milestones: envelope([{
		jlptLevel: "N5",
		total: 800,
		learned: 50,
		dailyPace: 10,
		daysRemaining: 75,
		projectedCompletionDate: "2026-08-10",
	}]),
	cardsAddedThisMonth: 50,
};

const DEFAULT_FORECAST: ApiForecastDay[] = [
	{ date: "2026-05-28", count: 12, backlogCount: 0, reviewCount: 10, newCount: 2 },
	{ date: "2026-05-29", count: 8, backlogCount: 0, reviewCount: 7, newCount: 1 },
];

// ─── Happy-path defaults ────────────────────────────────────────────────────

const insightsHandlers: HttpHandler[] = [
	http.get("*/api/v1/insights/maturity-history", () => HttpResponse.json(
		envelope([DEFAULT_MATURITY_SNAPSHOT]),
	)),

	http.get("*/api/v1/insights/distributions", () => HttpResponse.json(DEFAULT_DISTRIBUTIONS)),

	http.get("*/api/v1/analytics/dashboard", () => HttpResponse.json(DEFAULT_DASHBOARD)),

	http.get("*/api/v1/reviews/forecast", () => HttpResponse.json(envelope(DEFAULT_FORECAST))),
];

export default insightsHandlers;

// ─── Named per-test helpers ─────────────────────────────────────────────────

export function mockMaturityHistorySuccess(
	snapshots: ApiMaturitySnapshot[] = [DEFAULT_MATURITY_SNAPSHOT],
): HttpHandler {
	return http.get("*/api/v1/insights/maturity-history", () => HttpResponse.json(envelope(snapshots)));
}

export function mockMaturityHistoryEmpty(): HttpHandler {
	return http.get("*/api/v1/insights/maturity-history", () => HttpResponse.json(
		envelope<ApiMaturitySnapshot>([]),
	));
}

export function mockDistributionsSuccess(distributions: ApiInsightsDistributions = DEFAULT_DISTRIBUTIONS): HttpHandler {
	return http.get("*/api/v1/insights/distributions", () => HttpResponse.json(distributions));
}

export function mockStatisticsSuccess(dashboard: ApiAnalyticsDashboard = DEFAULT_DASHBOARD): HttpHandler {
	return http.get("*/api/v1/analytics/dashboard", () => HttpResponse.json(dashboard));
}

export function mockForecastSuccess(days: ApiForecastDay[] = DEFAULT_FORECAST): HttpHandler {
	return http.get("*/api/v1/reviews/forecast", () => HttpResponse.json(envelope(days)));
}

export function mockForecastEmpty(): HttpHandler {
	return http.get("*/api/v1/reviews/forecast", () => HttpResponse.json(envelope<ApiForecastDay>([])));
}
