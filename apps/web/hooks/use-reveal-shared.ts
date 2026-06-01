"use client";

import type { gsap as gsapCore } from "@/lib/motion/register";
import { DUR, EASE, STAGGER } from "@/lib/motion/easings";

/**
 * Shared types + timeline body for the page-level section-reveal cascade.
 *
 * This module imports NO gsap register barrel of its own — `buildReveal` takes
 * the `gsap` instance as an argument so the mount path (`use-reveal-mount.ts`,
 * core `register`) and scroll path (`use-reveal-scroll.ts`, `register-scroll`)
 * each pass their own statically-imported instance. That is what keeps
 * ScrollTrigger out of mount-only route chunks: a mount route imports only
 * `use-reveal-mount.ts`, which never references `register-scroll`.
 */

type GsapInstance = typeof gsapCore;

export interface RevealOptions {
	/**
	 * "mount"  → `useRevealMount` / core `@/lib/motion/register` (NO ScrollTrigger).
	 *            Fires once on mount. For above-the-fold hub/moment pages.
	 * "scroll" → `useRevealScroll` / `@/lib/motion/register-scroll`. Wraps the
	 *            timeline in a ScrollTrigger { start: "top 85%", once: true }. For
	 *            long, scrolled pages (insights) that already pay the ScrollTrigger
	 *            cost via charts.
	 */
	mode: "mount" | "scroll";
	/** Section travel distance (px). Default 12 (the house "subtle travel"). */
	y?: number;
	/** Per-section stagger (s). Default `STAGGER.cells` (0.05). Clamped — see below. */
	stagger?: number;
	/** Section duration (s). Default `DUR.md` (0.34). */
	duration?: number;
	/**
	 * Hard cap on total cascade time (s). The hook clamps the *effective* stagger
	 * so `duration + (count-1)*stagger` never exceeds this. Default 0.7 (the
	 * insights budget). This keeps a 5-section stack subtle and FAST regardless
	 * of section count: the cascade is punctuation, not a parade (constraint #6).
	 */
	maxCascade?: number;
	/** Re-run dependencies (e.g. a data/content key). Default `[]`. */
	deps?: ReadonlyArray<unknown>;
}

export type ResolvedRevealOptions = Required<Omit<RevealOptions, "mode" | "deps">>;

export const REVEAL_DEFAULTS: ResolvedRevealOptions = {
	y: 12,
	stagger: STAGGER.cells,
	duration: DUR.md,
	maxCascade: 0.7,
};

export function resolveRevealOptions(
	options: Omit<RevealOptions, "mode">,
): ResolvedRevealOptions {
	const { y, stagger, duration, maxCascade } = options;
	return {
		y: y ?? REVEAL_DEFAULTS.y,
		stagger: stagger ?? REVEAL_DEFAULTS.stagger,
		duration: duration ?? REVEAL_DEFAULTS.duration,
		maxCascade: maxCascade ?? REVEAL_DEFAULTS.maxCascade,
	};
}

/**
 * Builds the reveal timeline. Called ONLY inside the
 * `matchMedia("(prefers-reduced-motion: no-preference)")` branch, so the hidden
 * start state never lands on a reduced-motion user.
 *
 * Collects an optional single `[data-reveal-lead]` (lands first, full duration)
 * and the `[data-reveal]:not([data-reveal-lead])` cascade (staggered, overlaps
 * the lead's tail at `-=0.2`). Animates `opacity` 0→1 + `y` only — never
 * `autoAlpha` — so headings/copy/controls stay in the a11y tree.
 *
 * Returns the local cleanup that kills the timeline and `clearProps`-restores
 * every touched node, or `undefined` when there is nothing to reveal.
 */
export function buildReveal(
	gsap: GsapInstance,
	root: HTMLElement,
	opts: ResolvedRevealOptions,
	scrollTrigger?: { trigger: HTMLElement; start: string; once: boolean },
): (() => void) | undefined {
	const { y, stagger, duration, maxCascade } = opts;

	const lead = root.querySelector<HTMLElement>("[data-reveal-lead]");
	const sections = gsap.utils.toArray<HTMLElement>(
		root.querySelectorAll("[data-reveal]:not([data-reveal-lead])"),
	);

	if (lead === null && sections.length === 0)
		return undefined;

	// Clamp the stagger to the cascade budget: duration + (n-1)*eff <= maxCascade.
	// Shrink the stagger, never extend the timeline.
	const n = sections.length;
	const eff = n > 1
		? Math.min(stagger, Math.max(0, (maxCascade - duration) / (n - 1)))
		: 0;

	const hidden = [lead, ...sections].filter((el): el is HTMLElement => el !== null);
	gsap.set(hidden, { opacity: 0, y });

	const tl = gsap.timeline({
		defaults: { ease: EASE.out, duration },
		...(scrollTrigger !== undefined && { scrollTrigger }),
	});
	if (lead !== null)
		tl.to(lead, { opacity: 1, y: 0 }, 0);
	if (sections.length > 0) {
		tl.to(
			sections,
			{ opacity: 1, y: 0, stagger: eff },
			lead !== null ? "-=0.2" : 0,
		);
	}

	return () => {
		tl.scrollTrigger?.kill();
		tl.kill();
		gsap.set(hidden, { clearProps: "opacity,transform" });
	};
}
