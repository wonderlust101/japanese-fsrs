"use client";

import type { RefObject } from "react";

import { DUR, EASE, STAGGER } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";

interface EnterSettleOptions {
	/**
	 * Decorative lead element(s) (icon/ornament/card chrome). Animated with
	 * `autoAlpha` since they carry no a11y semantics. Optional.
	 */
	ornamentSelector?: string;
	/** Ornament settle: scale from this toward 1. Default 0.96. */
	ornamentScaleFrom?: number;
	/** Ornament settle duration (s). Default `DUR.lg`. */
	ornamentDuration?: number;
	/**
	 * Content element(s) that must stay in the a11y tree (headings, body, CTAs,
	 * stat figures). Animated with `opacity` (never `autoAlpha`) + a small `y`
	 * rise, staggered. Required.
	 */
	copySelector: string;
	/** Copy rise distance (px). Default 10. */
	copyY?: number;
	/** Per-copy-item stagger (s). Default `STAGGER.copy`. */
	copyStagger?: number;
	/** Copy item duration (s). Default `DUR.md`. */
	copyDuration?: number;
	/**
	 * Position the copy cascade relative to the ornament settle. Default
	 * `"-=0.25"` so copy overlaps the tail of the ornament (ornament leads).
	 * Ignored when there is no ornament (copy then starts at 0).
	 */
	copyPosition?: string;
	/** Re-run dependencies (e.g. a content key). Default `[]`. */
	deps?: ReadonlyArray<unknown>;
}

/**
 * Shared mount-enter "settle" used by the EmptyState ornament+copy beat and any
 * surface with the same shape (a decorative lead element, then a staggered copy
 * group). Mirrors the auth-shell idiom: `gsap.set()` + `.to()` (not `from`) so a
 * client-route re-run can't strand an element hidden, hidden start-states set
 * only inside the `no-preference` branch, and `clearProps` cleanup.
 *
 * Decorative ornament → `autoAlpha`; content copy → `opacity` (constraint #3 /
 * §7: the a11y tree never goes `visibility:hidden`).
 */
export function useEnterSettle(
	rootRef: RefObject<HTMLElement | null>,
	options: EnterSettleOptions,
): void {
	const {
		ornamentSelector,
		ornamentScaleFrom = 0.96,
		ornamentDuration = DUR.lg,
		copySelector,
		copyY = 10,
		copyStagger = STAGGER.copy,
		copyDuration = DUR.md,
		copyPosition = "-=0.25",
		deps = [],
	} = options;

	useGSAP(
		() => {
			const root = rootRef.current;
			if (root === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const ornaments = ornamentSelector !== undefined
					? gsap.utils.toArray<HTMLElement>(root.querySelectorAll(ornamentSelector))
					: [];
				const copy = gsap.utils.toArray<HTMLElement>(root.querySelectorAll(copySelector));

				if (ornaments.length === 0 && copy.length === 0)
					return;

				if (ornaments.length > 0)
					gsap.set(ornaments, { autoAlpha: 0, scale: ornamentScaleFrom });
				if (copy.length > 0)
					gsap.set(copy, { opacity: 0, y: copyY });

				const tl = gsap.timeline({ defaults: { ease: EASE.out } });
				if (ornaments.length > 0) {
					tl.to(ornaments, {
						autoAlpha: 1,
						scale: 1,
						duration: ornamentDuration,
					}, 0);
				}
				if (copy.length > 0) {
					tl.to(
						copy,
						{
							opacity: 1,
							y: 0,
							duration: copyDuration,
							ease: EASE.exit,
							stagger: copyStagger,
						},
						ornaments.length > 0 ? copyPosition : 0,
					);
				}

				return () => {
					tl.kill();
					if (ornaments.length > 0)
						gsap.set(ornaments, { clearProps: "opacity,visibility,transform" });
					if (copy.length > 0)
						gsap.set(copy, { clearProps: "opacity,transform" });
				};
			});

			return () => mm.revert();
		},
		{ scope: rootRef, dependencies: [...deps] },
	);
}
