import type { ApiHeatmapDay } from "@fsrs-japanese/shared-types";

import {
	AXIS_SUBLABEL_SIZE,
	AxisText,
	ChartFigcaption,
	DATA_INK,
	LegendSwatch,
	REFERENCE_INK,
	ScrollableChartFrame,
} from "@/components/charts";

interface MistakeBudgetChartProps {
	/** Full heatmap; the chart uses the most recent 14 days. */
	heatmap: ReadonlyArray<ApiHeatmapDay>;
}

const VIEW_W = 600;
const VIEW_H = 248;
const PAD_LEFT = 76;
const PAD_RIGHT = 14;
const PAD_TOP = 28;
const PAD_BOTTOM = 48;
const WINDOW = 14;

/**
 * The scheduler runs every card at request_retention = 0.85
 * (`apps/api/src/services/fsrs.service.ts`). So on a healthy day we expect to
 * miss ~15% of what we review. That is the budget this chart measures against,
 * not an arbitrary threshold.
 */
const TARGET_RETENTION = 0.85;
const MISS_RATE_BUDGET = 1 - TARGET_RETENTION;

function sortAsc(xs: ReadonlyArray<ApiHeatmapDay>): ApiHeatmapDay[] {
	return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1));
}

function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

function dayLetter(iso: string): string {
	const dow = (parseIso(iso).getUTCDay() + 6) % 7;
	return ["M", "T", "W", "T", "F", "S", "S"][dow] as string;
}

function dayOfMonth(iso: string): string {
	return iso.slice(8, 10).replace(/^0/, "");
}

function niceCeil(n: number): number {
	if (n <= 2)
		return 2;
	if (n <= 3)
		return 3;
	if (n <= 5)
		return 5;
	if (n <= 10)
		return 10;
	if (n <= 20)
		return 20;
	return Math.ceil(n / 10) * 10;
}

interface Day {
	date: string;
	letter: string;
	count: number;
	/** Exact wrong answers: retention is the day's good+easy ratio, so this is not an estimate. */
	actual: number;
	/** Misses a healthy 85%-target day of the same size would produce. */
	expected: number;
	/** expected − actual. Negative = over budget (slipping); positive = under budget. */
	delta: number;
	isToday: boolean;
}

/**
 * "Mistake budget" diverging chart. Each active day is measured against the
 * misses an 85%-retention target day of the same review volume would produce
 * (`count × 0.15`). Days that ran *over* budget dive below the zero line in
 * vermillion (where you slipped); days *under* budget rise above it, quiet.
 * Because the baseline scales with how much you reviewed, a busy off day reads
 * as a deeper slip than a quiet one, which a raw daily-mistake bar can't show.
 * The zero line is the only reference; the legend names both directions.
 */
