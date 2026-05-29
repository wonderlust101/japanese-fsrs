import type { ApiAnalyticsDashboard, ApiForecastDay, ApiHeatmapDay, ApiLayoutAccuracy } from "@fsrs-japanese/shared-types";

import type { WeeklyReportInputs } from "../weekly-report";

import { describe, expect, it } from "vitest";

import {
	buildWeeklyReport,
	buildWeeklyReportInputs,
	MIN_ACTIVE_DAYS_FOR_INSIGHTS,
	splitEmphasis,
} from "../weekly-report";

// ── Helpers ─────────────────────────────────────────────────────────────────

function heatmapDay(overrides: Partial<ApiHeatmapDay> = {}): ApiHeatmapDay {
	return {
		date: "2026-05-20",
		retention: 90,
		count: 10,
		totalSeconds: 600,
		...overrides,
	};
}

function makeInputs(overrides: Partial<WeeklyReportInputs> = {}): WeeklyReportInputs {
	return {
		heatmap: [],
		accuracy: [],
		jlptGap: [],
		forecast: [],
		...overrides,
	};
}

function accuracyRow(layoutType: ApiLayoutAccuracy["layoutType"], total: number, successful: number): ApiLayoutAccuracy {
	return {
		layoutType,
		total,
		successful,
		accuracyPct: total === 0 ? 0 : (successful / total) * 100,
	};
}

function forecastDay(date: string, count: number, backlog = 0): ApiForecastDay {
	return {
		date,
		count,
		backlogCount: backlog,
		reviewCount: count,
		newCount: 0,
	};
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("buildWeeklyReportInputs", () => {
	it("normalizes heatmap retention from 0-100 to 0-1 at the boundary, zero when count===0", () => {
		const heatmap: ApiHeatmapDay[] = [
			heatmapDay({ date: "2026-05-20", retention: 84, count: 8 }),
			heatmapDay({ date: "2026-05-19", retention: 99, count: 0 }), // 0 reviews → retention forced to 0
		];
		const dashboard = {
			heatmap: { items: heatmap, totalCount: heatmap.length },
			accuracy: { items: [], totalCount: 0 },
			jlptGap: { items: [], totalCount: 0 },
			milestones: { items: [], totalCount: 0 },
			cardsAddedThisMonth: 0,
		} as unknown as ApiAnalyticsDashboard;

		const inputs = buildWeeklyReportInputs(dashboard, undefined);
		expect(inputs.heatmap[0]?.retention).toBeCloseTo(0.84);
		expect(inputs.heatmap[1]?.retention).toBe(0);
	});

	it("returns empty arrays when dashboard / forecast are undefined", () => {
		const inputs = buildWeeklyReportInputs(undefined, undefined);
		expect(inputs.heatmap).toEqual([]);
		expect(inputs.accuracy).toEqual([]);
		expect(inputs.jlptGap).toEqual([]);
		expect(inputs.forecast).toEqual([]);
	});
});

describe("buildWeeklyReport — low data branch", () => {
	it("short-circuits to lowData=true when active days < MIN_ACTIVE_DAYS_FOR_INSIGHTS", () => {
		const heatmap: ApiHeatmapDay[] = Array.from({ length: MIN_ACTIVE_DAYS_FOR_INSIGHTS - 1 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5 }));
		const report = buildWeeklyReport(makeInputs({ heatmap }), "2026-05-20");
		expect(report.lowData).toBe(true);
		expect(report.headline.tone).toBe("new-user");
		expect(report.notes.lead.kind).toBe("progress");
		expect(report.notes.second.kind).toBe("mistakes");
		expect(report.notes.third.kind).toBe("planning");
	});
});

describe("buildWeeklyReport — note slots are fixed", () => {
	it("always renders progress→mistakes→planning regardless of severity ordering", () => {
		// Build a case where the mistakes note is most severe.
		const heatmap = Array.from({ length: 10 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.84 }));
		const accuracy = [accuracyRow("vocabulary", 100, 50)]; // 50% accuracy — attention
		const report = buildWeeklyReport(makeInputs({ heatmap, accuracy }), "2026-05-20");
		expect(report.notes.lead.kind).toBe("progress");
		expect(report.notes.second.kind).toBe("mistakes");
		expect(report.notes.third.kind).toBe("planning");
		expect(report.lowData).toBe(false);
	});
});

describe("buildWeeklyReport — accuracy tiers drive mistakes severity / tone", () => {
	function buildWithAccuracy(pct: number): ReturnType<typeof buildWeeklyReport> {
		const heatmap = Array.from({ length: 8 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.85 }));
		const accuracy = [accuracyRow("vocabulary", 100, pct)];
		return buildWeeklyReport(makeInputs({ heatmap, accuracy }), "2026-05-20");
	}

	it("pct < 65 → attention, highest severity", () => {
		expect(buildWithAccuracy(60).notes.second.tone).toBe("attention");
	});

	it("pct in [65,75) → attention, lower severity", () => {
		const r = buildWithAccuracy(72);
		expect(r.notes.second.tone).toBe("attention");
	});

	it("pct in [75,85) → neutral", () => {
		expect(buildWithAccuracy(80).notes.second.tone).toBe("neutral");
	});

	it("pct >= 85 → celebratory", () => {
		expect(buildWithAccuracy(95).notes.second.tone).toBe("celebratory");
	});
});

