type Variant = "large" | "small";

interface VermillionUnderlineProps {
	variant?: Variant;
	className?: string;
}

const PATH_LARGE
// Subtle wobble + tapered ends. Drawn in a 200x10 viewBox so it scales
// cleanly to the parent width. The curve is intentionally not pixel-perfect
// so it reads as hand-brushed rather than CSS-clean.
	= "M2 5.6 C 18 4.1, 42 6.4, 64 5.2 S 110 4.0, 138 5.6 S 178 7.0, 198 5.0";

const PATH_SMALL
	= "M2 5.4 C 14 4.4, 30 6.2, 46 5.0 S 72 4.2, 92 5.6";

const SIZE: Record<Variant, { w: number; h: number; path: string; stroke: number }> = {
	large: { w: 200, h: 10, path: PATH_LARGE, stroke: 2.8 },
	small: { w: 94, h: 10, path: PATH_SMALL, stroke: 2.2 },
};

/**
 * Hand-brushed vermillion underline used to mark the week stamp and each
 * ranked-note ornament. Inline SVG with tapered round caps so it reads as
 * a calligraphic stroke rather than a CSS border. Decorative — never alone
 * carries semantic meaning.
 */
export function VermillionUnderline({
	variant = "small",
	className,
}: VermillionUnderlineProps): React.JSX.Element {
	const { w, h, path, stroke } = SIZE[variant];
	return (
		<svg
			aria-hidden="true"
			role="presentation"
			viewBox={`0 0 ${w} ${h}`}
			width={w}
			height={h}
			preserveAspectRatio="none"
			className={className}
			style={{ display: "block" }}
		>
			<path
				d={path}
				fill="none"
				stroke="var(--color-inari-vermillion)"
				strokeWidth={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
				vectorEffect="non-scaling-stroke"
				opacity={0.9}
			/>
		</svg>
	);
}
