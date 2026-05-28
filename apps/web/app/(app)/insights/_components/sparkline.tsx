import { cn } from "@/lib/utils";

interface SparklineProps {
	values: ReadonlyArray<number>;
	/** Visual height; width fills container. Default keeps a tight ~3:1 ratio. */
	height?: number;
	/** Override the line color. Defaults to a vermillion-deep stroke. */
	stroke?: string;
	/** Optional baseline fill below the line. Defaults to a vermillion wash. */
	fill?: string | null;
	/** Accessible summary, e.g. "Retention trend, last 30 days". */
	ariaLabel: string;
	className?: string;
}

/**
 * Inline SVG sparkline. Path drawn in viewBox coordinates and stretched via
 * `preserveAspectRatio="none"` so the chart fills any parent width. Purely
 * decorative on hover (no tooltip); meant to support a written conclusion.
 */
export function Sparkline({
	values,
	height = 56,
	stroke = "var(--color-inari-vermillion-deep)",
	fill = "var(--color-vermillion-wash)",
	ariaLabel,
	className,
}: SparklineProps): React.JSX.Element {
	const safeValues = values.length > 0 ? values : [0, 0];
	const min = Math.min(...safeValues);
	const max = Math.max(...safeValues);
	const range = max - min || 1;
	const w = Math.max(1, safeValues.length - 1);
	const h = 100;

	const points = safeValues.map((v, i) => {
		const x = (i / w) * 100;
		const y = h - ((v - min) / range) * h;
		return [x, y] as const;
	});

	const linePath = points
		.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`)
		.join(" ");

	const areaPath = `${linePath} L100 ${h} L0 ${h} Z`;

	return (
		<svg
			role="img"
			aria-label={ariaLabel}
			viewBox={`0 0 100 ${h}`}
			preserveAspectRatio="none"
			className={cn("block w-full", className)}
			style={{ height }}
		>
			{fill !== null && <path d={areaPath} fill={fill} />}
			<path
				d={linePath}
				fill="none"
				stroke={stroke}
				strokeWidth={1.6}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