export function MistakeBudgetChart({
	heatmap,
}: MistakeBudgetChartProps): React.JSX.Element | null {
	const window = sortAsc(heatmap).slice(-WINDOW);
	const active = window.filter(d => d.count > 0);
	if (active.length === 0)
		return null;

	const today = window[window.length - 1]?.date;

	const days: Day[] = window.map((d) => {
		const actual = d.count > 0 ? Math.round(d.count * (1 - d.retention)) : 0;
		const expected = d.count * MISS_RATE_BUDGET;
		return {
			date: d.date,
			letter: dayLetter(d.date),
			count: d.count,
			actual,
			expected,
			delta: expected - actual,
			isToday: d.date === today,
		};
	});

	// Symmetric scale around the zero (on-budget) line, in whole cards.
	const maxAbs = Math.max(1, ...days.map(d => Math.abs(d.delta)));
	const devMax = niceCeil(maxAbs);
	const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
	const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;
	const centerY = PAD_TOP + innerH / 2;
	const halfH = innerH / 2;

	const slotW = innerW / days.length;
	const barW = slotW * 0.5;
	const xFor = (i: number): number => PAD_LEFT + slotW * i + (slotW - barW) / 2;
	const yFor = (delta: number): number => centerY - (delta / devMax) * halfH;

	// Three ticks per side keep the cards-axis legible without crowding.
	const tickStep = devMax / 2;
	const yTicks = [-devMax, -tickStep, 0, tickStep, devMax];

	const totalActual = days.reduce((acc, d) => acc + d.actual, 0);
	const totalReviewed = days.reduce((acc, d) => acc + d.count, 0);
	const totalExpected = Math.round(days.reduce((acc, d) => acc + d.expected, 0));
	const overBudget = totalActual - totalExpected;
	const accuracyPct
		= totalReviewed > 0 ? Math.round(((totalReviewed - totalActual) / totalReviewed) * 100) : null;

	return (
		<figure className="flex flex-col gap-y-3">
			<ScrollableChartFrame minWidth={640}>
				<svg
					role="img"
					aria-label={
						`Daily misses compared with the number expected at your 85% retention target, over the last ${active.length} active days. `
						+ `You missed ${totalActual} cards versus about ${totalExpected} expected`
						+ `${overBudget > 0 ? `, ${overBudget} more than expected` : overBudget < 0 ? `, ${-overBudget} fewer than expected` : ", exactly as expected"}.`
					}
					viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
					preserveAspectRatio="xMidYMid meet"
					className="block h-auto w-full"
				>
					{/* Cards-axis gridlines + labels. The zero line is the on-target
            reference and is drawn heavier; the rest are quiet hairlines. */}
					{yTicks.map((tick) => {
						const y = yFor(tick);
						const isZero = tick === 0;
						// Label only the poles and the reference line, and label them in
						// words: a diverging axis is read by its direction, not its sign.
						const label
							= isZero
								? "expected"
								: tick === devMax
									? `${Math.round(devMax)} fewer`
									: tick === -devMax
										? `${Math.round(devMax)} more`
										: null;
						return (
							<g key={tick}>
								<line
									x1={PAD_LEFT}
									x2={VIEW_W - PAD_RIGHT}
									y1={y}
									y2={y}
									stroke={isZero ? "var(--color-sumi-ink)" : "var(--color-soft-hairline)"}
									strokeOpacity={isZero ? 0.5 : 0.7}
									strokeWidth={isZero ? 1.2 : 1}
									strokeDasharray={isZero ? "4 4" : undefined}
								/>
								{label !== null && (
									<AxisText
										x={PAD_LEFT - 10}
										y={y + 4}
										anchor="end"
										size={isZero ? 11 : 10}
										{...(isZero ? { fill: REFERENCE_INK } : {})}
									>
										{label}
									</AxisText>
								)}
							</g>
						);
					})}

					{/* Budget bars: over-budget (slipping) dive below the line in
            vermillion; under-budget rise above it in quiet sumi. */}
					{days.map((d, i) => {
						if (d.count === 0)
							return null;
						const x = xFor(i);
						const y = yFor(d.delta);
						const slipping = d.delta < 0;
						const top = Math.min(y, centerY);
						const h = Math.max(slipping || d.delta > 0 ? 2 : 0, Math.abs(y - centerY));
						return (
							<rect
								key={d.date}
								x={x}
								y={top}
								width={barW}
								height={h}
								rx={1.5}
								fill={slipping ? "var(--color-inari-vermillion-deep)" : "var(--color-sumi-ink)"}
								fillOpacity={slipping ? (d.isToday ? 1 : 0.82) : 0.26}
							/>
						);
					})}

					{/* Today callout: name the actual vs expected so the reader can
            anchor the abstract delta to real counts. */}
					{(() => {
						const i = days.findIndex(d => d.isToday);
						const d = days[i];
						if (d === undefined || d.count === 0)
							return null;
						const slipping = d.delta < 0;
						const labelY = slipping ? yFor(d.delta) + 16 : yFor(d.delta) - 8;
						const off = Math.round(d.actual - d.expected);
						// Short wording: the axis poles already establish "fewer/more" mean
						// "than expected", so the callout needn't repeat it. Right-anchored
						// to the plot edge so it can never overflow the viewBox.
						const todayWord
							= off > 0
								? `${off} more`
								: off < 0
									? `${-off} fewer`
									: "on target";
						return (
							<AxisText
								x={VIEW_W - PAD_RIGHT}
								y={labelY}
								anchor="end"
								size={10.5}
								weight={700}
								fill={slipping ? DATA_INK : REFERENCE_INK}
							>
								{`TODAY · ${todayWord}`}
							</AxisText>
						);
					})()}

					{/* X axis: weekday letter, date number on Sundays for orientation. */}
					{days.map((d, i) => {
						const showDate = (parseIso(d.date).getUTCDay() + 6) % 7 === 6;
						const x = xFor(i) + barW / 2;
						return (
							<g key={`label-${d.date}`}>
								<AxisText
									x={x}
									y={VIEW_H - PAD_BOTTOM + 20}
									size={12}
									weight={d.isToday ? 600 : 400}
									fill={d.isToday ? DATA_INK : undefined}
								>
									{d.letter}
								</AxisText>
								{showDate && (
									<AxisText x={x} y={VIEW_H - PAD_BOTTOM + 33} size={AXIS_SUBLABEL_SIZE}>
										{dayOfMonth(d.date)}
									</AxisText>
								)}
							</g>
						);
					})}
				</svg>
			</ScrollableChartFrame>

			<ChartFigcaption>
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<LegendSwatch color={DATA_INK} label="More misses" />
					<span className="flex items-center gap-x-2">
						<LegendSwatch color={REFERENCE_INK} opacity={0.3} label="Fewer misses" />
						<span className="text-sumi-ink/70">than expected at 85%</span>
					</span>
				</span>
				<span className="flex flex-wrap items-center gap-x-3 gap-y-1">
					<span>
						You missed
						{" "}
						<span className="font-medium text-inari-vermillion-deep">{totalActual}</span>
						<span className="text-faded-sumi/80">, expected </span>
						<span className="text-sumi-ink/80">
							~
							{totalExpected}
						</span>
					</span>
					{accuracyPct !== null && (
						<span className="text-sumi-ink/85">
							{accuracyPct}
							% accuracy
						</span>
					)}
				</span>
			</ChartFigcaption>
		</figure>
	);
}
