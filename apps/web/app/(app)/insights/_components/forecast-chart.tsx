import type { ApiForecastDay, ApiHeatmapDay } from "@fsrs-japanese/shared-types";

import {
	AXIS_SUBLABEL_SIZE,
	AxisText,
	ChartFigcaption,
	DATA_INK,
	LegendSwatch,
	REFERENCE_INK,
	ScrollableChartFrame,
} from "@/components/charts";

interface ForecastChartProps {
	heatmap: ReadonlyArray<ApiHeatmapDay>;
	forecast: ReadonlyArray<ApiForecastDay>;
	todayIso: string;
}

const VIEW_W = 600;
const VIEW_H = 240;
const PAD_LEFT = 54;
const PAD_RIGHT = 14;
const PAD_TOP = 32;
const PAD_BOTTOM = 46;
const PAST_DAYS = 7;
const NEXT_DAYS = 7;

interface Bar {
	date: string;
	letter: string;
	count: number;
	isToday: boolean;
	isPast: boolean;
}

function parseIso(iso: string): Date {
	return new Date(`${iso}T00:00:00Z`);
}

function addDays(iso: string, n: number): string {
	const d = parseIso(iso);
	d.setUTCDate(d.getUTCDate() + n);
	return d.toISOString().slice(0, 10);
}

function dayLetter(iso: string): string {
	const dow = (parseIso(iso).getUTCDay() + 6) % 7;
	return ["M", "T", "W", "T", "F", "S", "S"][dow] as string;
}

function dayOfMonth(iso: string): string {
	return iso.slice(8, 10).replace(/^0/, "");
}

function niceCeil(n: number): number {
	if (n <= 5)
		return 5;
	if (n <= 10)
		return 10;
	if (n <= 25)
		return 25;
	if (n <= 50)
		return 50;
	if (n <= 100)
		return 100;
	if (n <= 200)
		return 200;
	if (n <= 500)
		return 500;
	return Math.ceil(n / 250) * 250;
}

/**
 * 14-day forecast bar chart spanning the past 7 days (actual review counts
 * in sumi-ink) and the next 7 days (scheduled review counts in vermillion).
 * Today's bar is highlighted with a deeper fill and a vertical hairline
 * separates retrospect from forecast. The Y axis carries a clear card-count
 * scale with five ticks; the X axis labels each day with its weekday letter
 * and a date on Sundays for orientation.
 */
