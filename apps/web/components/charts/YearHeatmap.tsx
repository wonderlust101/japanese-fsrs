"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { AxisText } from "./primitives";
import { ScrollableChartFrame } from "./ScrollableChartFrame";

/**
 * One day in the year grid. Both the Progress `HeatmapCell` and the Statistics
 * `ActivityDay` structurally satisfy this, so either feed can drive the chart
 * without a transform at the call site.
 */
export interface HeatmapDay {
	/** ISO date `YYYY-MM-DD`. */
	date: string;
	/** Reviews completed that day. */
	count: number;
	/** Retention for the day, 0–1; 0 when no reviews. */
	retention: number;
}

interface YearHeatmapProps {
	days: ReadonlyArray<HeatmapDay>;
}

const CELL = 12; // viewBox units per cell
const GAP = 3;
const ROW_GAP = 3;
const PAD_L = 4; // left margin (day-of-week labels removed)
const PAD_T = 22; // room for month labels
const PAD_R = 4;
const PAD_B = 4;

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * Vermillion-deep at a given alpha, token-driven so the ramp follows the
 *  brand color rather than a duplicated RGB literal.
 */
function vermillionAlpha(alpha: number): string {
	return `color-mix(in oklch, var(--color-inari-vermillion-deep) ${Math.round(alpha * 100)}%, transparent)`;
}

function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

/** UTC midnight today, matching the RPC's UTC date bucketing. */
function todayUtc(): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** ISO `YYYY-MM-DD` for a UTC date. */
function isoOf(d: Date): string {
	return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
	const out = new Date(d);
	out.setUTCDate(out.getUTCDate() + n);
	return out;
}

/** 0=Mon, 6=Sun */
function isoDow(d: Date): number {
	return (d.getUTCDay() + 6) % 7;
}

/** Fill for a cell on a vermillion alpha ramp; empty days use the hairline. */
function cellFill(day: HeatmapDay | null, max: number): string {
	if (day === null || day.count === 0)
		return "var(--color-soft-hairline)";
	if (max === 0)
		return "var(--color-soft-hairline)";
	const ratio = Math.min(1, day.count / max);
	// 5-step ramp: 0.2 → 1.0
	return vermillionAlpha(0.2 + ratio * 0.8);
}

/** Screen-reader label for a single day cell. */
function cellLabel(day: HeatmapDay): string {
	const date = parseIso(day.date).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
	if (day.count === 0)
		return `${date}: no reviews`;
	return `${date}: ${day.count} review${day.count === 1 ? "" : "s"}, ${Math.round(day.retention * 100)}% retention`;
}

interface SelectedCell {
	day: HeatmapDay;
	week: number;
	row: number;
	/** Index into the padded `cells` array, for grid navigation. */
	i: number;
}

/**
 * Calendar-year heatmap: one column per week, one row per weekday, spanning the
 * full current year (Jan 1 → Dec 31). Each cell is a day, colored on a
 * vermillion alpha ramp relative to the learner's own peak day. Month labels
 * run along the top at month boundaries. Days after today and zero-review days
 * render as the soft hairline so the year grid stays complete without competing
 * with data.
 *
 * The shared year-grid for the Insights surfaces (Progress cadence, Statistics
 * activity). It unifies two near-identical hand-rolled grids that had drifted
 * apart on cell size, week-start, color ramp, and chrome; the canonical look is
 * the figure + figcaption legend with a relative ramp, plus full touch support
 * (tap a day, tap outside to dismiss) so the chart works without a hover.
 *
 * The API returns one row per *active* day (it groups review_logs by date), so
 * zero-review days are simply absent. The grid is densified against the full
 * calendar year and each day is placed into its real slot.
 *
 * Deliberate omissions per IA: no streak counter, no "longest streak" badge,
 * no flame icons. Just the grid.
 */
