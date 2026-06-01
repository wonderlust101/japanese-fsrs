import type {
	ApiAnalyticsDashboard,
	ApiForecastDay,
	ApiHeatmapDay,
	ApiInsightsDistributions,
	ApiMaturitySnapshot,
} from "@fsrs-japanese/shared-types";

import { describe, expect, it } from "vitest";

import { makeDeck } from "@/test/factories";
import { adaptLiveStatistics, hasMeaningfulData } from "../adapt-live";

// ── Helpers ────────────────────────────────────────────────────────────────

function heatmapDay(overrides: Partial<ApiHeatmapDay> = {}): ApiHeatmapDay {
	return {
		date: "2026-05-20",
		retention: 90,
		count: 10,
		totalSeconds: 600,
		...overrides,
	};
}

function snapshot(overrides: Partial<ApiMaturitySnapshot> = {}): ApiMaturitySnapshot {
	return {
		date: "2026-05-20",
		newCount: 0,
		learningCount: 0,
		reviewCount: 0,
		relearningCount: 0,
		matureCount: 0,
		suspendedCount: 0,
		...overrides,
	};
}

function buildDashboard(items: ApiHeatmapDay[]): ApiAnalyticsDashboard {
	return {
		heatmap: { items, totalCount: items.length },
		accuracy: { items: [], totalCount: 0 },
		jlptGap: { items: [], totalCount: 0 },
		milestones: { items: [], totalCount: 0 },
		cardsAddedThisMonth: 0,
	} as unknown as ApiAnalyticsDashboard;
}

const EMPTY_DISTRIBUTIONS: ApiInsightsDistributions = {
	ratings: { again: 0, hard: 0, good: 0, easy: 0 },
	intervals: [],
	stability: [],
	difficulty: [],
};

// ── Activity / trueRetention weighting ─────────────────────────────────────

describe("adaptLiveStatistics — trueRetention is review-weighted", () => {
	it("100 reviews at 0.9 outweighs 1 review at 0.5", () => {
		const heatmap: ApiHeatmapDay[] = [
			heatmapDay({ date: "2026-05-19", count: 100, retention: 90 }),
			heatmapDay({ date: "2026-05-20", count: 1, retention: 50 }),
		];
		const result = adaptLiveStatistics({
			dashboard: buildDashboard(heatmap),
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		const expected = (0.9 * 100 + 0.5 * 1) / (100 + 1);
		expect(result.fsrs.trueRetention).toBeCloseTo(expected, 6);
	});

	it("excludes zero-count days from the trueRetention denominator", () => {
		const heatmap: ApiHeatmapDay[] = [
			heatmapDay({ date: "2026-05-19", count: 10, retention: 80 }),
			heatmapDay({ date: "2026-05-20", count: 0, retention: 100 }),
		];
		const result = adaptLiveStatistics({
			dashboard: buildDashboard(heatmap),
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.fsrs.trueRetention).toBeCloseTo(0.8, 6);
	});

	it("returns 0 trueRetention when no active days at all", () => {
		const heatmap: ApiHeatmapDay[] = [];
		const result = adaptLiveStatistics({
			dashboard: buildDashboard(heatmap),
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.fsrs.trueRetention).toBe(0);
	});
});

// ── retentionTarget ─────────────────────────────────────────────────────────

describe("adaptLiveStatistics — retentionTarget default = 0.88", () => {
	it("falls back to 0.88 when undefined or null", () => {
		const base = {
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		};
		expect(adaptLiveStatistics({ ...base, retentionTarget: undefined }).fsrs.desiredRetention).toBe(0.88);
		expect(adaptLiveStatistics({ ...base, retentionTarget: null }).fsrs.desiredRetention).toBe(0.88);
	});

	it("uses the supplied target when provided", () => {
		const r = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: 0.92,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(r.fsrs.desiredRetention).toBe(0.92);
	});
});

// ── adaptMaturity ───────────────────────────────────────────────────────────

describe("adaptLiveStatistics — maturity adaptation", () => {
	it("computes young = max(0, reviewCount - matureCount)", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: [snapshot({ reviewCount: 50, matureCount: 20 })],
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.maturity.young).toBe(30);
		expect(result.maturity.mature).toBe(20);
	});

	it("clamps young to 0 when mature >= review (defensive)", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: [snapshot({ reviewCount: 10, matureCount: 20 })],
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.maturity.young).toBe(0);
	});

	it("collapses learning + relearning into 'learning'", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: [snapshot({ learningCount: 3, relearningCount: 4 })],
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.maturity.learning).toBe(7);
	});

	it("returns zeroed maturity counts when history is empty", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: [],
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.maturity).toEqual({ new: 0, learning: 0, young: 0, mature: 0, suspended: 0 });
	});

	it("uses the latest-dated row even when input is unsorted", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: [
				snapshot({ date: "2026-05-10", newCount: 5 }),
				snapshot({ date: "2026-05-25", newCount: 99 }),
				snapshot({ date: "2026-05-15", newCount: 50 }),
			],
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.maturity.new).toBe(99);
	});
});

