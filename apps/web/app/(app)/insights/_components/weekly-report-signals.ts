// Derived analytical signals for the weekly report: retention means,
// overall accuracy, the forecast window, and load characterization.
// Lifted out of weekly-report.ts.

import type { ApiForecastDay, ApiHeatmapDay, ApiLayoutAccuracy } from "@fsrs-japanese/shared-types";

import type { WeeklyReportInputs } from "./weekly-report-types";
import { sortByDateAsc } from "./weekly-report-dates";

const MIN_LAYOUT_REVIEWS = 10;

function activeDays(h: ReadonlyArray<ApiHeatmapDay>): number {
	return h.filter(d => d.count > 0).length;
}

function meanRetention(
	h: ReadonlyArray<ApiHeatmapDay>,
	windowSize: number,
	min: number,
): number | null {
	const recent = [...h]
		.sort((a, b) => (a.date < b.date ? 1 : -1))
		.filter(d => d.count > 0)
		.slice(0, windowSize);
	if (recent.length < min)
		return null;
	return recent.reduce((acc, d) => acc + d.retention, 0) / recent.length;
}

interface OverallAccuracy {
	total: number;
	pct: number;
}

/**
 * Single overall-accuracy stat across every accuracy bucket the API
 * returns. The report sums the buckets and speaks about reviews uniformly,
 * since the product surfaces a single review mode rather than separate
 * modality concepts.
 */
function overallAccuracy(a: ReadonlyArray<ApiLayoutAccuracy>): OverallAccuracy | null {
	let total = 0;
	let successful = 0;
	for (const row of a) {
		total += row.total;
		successful += row.successful;
	}
	if (total < MIN_LAYOUT_REVIEWS)
		return null;
	return { total, pct: (successful / total) * 100 };
}

interface ForecastWindow {
	values: number[];
	tomorrow: number;
	weekTotal: number;
	peak: number;
	backlogPct: number;
}

function forecastWindow(forecast: ReadonlyArray<ApiForecastDay>): ForecastWindow {
	const sorted = sortByDateAsc(forecast).slice(0, 14);
	const values = sorted.map(d => d.count);
	const tomorrow = values[1] ?? values[0] ?? 0;
	const weekTotal = values.slice(0, 7).reduce((a, b) => a + b, 0);
	const peak = Math.max(0, ...values);
	const backlogTotal = sorted.slice(0, 7).reduce((a, d) => a + d.backlogCount, 0);
	const backlogPct = weekTotal > 0 ? backlogTotal / weekTotal : 0;
	return { values, tomorrow, weekTotal, peak, backlogPct };
}

export function loadCharacter(weekTotal: number): "light" | "steady" | "heavy" {
	if (weekTotal < 60)
		return "light";
	if (weekTotal < 250)
		return "steady";
	return "heavy";
}

export function loadPhrase(c: "light" | "steady" | "heavy"): string {
	if (c === "light")
		return "a light week";
	if (c === "heavy")
		return "a heavier week than usual";
	return "a steady week";
}

// ── Note builders ────────────────────────────────────────────────────────────

export interface DerivedSignals {
	recent7: number | null;
	trailing30: number | null;
	retentionDelta: number | null;
	accuracy: OverallAccuracy | null;
	forecast: ForecastWindow;
	reviewedTotal: number;
	activeDayCount: number;
}

export function deriveSignals(
	inputs: WeeklyReportInputs,
): DerivedSignals {
	const recent7 = meanRetention(inputs.heatmap, 7, 3);
	const trailing30 = meanRetention(inputs.heatmap, 30, 7);
	return {
		recent7,
		trailing30,
		retentionDelta: recent7 !== null && trailing30 !== null ? recent7 - trailing30 : null,
		accuracy: overallAccuracy(inputs.accuracy),
		forecast: forecastWindow(inputs.forecast),
		reviewedTotal: inputs.heatmap.reduce((acc, d) => acc + d.count, 0),
		activeDayCount: activeDays(inputs.heatmap),
	};
}