export function YearHeatmap({ days }: YearHeatmapProps): React.JSX.Element | null {
	const [sel, setSel] = useState<SelectedCell | null>(null);
	const gridId = useId();
	const svgRef = useRef<SVGSVGElement | null>(null);

	// Touch parity: a pinned cell (set by tap) stays open until the user taps
	// outside the grid. Without this, touch users get no tooltip at all, since
	// there is no hover on touch. Mouse hover and keyboard still drive `sel`
	// directly.
	useEffect(() => {
		if (sel === null)
			return;
		const onPointerDown = (e: PointerEvent): void => {
			if (svgRef.current !== null && !svgRef.current.contains(e.target as Node)) {
				setSel(null);
			}
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [sel]);

	const model = useMemo(() => {
		if (days.length === 0)
			return null;

		const byDate = new Map<string, HeatmapDay>(days.map(d => [d.date, d]));

		const year = todayUtc().getUTCFullYear();
		const start = new Date(Date.UTC(year, 0, 1)); // Jan 1
		const end = new Date(Date.UTC(year, 11, 31)); // Dec 31
		const windowDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

		// One synthetic zero-count entry per day in the year; real data overrides.
		const dense: HeatmapDay[] = [];
		for (let i = 0; i < windowDays; i += 1) {
			const date = isoOf(addDays(start, i));
			dense.push(byDate.get(date) ?? { date, count: 0, retention: 0 });
		}

		// Align so the leftmost column starts on the weekday of Jan 1.
		const firstDow = isoDow(start);
		const cells: Array<HeatmapDay | null> = Array.from({ length: firstDow }, () => null);
		cells.push(...dense);
		// Pad to a multiple of 7 so the grid is rectangular.
		while (cells.length % 7 !== 0) cells.push(null);

		const weeks = cells.length / 7;
		const max = Math.max(0, ...dense.map(d => d.count));

		// Month-label positions: where the month changes in column 0 of each week.
		const monthMarks: Array<{ week: number; month: number }> = [];
		for (let w = 0; w < weeks; w += 1) {
			const cell = cells[w * 7];
			if (cell === null || cell === undefined)
				continue;
			const d = parseIso(cell.date);
			if (d.getUTCDate() <= 7)
				monthMarks.push({ week: w, month: d.getUTCMonth() });
		}

		const totalReviews = dense.reduce((acc, d) => acc + d.count, 0);
		const activeDays = dense.filter(d => d.count > 0).length;

		return { cells, weeks, max, monthMarks, totalReviews, activeDays };
	}, [days]);

	if (model === null)
		return null;

	const { cells, weeks, max, monthMarks, totalReviews, activeDays } = model;

	const viewW = PAD_L + weeks * (CELL + GAP) - GAP + PAD_R;
	const viewH = PAD_T + 7 * (CELL + ROW_GAP) - ROW_GAP + PAD_B;

	const xFor = (week: number): number => PAD_L + week * (CELL + GAP);
	const yFor = (row: number): number => PAD_T + row * (CELL + ROW_GAP);

	const ariaLabel = `Year activity heatmap. ${totalReviews} total reviews across ${activeDays} active days. Peak day: ${max} reviews. Use the arrow keys to move between days, or tap a day on touch.`;

	const cellId = (i: number): string => `${gridId}-c-${i}`;
	const isReal = (i: number): boolean => i >= 0 && i < cells.length && cells[i] != null;
	const selectAt = (i: number): void => {
		const cell = cells[i];
		if (cell == null)
			return;
		setSel({ day: cell, week: Math.floor(i / 7), row: i % 7, i });
	};

	// First/last real cell, for Home/End and the initial focus target.
	let firstRealI = -1;
	let lastRealI = -1;
	for (let i = 0; i < cells.length; i += 1) {
		if (cells[i] != null) {
			if (firstRealI < 0)
				firstRealI = i; lastRealI = i;
		}
	}

	// Roving-grid keyboard navigation: the grid is a single tab stop and the
	// arrow keys move an active descendant, rather than 365 individual stops.
	const handleKeyDown = (e: React.KeyboardEvent): void => {
		const cur = sel?.i ?? lastRealI;
		if (cur < 0)
			return;
		let target = cur;
		switch (e.key) {
			case "ArrowRight": target = cur + 7; break; // next week, same weekday
			case "ArrowLeft": target = cur - 7; break;
			case "ArrowDown": target = cur % 7 < 6 ? cur + 1 : cur; break;
			case "ArrowUp": target = cur % 7 > 0 ? cur - 1 : cur; break;
			case "Home": target = firstRealI; break;
			case "End": target = lastRealI; break;
			default: return;
		}
		e.preventDefault();
		if (target !== cur && isReal(target))
			selectAt(target);
		else if (sel === null)
			selectAt(cur);
	};

	return (
		<figure className="flex flex-col gap-y-3">
			<ScrollableChartFrame minWidth={viewW} drawOnDeps={[days]}>
				<div className="relative w-full">
					<svg
						ref={svgRef}
						role="grid"
						aria-label={ariaLabel}
						tabIndex={0}
						aria-activedescendant={sel !== null ? cellId(sel.i) : undefined}
						onKeyDown={handleKeyDown}
						onFocus={() => {
							if (sel === null && lastRealI >= 0)
								selectAt(lastRealI);
						}}
						onBlur={() => setSel(null)}
						viewBox={`0 0 ${viewW} ${viewH}`}
						preserveAspectRatio="xMidYMid meet"
						className="block h-auto w-full rounded-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
					>
						{/* Month labels */}
						{monthMarks.map(({ week, month }) => (
							<AxisText
								key={`m-${week}`}
								x={xFor(week)}
								y={PAD_T - 8}
								anchor="start"
								size={10}
								letterSpacing="0.08em"
							>
								{MONTH_ABBR[month]}
							</AxisText>
						))}

						{/* Cells. Real days are grid cells navigated by the roving active
              descendant; null padding cells stay decorative. */}
						{cells.map((cell, i) => {
							const week = Math.floor(i / 7);
							const row = i % 7;
							if (cell === null) {
								return (
									<rect
										key={`${week}-${row}`}
										aria-hidden="true"
										x={xFor(week)}
										y={yFor(row)}
										width={CELL}
										height={CELL}
										rx={2}
										fill="var(--color-soft-hairline)"
									/>
								);
							}
							const isActive = sel !== null && sel.i === i;
							return (
								<rect
									key={`${week}-${row}`}
									id={cellId(i)}
									data-heatmap-cell
									role="gridcell"
									aria-label={cellLabel(cell)}
									aria-selected={isActive}
									x={xFor(week)}
									y={yFor(row)}
									width={CELL}
									height={CELL}
									rx={2}
									fill={cellFill(cell, max)}
									stroke={isActive ? "var(--color-sumi-ink)" : "none"}
									strokeWidth={isActive ? 1.25 : 0}
									style={{ cursor: "pointer" }}
									onMouseEnter={() => selectAt(i)}
									onMouseLeave={() => setSel(null)}
									onClick={() => selectAt(i)}
								/>
							);
						})}
					</svg>

					{/* Tooltip: percent-positioned so it tracks the active cell at any scale. */}
					{sel !== null && (
						<div
							role="tooltip"
							className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-xs border border-soft-hairline bg-warm-paper-raised px-2.5 py-1.5 text-xs text-sumi-ink shadow-card"
							style={{
								left: `${((xFor(sel.week) + CELL / 2) / viewW) * 100}%`,
								top: `${((yFor(sel.row) - 2) / viewH) * 100}%`,
							}}
						>
							<div className="font-mono text-sm text-faded-sumi">
								{parseIso(sel.day.date).toLocaleDateString("en-US", {
									weekday: "short",
									month: "short",
									day: "numeric",
									year: "numeric",
									timeZone: "UTC",
								})}
							</div>
							<div className="mt-0.5 tabular-nums">
								{sel.day.count === 0
									? "No reviews"
									: `${sel.day.count} review${sel.day.count === 1 ? "" : "s"}`}
								{sel.day.count > 0 && (
									<span className="ml-2 text-faded-sumi">
										{Math.round(sel.day.retention * 100)}
										% retention
									</span>
								)}
							</div>
						</div>
					)}
				</div>
			</ScrollableChartFrame>

			<figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-sm tabular-nums text-faded-sumi">
				<span>
					Calendar activity
					{" "}
					<span className="text-sumi-ink/70">·</span>
					{" "}
					this year
				</span>
				<span className="flex items-center gap-x-2">
					<span className="text-faded-sumi/80">less</span>
					<span className="flex items-center gap-x-0.5">
						{[0.2, 0.4, 0.6, 0.8, 1.0].map(a => (
							<span
								key={a}
								aria-hidden="true"
								className="block h-[10px] w-[10px] rounded-xs"
								style={{ backgroundColor: vermillionAlpha(a) }}
							/>
						))}
					</span>
					<span className="text-faded-sumi/80">more</span>
				</span>
			</figcaption>
		</figure>
	);
}
