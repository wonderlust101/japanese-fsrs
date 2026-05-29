import type { IntervalBucket } from "./types";

import { ScrollableChartFrame } from "@/components/charts";

interface IntervalHistogramProps {
	buckets: ReadonlyArray<IntervalBucket>;
}

const VIEW_W = 1200;
const VIEW_H = 240;
const PAD_LEFT = 54;
const PAD_RIGHT = 14;
const PAD_TOP = 32;
const PAD_BOTTOM = 46;

/**
 * Compute a "nice" tick step that divides cleanly into the Y axis: round
 * the rough step up to a 1/2/2.5/5/10 multiple of the appropriate
 * power-of-ten. Drives clean integer ticks (0/50/100/150/200/250 instead
 * of 0/62.5/125/187.5/250).
 */
function niceTickStep(rough: number): number {
	if (rough <= 0)
		return 1;
	const pow = 10 ** Math.floor(Math.log10(rough));
	const norm = rough / pow;
	let step: number;
	if (norm <= 1)
		step = 1;
	else if (norm <= 2)
		step = 2;
	else if (norm <= 2.5)
		step = 2.5;
	else if (norm <= 5)
		step = 5;
	else step = 10;
	return step * pow;
}

function computeYAxis(max: number, targetTicks = 5): { yMax: number; ticks: number[] } {
	const step = niceTickStep(Math.max(1, max / targetTicks));
	const yMax = Math.ceil(max / step) * step;
	const ticks: number[] = [];
	for (let v = 0; v <= yMax + 0.0001; v += step) ticks.push(Math.round(v));
	return { yMax, ticks };
}

/**
 * Distribution of cards across review-interval buckets. Each bar = how
 * many cards are scheduled at that interval (1d / 3d / 7d / 14d / 30d /
 * 60d / 6m / 1y+). Reveals the "shape" of the scheduling load: a
 * front-loaded histogram means lots of fresh cards; a flat-tail one
 * means a maturing collection.
 */
export function IntervalHistogram({
	buckets,
}: IntervalHistogramProps): React.JSX.Element | null {
	if (buckets.length === 0)
		return null;

	const max = Math.max(0, ...buckets.map(b => b.count));
	if (max === 0)
		return null;
	const { yMax, ticks: yTicks } = computeYAxis(Math.max(5, max), 5);

	const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT;
	const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM;

	const slotW = innerW / buckets.length;
	// Match the workload-chart family's ~62% slot fill so 8-bar charts look
	// visually consistent with 14-bar ones.
	const barW = Math.min(slotW * 0.62, 100);
	const xFor = (i: number): number => PAD_LEFT + slotW * i + (slotW - barW) / 2;
	const yFor = (v: number): number => PAD_TOP + (1 - v / yMax) * innerH;

	const total = buckets.reduce((acc, b) => acc + b.count, 0);

	// Percent position within the viewBox, so HTML labels overlaid on the SVG
	// stay crisp (real rem) at any container width instead of shrinking with
	// the SVG's uniform downscale on narrow viewports.
	const leftPct = (x: number): string => `${(x / VIEW_W) * 100}%`;
	const topPct = (y: number): string => `${(y / VIEW_H) * 100}%`;
	const axisY = VIEW_H - PAD_BOTTOM;

	return (
		<figure className="flex flex-col gap-y-3">
			<ScrollableChartFrame minWidth={640}>
				<div className="relative w-full">
					<svg
						role="img"
						aria-label={`Histogram of cards across ${buckets.length} interval buckets. Total ${total} cards.`}
						viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
						preserveAspectRatio="xMidYMid meet"
						className="block h-auto w-full"
					>
						{/* Y gridlines */}
						{yTicks.map((tick, idx) => {
							const y = yFor(tick);
							return (
								<line
									key={tick}
									x1={PAD_LEFT}
									x2={VIEW_W - PAD_RIGHT}
									y1={y}
									y2={y}
									stroke="var(--color-soft-hairline)"
									strokeOpacity={idx === 0 ? 1 : 0.7}
									strokeWidth={1}
								/>
							);
						})}

						{/* Bars */}
						{buckets.map((bucket, i) => {
							if (bucket.count === 0)
								return null;
							const x = xFor(i);
							const y = yFor(bucket.count);
							return (
								<rect
									key={bucket.label}
									x={x}
									y={y}
									width={barW}
									height={axisY - y}
									rx={1}
									fill="var(--color-inari-vermillion-deep)"
									opacity={0.85}
								/>
							);
						})}
					</svg>

					{/* HTML label overlay — crisp at any width */}
					<div className="pointer-events-none absolute inset-0 font-mono tabular-nums text-faded-sumi">
						{yTicks.map(tick => (
							<span
								key={tick}
								className="absolute -translate-x-full -translate-y-1/2 pr-2 text-right text-sm"
								style={{ left: leftPct(PAD_LEFT), top: topPct(yFor(tick)) }}
							>
								{Math.round(tick)}
							</span>
						))}

						{buckets.map((bucket, i) => {
							const cx = xFor(i) + barW / 2;
							if (bucket.count === 0) {
								return (
									<span
										key={bucket.label}
										className="absolute -translate-x-1/2 -translate-y-full text-sm text-faded-sumi"
										style={{ left: leftPct(cx), top: topPct(axisY - 4) }}
									>
										0
									</span>
								);
							}
							return (
								<span
									key={bucket.label}
									className="absolute -translate-x-1/2 -translate-y-full pb-1 text-sm font-semibold text-inari-vermillion-deep"
									style={{ left: leftPct(cx), top: topPct(yFor(bucket.count)) }}
								>
									{bucket.count}
								</span>
							);
						})}

						{buckets.map((bucket, i) => (
							<span
								key={`x-${bucket.label}`}
								className="absolute -translate-x-1/2 text-sm"
								style={{ left: leftPct(xFor(i) + barW / 2), top: topPct(axisY + 8) }}
							>
								{bucket.label}
							</span>
						))}
					</div>
				</div>
			</ScrollableChartFrame>

			<figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-sm tabular-nums text-faded-sumi">
				<span>
					Interval distribution
					{" "}
					<span className="text-sumi-ink/70">·</span>
					{" "}
					cards in queue
				</span>
				<span className="text-sumi-ink/85">
					{total}
					{" "}
					cards total
				</span>
			</figcaption>
		</figure>
	);
}
