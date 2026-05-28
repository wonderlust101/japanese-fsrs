"use client";

import type { ProgressRangeKey } from "./progress-range";

import type { MatureMilestone, MaturePoint } from "./progress-types";

import { useMemo } from "react";
import { ScrollableChartFrame, smoothLinePath } from "@/components/charts";
import { rangeDays } from "./progress-range";

interface MatureStackedAreaProps {
	series: ReadonlyArray<MaturePoint>;
	milestones: ReadonlyArray<MatureMilestone>;
	/** Page-level time range, shared with the Retention chart. */
	range: ProgressRangeKey;
}

const VB_W = 1200;
const VB_H = 240;
const PAD_LEFT = 54;
const PAD_RIGHT = 14;
const PAD_TOP = 32;
const PAD_BOTTOM = 46;
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM;

// Maturity ramp: a single token (inari-vermillion-deep) faded across four
// steps so "the deeper the red, the more durable the card." Token-driven so
// the ramp tracks the brand color rather than a hardcoded literal.
const STAGES = [
	{ key: "new", label: "New", fill: "color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 75%)" },
	{ key: "learning", label: "Learning", fill: "color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 55%)" },
	{ key: "young", label: "Young", fill: "color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 30%)" },
	{ key: "mature", label: "Mature", fill: "var(--color-inari-vermillion-deep)" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

function niceTickStep(span: number, target: number): number {
	if (span <= 0)
		return 1;
	const raw = span / Math.max(1, target);
	const pow = 10 ** Math.floor(Math.log10(raw));
	const norm = raw / pow;
	const step = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
	return step * pow;
}

type XAnchor = "start" | "middle" | "end";

interface XTick {
	index: number;
	label: string;
	anchor: XAnchor;
}

function formatDateShort(iso: string): string {
	return new Date(`${iso}T00:00:00Z`)
		.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function pickXTicks(dates: ReadonlyArray<string>, want: number): XTick[] {
	if (dates.length === 0)
		return [];
	if (dates.length === 1) {
		const only = dates[0];
		if (only === undefined)
			return [];
		return [{ index: 0, label: formatDateShort(only), anchor: "middle" }];
	}
	const lastIdx = dates.length - 1;
	const tickCount = Math.max(2, Math.min(want, dates.length));
	const out: XTick[] = [];
	const seen = new Set<number>();
	for (let i = 0; i < tickCount; i += 1) {
		const idx = Math.round((i / (tickCount - 1)) * lastIdx);
		if (seen.has(idx))
			continue;
		seen.add(idx);
		const d = dates[idx];
		if (d === undefined)
			continue;
		const anchor: XAnchor = idx === 0 ? "start" : idx === lastIdx ? "end" : "middle";
		out.push({ index: idx, label: formatDateShort(d), anchor });
	}
	return out;
}

/**
 * Stacked area chart: four bands (new / learning / young / mature) stacked
 * bottom-to-top, with milestone dots on the mature boundary line. The
 * vermillion alpha ramp encodes "the deeper the red, the more durable
 * the card." Mature sits at full saturation; new is barely tinted.
 */
export function MatureStackedArea({
	series,
	milestones,
	range,
}: MatureStackedAreaProps): React.JSX.Element {
	const view = useMemo<ReadonlyArray<MaturePoint>>(() => {
		const days = rangeDays(range);
		const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date));
		if (days === null)
			return sorted;
		return sorted.slice(-days);
	}, [series, range]);

	// Per-day totals (top of stack).
	const totals = useMemo(() => view.map(p => p.new + p.learning + p.young + p.mature), [view]);
	const maxTotal = totals.length === 0 ? 0 : Math.max(...totals, 1);
	const yMax = Math.ceil(maxTotal / 50) * 50 || 1;

	const xOf = (i: number): number => {
		if (view.length <= 1)
			return PAD_LEFT + PLOT_W / 2;
		return PAD_LEFT + (i / (view.length - 1)) * PLOT_W;
	};
	const yOf = (v: number): number => {
		const t = v / yMax;
		return PAD_TOP + (1 - t) * PLOT_H;
	};

	// Build cumulative top-edges for each stack band.
	const layers = useMemo(() => {
		const cumByStage: Record<StageKey, number[]> = {
			new: [],
			learning: [],
			young: [],
			mature: [],
		};
		for (const p of view) {
			// Stack order bottom-to-top: new, learning, young, mature. Mature
			// sits on top so its cumulative edge is the chart's reading line
			// (the one that carries the milestone dots).
			const cumNew = p.new;
			const cumLearning = cumNew + p.learning;
			const cumYoung = cumLearning + p.young;
			const cumMature = cumYoung + p.mature;
			cumByStage.new.push(cumNew);
			cumByStage.learning.push(cumLearning);
			cumByStage.young.push(cumYoung);
			cumByStage.mature.push(cumMature);
		}
		return cumByStage;
	}, [view]);

	const buildArea = (top: ReadonlyArray<number>, bottom: ReadonlyArray<number>): string => {
		const topPts: Array<readonly [number, number]> = top.map((v, i) => [xOf(i), yOf(v)] as const);
		const botPts: Array<readonly [number, number]> = bottom.map((v, i) => [xOf(i), yOf(v)] as const);
		if (topPts.length < 2)
			return "";
		const upper = smoothLinePath(topPts);
		const lowerReversed = botPts.slice().reverse();
		const first = lowerReversed[0];
		if (first === undefined)
			return "";
		const lower = smoothLinePath(lowerReversed).replace(/^M/, "L");
		return `${upper} ${lower} Z`;
	};

	const newArea = buildArea(layers.new, view.map(() => 0));
	const learningArea = buildArea(layers.learning, layers.new);
	const youngArea = buildArea(layers.young, layers.learning);
	const matureArea = buildArea(layers.mature, layers.young);

	// Mature top-edge as the milestone-bearing line.
	const matureLinePoints: Array<readonly [number, number]> = layers.mature.map(
		(v, i) => [xOf(i), yOf(v)] as const,
	);
	const matureLine = smoothLinePath(matureLinePoints);

	// Find milestone dot positions inside the visible window.
	const dotPositions = useMemo(() => {
		const dateIndex = new Map<string, number>();
		view.forEach((p, i) => dateIndex.set(p.date, i));
		return milestones
			.map((m) => {
				const i = dateIndex.get(m.date);
				if (i === undefined)
					return null;
				const cumMature = layers.mature[i];
				if (cumMature === undefined)
					return null;
				return { count: m.count, x: xOf(i), y: yOf(cumMature) };
			})
			.filter((p): p is { count: number; x: number; y: number } => p !== null);
	}, [milestones, view, layers]);

	// Y ticks.
	const yTicks = useMemo(() => {
		const step = niceTickStep(yMax, 4);
		const out: Array<{ value: number; y: number }> = [];
		for (let v = 0; v <= yMax + 0.001; v += step) {
			out.push({ value: Math.round(v), y: yOf(v) });
		}
		return out;
	}, [yMax]);

	const xTicks = useMemo(() => pickXTicks(view.map(p => p.date), 5), [view]);

	return (
		<div className="flex flex-col gap-y-6">
			<p className="font-mono text-sm text-faded-sumi">
				Pipeline
				{" "}
				<span className="text-sumi-ink/70">·</span>
				{" "}
				<span className="text-sumi-ink/85">cards by maturity over time</span>
			</p>

			<ScrollableChartFrame minWidth={640}>
				<svg
					role="img"
					aria-label="Card pipeline over time: new, learning, young, and mature counts stacked"
					viewBox={`0 0 ${VB_W} ${VB_H}`}
					preserveAspectRatio="xMidYMid meet"
					className="block h-auto w-full"
				>
					{/* Y gridlines */}
					{yTicks.map(t => (
						<line
							key={`grid-${t.value}`}
							x1={PAD_LEFT}
							x2={VB_W - PAD_RIGHT}
							y1={t.y}
							y2={t.y}
							stroke="color-mix(in oklch, var(--color-retention-uncertainty), transparent 92%)"
							strokeWidth={1}
						/>
					))}

					{/* Stacked areas, bottom (new) to top (mature). */}
					{newArea !== "" && <path d={newArea} fill={STAGES[0].fill} stroke="none" />}
					{learningArea !== "" && <path d={learningArea} fill={STAGES[1].fill} stroke="none" />}
					{youngArea !== "" && <path d={youngArea} fill={STAGES[2].fill} stroke="none" />}
					{matureArea !== "" && <path d={matureArea} fill={STAGES[3].fill} stroke="none" />}

					{/* Mature edge */}
					{matureLine !== "" && (
						<path
							d={matureLine}
							fill="none"
							stroke="var(--color-inari-vermillion-deep)"
							strokeWidth={1.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}

					{/* Milestone dots */}
					{dotPositions.map(d => (
						<g key={d.count}>
							<circle cx={d.x} cy={d.y} r={3.5} fill="var(--color-inari-vermillion-deep)" stroke="var(--color-warm-paper-base)" strokeWidth={1.5} />
							<text
								x={d.x}
								y={d.y - 9}
								textAnchor="middle"
								className="fill-sumi-ink font-mono"
								fontSize="11"
							>
								{d.count.toLocaleString("en-US")}
							</text>
						</g>
					))}

					{/* Y labels */}
					{yTicks.map(t => (
						<text
							key={`ylabel-${t.value}`}
							x={PAD_LEFT - 10}
							y={t.y + 4}
							textAnchor="end"
							className="fill-faded-sumi font-mono"
							fontSize="13"
						>
							{t.value.toLocaleString("en-US")}
						</text>
					))}

					{/* X labels — anchored start/end at edges so the rightmost
            label doesn't clip past the viewBox. */}
					{xTicks.map(t => (
						<text
							key={`xlabel-${t.index}`}
							x={xOf(t.index)}
							y={VB_H - PAD_BOTTOM + 22}
							textAnchor={t.anchor}
							className="fill-faded-sumi font-mono"
							fontSize="13"
						>
							{t.label}
						</text>
					))}

					{/* Baseline rule */}
					<line
						x1={PAD_LEFT}
						x2={VB_W - PAD_RIGHT}
						y1={VB_H - PAD_BOTTOM}
						y2={VB_H - PAD_BOTTOM}
						stroke="color-mix(in oklch, var(--color-retention-uncertainty), transparent 75%)"
						strokeWidth={1}
					/>
				</svg>
			</ScrollableChartFrame>

			{/* Legend */}
			<ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm text-faded-sumi">
				{STAGES.map(s => (
					<li key={s.key} className="flex items-center gap-x-2">
						<span
							aria-hidden="true"
							className="inline-block h-3 w-3 rounded-[1px]"
							style={{ backgroundColor: s.fill }}
						/>
						{s.label}
					</li>
				))}
			</ul>
		</div>
	);
}
