/**
 * Dashboard Marks: ink-stroke utility icons for dashboard practice routes.
 * Mirrors the existing icon contract from `arrow-glyph.tsx` and
 * `study-marks.tsx`: single 1.25 stroke weight, no fills, currentColor for
 * inheritance, round linecap/linejoin.
 *
 * Sized at 14×14 for inline use in Button leadingIcon slots, matching
 * ArrowGlyph's footprint so chrome alignment stays consistent.
 */

const COMMON_PROPS = {
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.25,
	strokeLinecap: "round",
	strokeLinejoin: "round",
} as const;

interface IconProps {
	className?: string;
}

/**
 * Drill: precision target. Bullseye reads as "focused practice on the
 * exact cards giving you trouble," matching the weakSpot-drill semantics.
 * Two concentric rings + center dot; geometry rounded to 0.5px.
 */
export function DrillMark({ className = "" }: IconProps): React.JSX.Element {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			aria-hidden="true"
			className={className}
		>
			<circle cx="7" cy="7" r="5" {...COMMON_PROPS} />
			<circle cx="7" cy="7" r="2.5" {...COMMON_PROPS} />
			<circle cx="7" cy="7" r="0.6" fill="currentColor" stroke="none" />
		</svg>
	);
}

/**
 * Cram: stacked paper. Three horizontal strokes tightly stacked with a
 * slight diagonal offset, reading as "a pile of cards run through quickly."
 * Avoids the lightning-bolt / fast-forward cliché while keeping the
 * volume-and-speed cue.
 */
export function CramMark({ className = "" }: IconProps): React.JSX.Element {
	return (
		<svg
			width="14"
			height="14"
			viewBox="0 0 14 14"
			aria-hidden="true"
			className={className}
		>
			<line x1="3" y1="4" x2="11" y2="4" {...COMMON_PROPS} />
			<line x1="2.5" y1="7" x2="10.5" y2="7" {...COMMON_PROPS} />
			<line x1="3.5" y1="10" x2="11.5" y2="10" {...COMMON_PROPS} />
		</svg>
	);
}