// ── adaptOverdue ────────────────────────────────────────────────────────────

describe("adaptLiveStatistics — adaptOverdue", () => {
	it("returns zeros when forecast is empty", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast: [],
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.overdue).toEqual({ overdueCount: 0, totalDueWeek: 0, overduePercent: 0 });
	});

	it("returns 0 overduePercent when totalDueWeek is 0", () => {
		const forecast: ApiForecastDay[] = [
			{ date: "2026-05-20", count: 0, backlogCount: 0, reviewCount: 0, newCount: 0 },
		];
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.overdue.overduePercent).toBe(0);
	});

	it("computes overduePercent = backlog(today) / sum(count over 7 days) * 100", () => {
		const forecast: ApiForecastDay[] = [
			{ date: "2026-05-20", count: 10, backlogCount: 4, reviewCount: 10, newCount: 0 },
			{ date: "2026-05-21", count: 10, backlogCount: 0, reviewCount: 10, newCount: 0 },
			{ date: "2026-05-22", count: 20, backlogCount: 0, reviewCount: 20, newCount: 0 },
		];
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.overdue.overdueCount).toBe(4);
		expect(result.overdue.totalDueWeek).toBe(40);
		expect(result.overdue.overduePercent).toBeCloseTo(10, 6);
	});
});

// ── adaptDecks / cumulative ─────────────────────────────────────────────────

describe("adaptLiveStatistics — deck projection sorts by totalCards desc", () => {
	it("orders decks largest-first by cardCount", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: [
				makeDeck({ id: "small", name: "small", cardCount: 1 }),
				makeDeck({ id: "huge", name: "huge", cardCount: 500 }),
				makeDeck({ id: "mid", name: "mid", cardCount: 100 }),
			],
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.decks.map(d => d.id)).toEqual(["huge", "mid", "small"]);
	});
});

describe("adaptLiveStatistics — cumulative due", () => {
	it("returns a running sum of forecast counts in ascending date order", () => {
		const forecast: ApiForecastDay[] = [
			{ date: "2026-05-22", count: 3, backlogCount: 0, reviewCount: 3, newCount: 0 },
			{ date: "2026-05-20", count: 1, backlogCount: 0, reviewCount: 1, newCount: 0 },
			{ date: "2026-05-21", count: 2, backlogCount: 0, reviewCount: 2, newCount: 0 },
		];
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.cumulative.map(c => c.cumulative)).toEqual([1, 3, 6]);
	});

	it("returns an empty array when forecast is empty", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast: [],
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(result.cumulative).toEqual([]);
	});
});

// ── hasMeaningfulData ───────────────────────────────────────────────────────

describe("hasMeaningfulData", () => {
	it("false when totalReviews === 0", () => {
		const result = adaptLiveStatistics({
			dashboard: undefined,
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(hasMeaningfulData(result)).toBe(false);
	});

	it("true once any active days have been logged", () => {
		const heatmap: ApiHeatmapDay[] = [
			heatmapDay({ date: "2026-05-20", count: 1, retention: 100 }),
		];
		const result = adaptLiveStatistics({
			dashboard: buildDashboard(heatmap),
			maturityHistory: undefined,
			decks: undefined,
			forecast: undefined,
			retentionTarget: undefined,
			distributions: EMPTY_DISTRIBUTIONS,
		});
		expect(hasMeaningfulData(result)).toBe(true);
	});
});