export function ForecastChart({
	heatmap,
	forecast,
	todayIso,
}: ForecastChartProps): React.JSX.Element | null {
	const heatByDate = new Map(heatmap.map(d => [d.date, d]));
	const fcByDate = new Map(forecast.map(d => [d.date, d]));

	const bars: Bar[] = [];
	for (let i = -PAST_DAYS + 1; i <= NEXT_DAYS; i += 1) {
		const date = addDays(todayIso, i);
		const isPast = i < 0;
		const isToday = i === 0;
		const count = isPast
			? heatByDate.get(date)?.count ?? 0
			: fcByDate.get(date)?.count ?? 0;
		bars.push({ date, letter: dayLetter(date), count, isToday, isPast });
	}

	const max = Math.max(1, ...bars.map(b => b.count));
	if (max === 0)
		return null;
	const yMax = niceCeil(max);
	const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

	const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
	const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

	// 14 evenly-spaced slots; bars are 70% of slot width.
	const slotW = innerW / bars.length;
	const barW = slotW * 0.62;
	const xFor = (i: number): number => PAD_LEFT + slotW * i + (slotW - barW) / 2;
	const yFor = (v: number): number => PAD_TOP + (1 - v / yMax) * innerH;

	// Seam x between today-1 (past) and today (future).
	const todayIdx = bars.findIndex(b => b.isToday);
	const seamX = todayIdx > 0 ? PAD_LEFT + slotW * todayIdx : null;

	const futureTotal = bars.filter(b => !b.isPast).reduce((a, b) => a + b.count, 0);
	const pastTotal = bars.filter(b => b.isPast).reduce((a, b) => a + b.count, 0);

	return (
		<figure className="flex flex-col gap-y-3">
			<ScrollableChartFrame minWidth={640}>
				<svg
					role="img"
					aria-label={
						`Bar chart spanning the past 7 days and the next 7 days. ${pastTotal} cards reviewed in the past week; ${futureTotal} cards scheduled for the next week.`
					}
					viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
					preserveAspectRatio="xMidYMid meet"
					className="block h-auto w-full"
				>
					{/* Y gridlines + axis labels */}
					{yTicks.map((tick, idx) => {
						const y = yFor(tick);
						return (
							<g key={tick}>
								<line
									x1={PAD_LEFT}
									x2={VIEW_W - PAD_RIGHT}
									y1={y}
									y2={y}
									stroke="var(--color-soft-hairline)"
									strokeOpacity={idx === 0 ? 1 : 0.7}
									strokeWidth={1}
								/>
								<AxisText x={PAD_LEFT - 10} y={y + 4} anchor="end">
									{Math.round(tick)}
								</AxisText>
							</g>
						);
					})}

					{/* Vertical seam between past and future, with PAST / NEXT labels above */}
					{seamX !== null && (
						<g>
							<line
								x1={seamX}
								x2={seamX}
								y1={PAD_TOP - 4}
								y2={VIEW_H - PAD_BOTTOM + 4}
								stroke="var(--color-sumi-ink)"
								strokeOpacity={0.35}
								strokeWidth={1}
								strokeDasharray="2 3"
							/>
							<AxisText x={seamX - 8} y={PAD_TOP - 6} anchor="end" size={10} letterSpacing="0.14em">
								PAST
							</AxisText>
							<AxisText
								x={seamX + 8}
								y={PAD_TOP - 6}
								anchor="start"
								size={10}
								letterSpacing="0.14em"
								fill={DATA_INK}
								weight={600}
							>
								NEXT
							</AxisText>
						</g>
					)}

					{/* Bars */}
					{bars.map((bar, i) => {
						const x = xFor(i);
						const y = yFor(bar.count);
						const h = Math.max(0, VIEW_H - PAD_BOTTOM - y);
						const fill = bar.isToday
							? "var(--color-inari-vermillion-deep)"
							: bar.isPast
								? "var(--color-sumi-ink)"
								: "var(--color-inari-vermillion-deep)";
						const opacity = bar.isToday ? 1 : bar.isPast ? 0.7 : 0.85;
						return (
							<g key={bar.date}>
								{bar.count > 0 && (
									<rect
										x={x}
										y={y}
										width={barW}
										height={h}
										rx={1}
										fill={fill}
										opacity={opacity}
									/>
								)}
								{/* Today value above its bar — bar's vermillion fill + the
                  vermillion X-axis letter already mark "today," so the
                  annotation only needs to carry the number. */}
								{bar.isToday && bar.count > 0 && (
									<AxisText x={x + barW / 2} y={y - 6} size={12} weight={700} fill={DATA_INK}>
										{bar.count}
									</AxisText>
								)}
							</g>
						);
					})}

					{/* X axis labels — weekday letter; date number on Sundays */}
					{bars.map((bar, i) => {
						const showDate = (parseIso(bar.date).getUTCDay() + 6) % 7 === 6;
						const x = xFor(i) + barW / 2;
						return (
							<g key={`label-${bar.date}`}>
								<AxisText
									x={x}
									y={VIEW_H - PAD_BOTTOM + 20}
									weight={bar.isToday ? 600 : 400}
									fill={bar.isToday ? DATA_INK : undefined}
								>
									{bar.letter}
								</AxisText>
								{showDate && (
									<AxisText x={x} y={VIEW_H - PAD_BOTTOM + 34} size={AXIS_SUBLABEL_SIZE}>
										{dayOfMonth(bar.date)}
									</AxisText>
								)}
							</g>
						);
					})}
				</svg>
			</ScrollableChartFrame>

			<ChartFigcaption>
				<span>
					Daily review load
					{" "}
					<span className="text-sumi-ink/70">·</span>
					{" "}
					past 7 / next 7
				</span>
				<span className="flex items-center gap-x-4">
					<LegendSwatch color={REFERENCE_INK} opacity={0.7} label={`Past ${pastTotal}`} />
					<LegendSwatch color={DATA_INK} bold label={`Next ${futureTotal}`} />
				</span>
			</ChartFigcaption>
		</figure>
	);
}
