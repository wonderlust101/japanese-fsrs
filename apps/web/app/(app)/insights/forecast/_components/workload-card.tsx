"use client";

import type { ApiForecastDay } from "@fsrs-japanese/shared-types";

import type { ForecastWindow } from "./ForecastWorkloadChart";

import { useMemo, useState } from "react";

import { ChartFigcaption, LegendSwatch } from "@/components/charts";
import { SectionCard } from "@/components/ui/SectionCard";

import { ChartRangeToggle } from "../../_components/ChartRangeToggle";
import {
	BACKLOG_FILL,
	ForecastWorkloadChart,
	NEW_FILL,
	REVIEW_FILL,

} from "./ForecastWorkloadChart";

interface WorkloadCardProps {
	forecast: ReadonlyArray<ApiForecastDay>;
}

/**
 * Window options for the shared ChartRangeToggle. Keys are stringified
 *  ForecastWindow values; the card converts back to a number on change.
 */
const WINDOW_OPTIONS = [
	{ key: "7", label: "7d" },
	{ key: "14", label: "14d" },
	{ key: "28", label: "28d" },
] as const;

/**
 * Upcoming workload section. SectionCard wrapping the forward-only stacked
 * forecast chart, with a 7 / 14 / 28 tab control in the header's right slot
 * and a quiet planning caption beneath the chart that interprets the
 * window's character (steady / heavy / light / backlog) for the learner.
 */
export function WorkloadCard({ forecast }: WorkloadCardProps): React.JSX.Element {
	const [windowDays, setWindowDays] = useState<ForecastWindow>(14);

	const caption = useMemo(() => buildPlanningCaption(forecast, windowDays), [forecast, windowDays]);
	const summary = useMemo(() => summarizeWindow(forecast, windowDays), [forecast, windowDays]);

	return (
		<SectionCard
			kanji="次"
			label="Upcoming load"
			rightContent={(
				<ChartRangeToggle
					label="Forecast window"
					options={WINDOW_OPTIONS}
					value={String(windowDays)}
					onChange={k => setWindowDays(Number(k) as ForecastWindow)}
				/>
			)}
		>
			<div className="pb-1 lg:py-2 xl:py-3">
				<ForecastWorkloadChart forecast={forecast} windowDays={windowDays} />
				<ChartFigcaption className="mt-4">
					<span>
						Daily load
						{" "}
						<span className="text-sumi-ink/70">·</span>
						{" "}
						next
						{windowDays}
						{" "}
						days
					</span>
					<span className="flex flex-wrap items-center gap-x-4 gap-y-1">
						<LegendSwatch color={NEW_FILL} label={`New ${summary.newTotal}`} />
						<LegendSwatch color={REVIEW_FILL} label={`Review ${summary.reviewTotal}`} />
						{summary.backlogTotal > 0 && (
							<LegendSwatch color={BACKLOG_FILL} label={`Backlog ${summary.backlogTotal}`} />
						)}
						<span className="text-sumi-ink/85">
							<span className="font-medium">{summary.total}</span>
							{" "}
							total
						</span>
					</span>
				</ChartFigcaption>
				<p className="mt-5 max-w-measure-wide text-sm leading-[1.55] text-faded-sumi">
					{caption}
				</p>
			</div>
		</SectionCard>
	);
}

// ── Window summary + planning caption ───────────────────────────────────────

interface WindowSummary {
	total: number;
	newTotal: number;
	reviewTotal: number;
	backlogTotal: number;
	peakCount: number;
	peakDate: string | null;
	averagePerDay: number;
}

function summarizeWindow(
	forecast: ReadonlyArray<ApiForecastDay>,
	windowDays: ForecastWindow,
): WindowSummary {
	const ordered = [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, windowDays);
	let total = 0; let newTotal = 0; let reviewTotal = 0; let backlogTotal = 0;
	let peakCount = 0;
	let peakDate: string | null = null;
	for (const d of ordered) {
		total += d.count;
		newTotal += d.newCount;
		reviewTotal += d.reviewCount;
		backlogTotal += d.backlogCount;
		if (d.count > peakCount) {
			peakCount = d.count;
			peakDate = d.date;
		}
	}
	const averagePerDay = ordered.length > 0 ? total / ordered.length : 0;
	return { total, newTotal, reviewTotal, backlogTotal, peakCount, peakDate, averagePerDay };
}

function dayName(iso: string): string {
	const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7;
	return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][dow] ?? "";
}

function buildPlanningCaption(
	forecast: ReadonlyArray<ApiForecastDay>,
	windowDays: ForecastWindow,
): string {
	const s = summarizeWindow(forecast, windowDays);
	if (s.total === 0) {
		return "Nothing scheduled in this window. Add new cards or run a review to start shaping the forecast.";
	}

	// Backlog dominates the period.
	if (s.backlogTotal >= s.total * 0.25 && s.backlogTotal > 0) {
		return `About ${Math.round((s.backlogTotal / s.total) * 100)}% of the next ${windowDays} days is backlog. Clearing the overdue cards first will make the rest feel lighter.`;
	}

	// Peak day is notably heavier than the window's average.
	if (s.peakDate !== null && s.peakCount >= s.averagePerDay * 1.5 && s.peakCount >= 30) {
		return `${dayName(s.peakDate)} is heavier than usual at ${s.peakCount} cards. Consider easing new cards the day before to keep the load steady.`;
	}

	// Heavy across the board.
	if (s.averagePerDay >= 40) {
		return `Heavier than usual ahead, averaging ${Math.round(s.averagePerDay)} cards per day. Pausing new cards for a few days would soften the curve.`;
	}

	// Light.
	if (s.averagePerDay < 12) {
		return `A light stretch, averaging ${Math.round(s.averagePerDay)} cards per day. There's room to add new material if you'd like.`;
	}

	// Steady.
	return `Steady stretch, averaging ${Math.round(s.averagePerDay)} cards per day. Nothing to rearrange.`;
}
