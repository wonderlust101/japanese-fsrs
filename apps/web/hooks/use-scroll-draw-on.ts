"use client";

import type { RefObject } from "react";

import { DUR, EASE, STAGGER } from "@/lib/motion/easings";
// register-scroll (not the core register) so ScrollTrigger is registered for the
// `scrollTrigger:` timeline config below — and stays in the Insights route chunk.
import { gsap, useGSAP } from "@/lib/motion/register-scroll";

/**
 * Shared "draw on scroll-in" hook for the Insights charts and the year heatmap.
 *
 * Both §2.4 (line/area charts) and §2.9 (heatmap grid) of the dashboard motion
 * spec share the exact same skeleton: a `ScrollTrigger` with `once: true` that
 * fires when the figure enters the viewport, the whole thing gated behind
 * `prefers-reduced-motion: no-preference`, hidden start-states set *only* inside
 * that branch (so reduced-motion users and a JS failure see the fully-drawn
 * final state), and `clearProps` cleanup so an interrupted re-run can't strand a
 * mark invisible. This hook is that skeleton; callers describe *what* to draw.
 *
 * It targets the standardized `data-*` hooks within `frameRef`:
 *   - `[data-chart-line]`   stroked paths → `strokeDashoffset` draw (quint.out)
 *   - `[data-chart-area]`   filled areas  → autoAlpha fade, trailing the line
 *   - `[data-heatmap-cell]` grid rects    → autoAlpha grid-stagger sweep
 *
 * All chart marks are decorative SVG (the `<figure>` carries the data for AT via
 * `aria-label`/`<figcaption>`), so everything here uses `autoAlpha`.
 *
 * `deps` should include the data the paths are derived from, so the draw
 * re-initializes (and `getTotalLength` is re-read) when the series changes.
 *
 * `delay` (s) offsets the *start* of the draw timeline. On the Insights routes
 * the chart figure sits inside a `useReveal({ mode: "scroll" })` SectionCard
 * whose fade fires at the same `top 85%` scroll position. Per DASHBOARD_MOTION_
 * SPEC §P2.3, the section fade must LEAD and the chart draw FOLLOW — a line must
 * never draw while its containing section is still `opacity: 0`, or the draw is
 * wasted and the section then fades in over a half-drawn line. A `delay ≈ DUR.md`
 * (≈ the section reveal duration) guarantees that ordering even though both
 * ScrollTriggers fire together; the two triggers stay independent (never merged).
 * The hidden start-state is still set immediately (at trigger time), so nothing
 * flashes during the delay window — only the tween-to-visible is deferred.
 */
export function useScrollDrawOn(
	frameRef: RefObject<HTMLElement | null>,
	deps: ReadonlyArray<unknown> = [],
	delay = 0,
): void {
	useGSAP(
		() => {
			const root = frameRef.current;
			if (root === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const lines = gsap.utils.toArray<SVGPathElement>(root.querySelectorAll("[data-chart-line]"));
				const areas = gsap.utils.toArray<SVGElement>(root.querySelectorAll("[data-chart-area]"));
				const cells = gsap.utils.toArray<SVGElement>(root.querySelectorAll("[data-heatmap-cell]"));

				const hasContent = lines.length > 0 || areas.length > 0 || cells.length > 0;
				if (!hasContent)
					return;

				// Hidden start states — applied ONLY here so reduced-motion / no-JS
				// renders the natural final state.
				for (const line of lines) {
					const len = line.getTotalLength();
					gsap.set(line, { strokeDasharray: len, strokeDashoffset: len });
				}
				if (areas.length > 0)
					gsap.set(areas, { autoAlpha: 0 });
				if (cells.length > 0)
					gsap.set(cells, { autoAlpha: 0 });

				const tl = gsap.timeline({
					scrollTrigger: { trigger: root, start: "top 85%", once: true },
					// Defer the draw so the containing section's reveal fade lands
					// first (§P2.3). The hidden start-states above are already set, so
					// the figure simply holds invisible/undrawn through the delay
					// window rather than drawing under an opacity-0 section.
					...(delay > 0 && { delay }),
				});

				if (lines.length > 0) {
					tl.to(
						lines,
						{
							strokeDashoffset: 0,
							duration: DUR.xl,
							ease: EASE.data,
							// Multi-series: stagger the lines so they don't draw on top
							// of each other (no-op for a single line).
							stagger: STAGGER.series,
							// Once drawn, clear the dash props so the path renders at its
							// natural full length. This matters for charts whose `d`
							// changes interactively after the one-shot reveal (e.g. the
							// new-card pace slider): a stale `strokeDasharray` captured at
							// the original length would clip a later, longer path's tail.
							onComplete: () => {
								gsap.set(lines, { clearProps: "strokeDasharray,strokeDashoffset" });
							},
						},
						0,
					);
				}

				if (areas.length > 0) {
					// Fill follows the leading edge of the line draw — area arrives
					// just behind the line, never ahead (which looks like the data
					// "deflates"). Starts 0.5s before the line tween ends.
					tl.to(
						areas,
						{ autoAlpha: 1, duration: DUR.lg, ease: EASE.out },
						lines.length > 0 ? "-=0.5" : 0,
					);
				}

				if (cells.length > 0) {
					// Grid sweep, left-to-right (calendar reading order). `each` stays
					// tiny because there can be 365+ cells; total sweep stays < ~0.9s.
					tl.to(
						cells,
						{
							autoAlpha: 1,
							duration: DUR.sm,
							ease: EASE.exit,
							stagger: { each: STAGGER.heatmap, from: "start" },
						},
						0,
					);
				}

				return () => {
					tl.scrollTrigger?.kill();
					tl.kill();
					// Restore the natural final state on any interrupted re-run.
					if (lines.length > 0)
						gsap.set(lines, { clearProps: "strokeDasharray,strokeDashoffset" });
					if (areas.length > 0)
						gsap.set(areas, { clearProps: "opacity,visibility" });
					if (cells.length > 0)
						gsap.set(cells, { clearProps: "opacity,visibility" });
				};
			});

			return () => mm.revert();
		},
		{ scope: frameRef, dependencies: [...deps] },
	);
}
