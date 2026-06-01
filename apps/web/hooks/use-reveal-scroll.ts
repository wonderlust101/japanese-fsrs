"use client";

import type { RefObject } from "react";

import type { RevealOptions } from "./use-reveal-shared";

// register-scroll (not the core register) so ScrollTrigger is registered for the
// `scrollTrigger:` timeline config below — and stays in the importing route's
// chunk, not the shared common chunk.
import { gsap, useGSAP } from "@/lib/motion/register-scroll";
import { buildReveal, resolveRevealOptions } from "./use-reveal-shared";

/**
 * Scroll-mode section reveal — wraps the cascade in a
 * `ScrollTrigger { start: "top 85%", once: true }`.
 *
 * Statically imports `@/lib/motion/register-scroll`, so ScrollTrigger lands in
 * the chunk of any route that imports THIS hook. Use it only on routes that
 * already pay the ScrollTrigger cost via the Pass-1 chart draw-on
 * (`useScrollDrawOn`) — the insights routes — so it is free there.
 *
 * Mirrors the `useScrollDrawOn` idiom: matchMedia gate, ScrollTrigger created
 * only inside `no-preference`, `clearProps` cleanup, `{ scope, dependencies }`.
 */
export function useRevealScroll(
	rootRef: RefObject<HTMLElement | null>,
	options: Omit<RevealOptions, "mode">,
): void {
	const { deps = [] } = options;
	const opts = resolveRevealOptions(options);

	useGSAP(
		() => {
			const root = rootRef.current;
			if (root === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () =>
				buildReveal(gsap, root, opts, { trigger: root, start: "top 85%", once: true }));

			return () => mm.revert();
		},
		{ scope: rootRef, dependencies: [...deps] },
	);
}
