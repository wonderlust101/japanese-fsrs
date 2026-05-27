"use client";

import type {
	ApiForecastDay,
	ApiHeatmapDay,
	ApiJlptGap,
	ApiLayoutAccuracy,
} from "@fsrs-japanese/shared-types";

import type { WeeklyReportInputs } from "@/app/(app)/insights/_components/weekly-report";

import type { DevFixtureSpec } from "@/dev";

import { useMemo } from "react";
import { useDevStatePanel } from "@/dev";

// ── Public hook ──────────────────────────────────────────────────────────────

export type InsightsFixtureKey
	= | "off"
		| "attention"
		| "calm"
		| "low-data"
		| "loading"
		| "error";

export interface InsightsDevState {
	/** Fixture-derived report inputs, or null to use live data. */
	fixtureInputs: WeeklyReportInputs | null;
	/** Pinned today date for the fixture, or null to use real today. */
	todayIso: string | null;
	/** Seed for date-rotated copy, or null to use today. */
	seed: string | null;
	/** Force a loading or error state regardless of live query state. */
	forcedState: "loading" | "error" | null;
}

const FIXTURE_TODAY = "2026-05-16";

const FIXTURES: ReadonlyArray<DevFixtureSpec<InsightsFixtureKey>> = [
	{ key: "off", label: "Off", description: "Live data — render the real report." },
	{ key: "attention", label: "Attention week", description: "Accuracy slipped to 72%. Mistakes leads." },
	{ key: "calm", label: "Celebratory week", description: "Retention stepped up to 91%. Progress leads." },
	{ key: "low-data", label: "New user · low data", description: "Two active days. Empty state with kitsune." },
	{ key: "loading", label: "Loading skeleton", description: "Show the full-page skeleton." },
	{ key: "error", label: "Error state", description: "Show the inline error alert." },
];

/**
 * Insights Overview dev state. Outside development the hook still runs but
 * the dock never mounts, so `fixtureInputs` stays null and the page renders
 * live data exclusively.
 */
export function useInsightsDevState(): InsightsDevState {
	const { fixture } = useDevStatePanel({
		id: "insights.overview",
		title: "Insights · Overview",
		fixtures: FIXTURES,
		defaultFixture: "off",
	});

	const fixtureInputs = useMemo<WeeklyReportInputs | null>(() => {
		if (fixture === "attention")
			return buildAttentionWeekInputs(FIXTURE_TODAY);
		if (fixture === "calm")
			return buildCalmWeekInputs(FIXTURE_TODAY);
		if (fixture === "low-data")
			return buildLowDataInputs(FIXTURE_TODAY);
		return null;
	}, [fixture]);

	const forcedState: "loading" | "error" | null
		= fixture === "loading"
			? "loading"
			: fixture === "error"
				? "error"
				: null;

	return {
		fixtureInputs,
		todayIso: fixtureInputs !== null ? FIXTURE_TODAY : null,
		seed: fixtureInputs !== null ? fixture : null,
		forcedState,
	};
}

// ── Fixture builders (preserved verbatim from the original dev panel) ────────

function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, n: number): string {
	const d = parseIso(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

function generateHeatmap(
	todayIso: string,
	days: number,
	shape: (i: number) => { retention: number; count: number },
): ApiHeatmapDay[] {
	const out: ApiHeatmapDay[] = [];
	for (let i = days - 1; i >= 0; i -= 1) {
		const date = addDays(todayIso, -i);
		const { retention, count } = shape(i);
		// Dev fixture rows zero-fill totalSeconds; the real wire shape carries
		// SUM(review_time_ms)/1000 per heatmap day.
		out.push({ date, retention, count, totalSeconds: 0 });
	}
	return out;
}

function generateForecast(
	todayIso: string,
	days: number,
	shape: (i: number) => { newCount: number; reviewCount: number; backlogCount: number },
): ApiForecastDay[] {
	const out: ApiForecastDay[] = [];
	for (let i = 0; i < days; i += 1) {
		const date = addDays(todayIso, i);
		const { newCount, reviewCount, backlogCount } = shape(i);
		out.push({
			date,
			count: newCount + reviewCount + backlogCount,
			newCount,
			reviewCount,
			backlogCount,
		});
	}
	return out;
}

/** Attention week: overall accuracy is weak; Mistakes leads. */
function buildAttentionWeekInputs(todayIso: string): WeeklyReportInputs {
	const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 30, (i) => {
		const seed = (i * 53) % 7;
		const ret = 0.72 + (seed - 3) * 0.03;
		const count = i % 5 === 0 ? 0 : 18 + (i % 4) * 3;
		return { retention: ret, count };
	});

	const accuracy: ApiLayoutAccuracy[] = [
		{ layoutType: "vocabulary", total: 302, successful: 218, accuracyPct: 72 },
	];

	const jlptGap: ApiJlptGap[] = [
		{ jlptLevel: "N5", total: 800, learned: 768, due: 24, progressPct: 96 },
		{ jlptLevel: "N4", total: 600, learned: 480, due: 18, progressPct: 80 },
		{ jlptLevel: "N3", total: 1850, learned: 612, due: 32, progressPct: 33 },
	];

	const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, i => ({
		newCount: i < 7 ? 12 : 10,
		reviewCount: i < 7 ? 28 + (i % 3) * 4 : 22,
		backlogCount: 0,
	}));

	return { heatmap, accuracy, jlptGap, forecast };
}

/** Celebratory week: retention up; Progress leads. */
function buildCalmWeekInputs(todayIso: string): WeeklyReportInputs {
	const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 30, (i) => {
		const isRecent = i < 7;
		const baseline = isRecent ? 0.91 : 0.81;
		const seed = (i * 41) % 5;
		const ret = baseline + (seed - 2) * 0.010;
		const count = isRecent ? 26 + (i % 4) * 4 : i % 5 === 0 ? 0 : 22 + (i % 4) * 3;
		return { retention: ret, count };
	});

	const accuracy: ApiLayoutAccuracy[] = [
		{ layoutType: "vocabulary", total: 510, successful: 458, accuracyPct: 90 },
	];

	const jlptGap: ApiJlptGap[] = [
		{ jlptLevel: "N5", total: 800, learned: 800, due: 0, progressPct: 100 },
		{ jlptLevel: "N4", total: 600, learned: 540, due: 14, progressPct: 90 },
		{ jlptLevel: "N3", total: 1850, learned: 860, due: 26, progressPct: 46 },
	];

	const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, i => ({
		newCount: 8,
		reviewCount: 18 + (i % 4) * 2,
		backlogCount: 0,
	}));

	return { heatmap, accuracy, jlptGap, forecast };
}

/** New user with only two active days. Drives the empty state. */
function buildLowDataInputs(todayIso: string): WeeklyReportInputs {
	const heatmap: ApiHeatmapDay[] = generateHeatmap(todayIso, 14, (i) => {
		if (i >= 12)
			return { retention: 0.78, count: 12 };
		return { retention: 0, count: 0 };
	});

	const accuracy: ApiLayoutAccuracy[] = [
		{ layoutType: "vocabulary", total: 14, successful: 11, accuracyPct: 79 },
	];

	const jlptGap: ApiJlptGap[] = [
		{ jlptLevel: "N5", total: 800, learned: 12, due: 8, progressPct: 1 },
	];

	const forecast: ApiForecastDay[] = generateForecast(todayIso, 14, i => ({
		newCount: i < 5 ? 5 : 0,
		reviewCount: i < 5 ? 4 : 0,
		backlogCount: 0,
	}));

	return { heatmap, accuracy, jlptGap, forecast };
}
