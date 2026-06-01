"use client";

import { useRef } from "react";

import { useScrollDrawOn } from "@/hooks/use-scroll-draw-on";
import { DUR } from "@/lib/motion/easings";

interface ScrollableChartFrameProps {
	/**
	 * Minimum plot width in px. Below this, the chart scrolls horizontally
	 * instead of shrinking; at or above it, the inner plot fills the
	 * available width. Line/area charts pass a fixed floor (640); the
	 * heatmap passes its natural pixel width so cells never drop below a
	 * tappable size.
	 */
	minWidth: number;
	children: React.ReactNode;
	/** Appended to the scroll container (e.g. a focus-ring breathing pad). */
	className?: string;
	/**
	 * Re-run dependencies for the scroll-draw animation (per
	 * `docs/motion/DASHBOARD_MOTION_SPEC.md` §2.4). Pass the data the chart's
	 * paths are derived from so the line `getTotalLength()` is re-read and the
	 * draw re-initializes when the series changes (e.g. a range toggle). Defaults
	 * to `[]` (draw once on mount).
	 */
	drawOnDeps?: ReadonlyArray<unknown>;
	/**
	 * Delay (s) before the chart draw-on begins, so a containing
	 * `useReveal({ mode: "scroll" })` SectionCard fades in *first* and the line
	 * never draws under an `opacity: 0` section (DASHBOARD_MOTION_SPEC §P2.3).
	 * Defaults to `DUR.md` (≈ the section reveal duration) because every consumer
	 * of this frame lives on an Insights route inside a revealed SectionCard.
	 * Pass `0` to draw immediately on scroll-in if a frame is ever used outside a
	 * revealed section.
	 */
	drawDelay?: number;
}

/**
 * Keeps a fixed-viewBox SVG chart legible on narrow viewports. The chart's
 * own viewBox scales text along with the plot, so on a phone a fixed
 * 1200-unit canvas renders axis labels at ~4px. This frame stops that: the
 * inner plot holds a `min-width`, and the container scrolls horizontally
 * once the viewport drops below it, so labels keep their authored size.
 *
 * The right-edge `mask-image` fade is the same scroll affordance used by
 * the cards/decks paginations and the active-filter rail. It only paints
 * below `sm:` — and since `minWidth` always exceeds a phone viewport and
 * always fits desktop, the fade is visible precisely when scroll is
 * possible. The scrollbar is hidden to match those same rails.
 *
 * Motion: this frame is the `[data-chart-frame]` ScrollTrigger root for the
 * chart draw-on (§2.4 / §2.9). It scopes {@link useScrollDrawOn}, which animates
 * any `[data-chart-line]` (strokeDashoffset draw), `[data-chart-area]` (fill
 * fade), and `[data-heatmap-cell]` (grid-stagger) within it once the figure
 * scrolls into view — all gated behind `prefers-reduced-motion: no-preference`.
 * Consumers opt in by tagging their `<path>`/`<rect>` marks with those hooks;
 * untagged charts simply render statically.
 */
export function ScrollableChartFrame({
	minWidth,
	children,
	className = "",
	drawOnDeps = [],
	drawDelay = DUR.md,
}: ScrollableChartFrameProps): React.JSX.Element {
	const frameRef = useRef<HTMLDivElement>(null);

	useScrollDrawOn(frameRef, drawOnDeps, drawDelay);

	return (
		<div
			ref={frameRef}
			data-chart-frame
			className={[
				// py-1 keeps SVG focus rings (outline-offset-2) from clipping
				// against the computed overflow-y when overflow-x is set.
				"overflow-x-auto py-1",
				"[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
				"[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-2rem),transparent_100%)]",
				"sm:[mask-image:none]",
				className,
			]
				.filter(c => c.length > 0)
				.join(" ")}
		>
			<div style={{ minWidth: `${minWidth}px` }}>{children}</div>
		</div>
	);
}
