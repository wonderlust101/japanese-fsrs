import { cn } from "@/lib/utils";

/**
 * Shared annotation vocabulary for every Insights chart (overview, progress,
 * forecast, statistics). The charts already share geometry via `chartPaths.ts`
 * and the canonical `PAD_*` / `VIEW_*` constants; this module unifies the
 * annotation* layer so a reader who learns one chart's grammar (what a focal
 * dot, a reference line, a legend swatch, or an axis label means) carries that
 * reading to the next chart instead of re-orienting each time.
 *
 * Two families live here:
 *  - SVG atoms (`AxisText`, `FocalDot`, `ReferenceLine`) render inside an
 *    <svg>; they take view-space coordinates already computed by the caller.
 *  - DOM atoms (`LegendSwatch`, `ChartFigcaption`) render the figure's caption
 *    row below the <svg>.
 *
 * All color comes from CSS custom properties so theming stays centralized.
 */

// ── Shared style tokens ──────────────────────────────────────────────────────

/** The single mono stack every chart label uses. */
export const CHART_MONO = "ui-monospace, monospace";

/** Quiet axis-label ink. Solid (no opacity) so it clears AA at small sizes. */
export const AXIS_INK = "var(--color-faded-sumi)";
/** Loud data ink — the brand vermillion that carries the focal value. */
export const DATA_INK = "var(--color-inari-vermillion-deep)";
/** Reference ink — sumi, the only non-data mark, read as "baseline". */
export const REFERENCE_INK = "var(--color-sumi-ink)";

/** Canonical axis-tick size; date sub-labels step down one notch. */
export const AXIS_LABEL_SIZE = 13;
export const AXIS_SUBLABEL_SIZE = 10.5;

// ── SVG atoms ────────────────────────────────────────────────────────────────

interface AxisTextProps {
	x: number;
	y: number;
	anchor?: "start" | "middle" | "end";
	size?: number;
	/**
	 * Accepts undefined so callers can pass `fill={cond ? DATA_INK : undefined}`
	 *  and fall back to the default axis ink.
	 */
	fill?: string | undefined;
	weight?: number;
	letterSpacing?: string | number;
	children: React.ReactNode;
}

/**
 * A mono axis / annotation label. Defaults to the quiet axis ink at the
 * canonical tick size; pass `fill={DATA_INK}` and `weight={700}` for a focal
 * callout, or `fill={REFERENCE_INK}` for a baseline label.
 */
export function AxisText({
	x,
	y,
	anchor = "middle",
	size = AXIS_LABEL_SIZE,
	fill = AXIS_INK,
	weight,
	letterSpacing,
	children,
}: AxisTextProps): React.JSX.Element {
	return (
		<text
			x={x}
			y={y}
			textAnchor={anchor}
			fontSize={size}
			fontFamily={CHART_MONO}
			fill={fill}
			{...(weight !== undefined ? { fontWeight: weight } : {})}
			{...(letterSpacing !== undefined ? { letterSpacing } : {})}
		>
			{children}
		</text>
	);
}

interface FocalDotProps {
	cx: number;
	cy: number;
	/** Ring + core color. Defaults to the brand data ink. */
	color?: string;
	/** Halo fill that lifts the dot off the curve. */
	halo?: string;
}

/**
 * The "current value" marker: a paper-filled halo ringed in the data color
 * with a solid core, so the eye finds "now" / "today" without parsing the
 * series. One shape, used by every chart that annotates a focal point.
 */
export function FocalDot({
	cx,
	cy,
	color = DATA_INK,
	halo = "var(--color-warm-paper-raised)",
}: FocalDotProps): React.JSX.Element {
	return (
		<g>
			<circle cx={cx} cy={cy} r={7} fill={halo} stroke={color} strokeWidth={1.5} />
			<circle cx={cx} cy={cy} r={3.2} fill={color} />
		</g>
	);
}

interface ReferenceLineProps {
	x1: number;
	x2: number;
	y: number;
	/** Defaults to sumi (a baseline), not data ink. */
	color?: string;
	opacity?: number;
	width?: number;
	dash?: string;
}

/**
 * Horizontal reference line (trailing mean, target retention, on-budget zero).
 * Sumi + dashed by default so it reads as "reference", never as a data series.
 */
export function ReferenceLine({
	x1,
	x2,
	y,
	color = REFERENCE_INK,
	opacity = 0.55,
	width = 1.2,
	dash = "4 4",
}: ReferenceLineProps): React.JSX.Element {
	return (
		<line
			x1={x1}
			x2={x2}
			y1={y}
			y2={y}
			stroke={color}
			strokeOpacity={opacity}
			strokeWidth={width}
			strokeDasharray={dash}
		/>
	);
}

// ── DOM atoms (figure caption) ───────────────────────────────────────────────

/**
 * The caption row beneath every chart: a mono, tabular-nums strip that holds a
 * left description and a right legend. Identical wrapper across all charts.
 */
export function ChartFigcaption({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}): React.JSX.Element {
	return (
		<figcaption
			className={cn(
				"flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 font-mono text-sm tabular-nums text-faded-sumi",
				className,
			)}
		>
			{children}
		</figcaption>
	);
}

type SwatchShape = "square" | "line";

interface LegendSwatchProps {
	/** `square` for bars/areas, `line` for series lines (optionally dashed). */
	shape?: SwatchShape;
	color: string;
	opacity?: number;
	dashed?: boolean;
	/** Render the label in medium weight + data ink (the focal series). */
	bold?: boolean;
	label: string;
}

/**
 * One legend entry: a swatch (square for bars/areas, line for series) plus a
 * label. Replaces the four near-identical copies that lived inside the
 * individual chart files.
 */
export function LegendSwatch({
	shape = "square",
	color,
	opacity = 1,
	dashed = false,
	bold = false,
	label,
}: LegendSwatchProps): React.JSX.Element {
	return (
		<span className="flex items-center gap-x-2">
			<span
				aria-hidden="true"
				className={cn(
					"inline-block",
					shape === "line" ? "h-0.5 w-4" : "h-2.5 w-2.5 rounded-xs",
				)}
				style={{
					opacity,
					...(dashed
						? {
								backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
							}
						: { backgroundColor: color }),
				}}
			/>
			<span className={bold ? "font-medium text-inari-vermillion-deep" : undefined}>
				{label}
			</span>
		</span>
	);
}