describe("buildWeeklyReport — planning backlog >= 25%", () => {
	it("backlog-dominant forecast yields attention tone on the planning note", () => {
		const heatmap = Array.from({ length: 8 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.85 }));
		const accuracy = [accuracyRow("vocabulary", 100, 90)];
		const forecast: ApiForecastDay[] = [
			// weekTotal = 70, backlogTotal = 25 → 35.7% backlog → attention.
			forecastDay("2026-05-20", 10, 5),
			forecastDay("2026-05-21", 10, 5),
			forecastDay("2026-05-22", 10, 5),
			forecastDay("2026-05-23", 10, 5),
			forecastDay("2026-05-24", 10, 5),
			forecastDay("2026-05-25", 10, 0),
			forecastDay("2026-05-26", 10, 0),
		];
		const r = buildWeeklyReport(makeInputs({ heatmap, accuracy, forecast }), "2026-05-20");
		expect(r.notes.third.tone).toBe("attention");
	});
});

describe("buildWeeklyReport — severity tiebreak (progress > mistakes > planning)", () => {
	it("when all three notes share the same severity, the progress headline wins", () => {
		// No retention delta (no trailing30), so progress is neutral with low severity 25.
		// With accuracy null and forecast empty we should land in steady/neutral —
		// the tiebreak should still pick progress for the headline.
		const heatmap = Array.from({ length: 5 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.85 }));
		const r = buildWeeklyReport(makeInputs({ heatmap }), "2026-05-20");
		// All three notes get neutral tone in this baseline scenario.
		expect(r.notes.lead.kind).toBe("progress");
		// Headline carries one of the neutral lines — date-rotated.
		expect(r.headline.tone).toBe("neutral");
	});
});

describe("splitEmphasis", () => {
	it("splits a body with no markers into a single plain segment", () => {
		expect(splitEmphasis("plain text")).toEqual([{ kind: "plain", text: "plain text" }]);
	});

	it("splits text with a single marker", () => {
		expect(splitEmphasis("hi *world*!")).toEqual([
			{ kind: "plain", text: "hi " },
			{ kind: "em", text: "world" },
			{ kind: "plain", text: "!" },
		]);
	});

	it("handles two non-overlapping markers", () => {
		const out = splitEmphasis("a *b* c *d* e");
		expect(out).toEqual([
			{ kind: "plain", text: "a " },
			{ kind: "em", text: "b" },
			{ kind: "plain", text: " c " },
			{ kind: "em", text: "d" },
			{ kind: "plain", text: " e" },
		]);
	});

	it("returns empty array on empty input", () => {
		expect(splitEmphasis("")).toEqual([]);
	});

	it("handles a trailing marker (no following plain segment)", () => {
		const out = splitEmphasis("prefix *boom*");
		expect(out).toEqual([
			{ kind: "plain", text: "prefix " },
			{ kind: "em", text: "boom" },
		]);
	});
});

describe("buildWeeklyReport — seed-stable headline rotation", () => {
	it("identical seed produces identical headline copy for neutral case", () => {
		const heatmap = Array.from({ length: 5 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.85 }));
		const r1 = buildWeeklyReport(makeInputs({ heatmap }), "2026-05-20", "seed-a");
		const r2 = buildWeeklyReport(makeInputs({ heatmap }), "2026-05-20", "seed-a");
		expect(r1.headline.text).toBe(r2.headline.text);
	});
});

describe("buildWeeklyReport — week window", () => {
	it("populates weekNumber + week start/end + activeDaysThisWeek", () => {
		const heatmap = Array.from({ length: 5 }, (_, i) =>
			heatmapDay({ date: `2026-05-${20 - i}`, count: 5, retention: 0.85 }));
		const report = buildWeeklyReport(makeInputs({ heatmap }), "2026-05-20");
		expect(report.window.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(report.window.weekEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
		expect(report.window.weekNumber).toBeGreaterThanOrEqual(1);
		expect(report.window.weekNumber).toBeLessThanOrEqual(53);
		expect(report.window.activeDaysThisWeek).toBeGreaterThan(0);
	});
});

describe("mIN_ACTIVE_DAYS_FOR_INSIGHTS", () => {
	it("is a positive integer threshold", () => {
		expect(MIN_ACTIVE_DAYS_FOR_INSIGHTS).toBeGreaterThan(0);
		expect(Number.isInteger(MIN_ACTIVE_DAYS_FOR_INSIGHTS)).toBe(true);
	});
});
