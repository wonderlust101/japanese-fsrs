// Current-week-window construction for the weekly Overview report. The
// underlying UTC-day ISO primitives (parseIso / addDays) come from
// @/components/charts/dates, which is the shared home for date math across
// the insights surfaces.

import type { ApiHeatmapDay } from "@fsrs-japanese/shared-types";

import type { WeekWindow } from "./weekly-report-types";

import { addDays, parseIso as parseIsoDate } from "@/components/charts/dates";

/** Returns 0=Mon … 6=Sun (ISO weekday minus 1). */
function isoWeekday(iso: string): number {
	const day = parseIsoDate(iso).getUTCDay();
	return (day + 6) % 7;
}

/** ISO 8601 week number for the given date. */
function isoWeekNumber(iso: string): number {
	const d = parseIsoDate(iso);
	// Thursday in current week decides the year.
	d.setUTCDate(d.getUTCDate() + 4 - ((d.getUTCDay() + 6) % 7 || 7));
	const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
	return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function buildWeekWindow(todayIso: string, heatmap: ReadonlyArray<ApiHeatmapDay>): WeekWindow {
	const dow = isoWeekday(todayIso);
	const weekStart = addDays(todayIso, -dow);
	const weekEnd = addDays(weekStart, 6);
	const inRange = (d: string): boolean => d >= weekStart && d <= weekEnd;
	const activeDaysThisWeek = heatmap.filter(d => inRange(d.date) && d.count > 0).length;
	return {
		weekStart,
		weekEnd,
		weekNumber: isoWeekNumber(todayIso),
		activeDaysThisWeek,
	};
}

export function sortByDateAsc<T extends { date: string }>(xs: ReadonlyArray<T>): T[] {
	return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1));
}
