"use client";

import type { RefObject } from "react";

import type { RevealOptions } from "./use-reveal-shared";

import { gsap, useGSAP } from "@/lib/motion/register";
import { buildReveal, resolveRevealOptions } from "./use-reveal-shared";

/**
 * Mount-mode section reveal — fires once on mount, NO ScrollTrigger.
 *
 * Statically imports ONLY the core `@/lib/motion/register` barrel, so a route
 * that imports this hook can never drag `register-scroll` (ScrollTrigger, ~10kB
 * brotli) into the shared common chunk. This static split is the entire point of
 * shipping mount and scroll as separate files (spec §P2.5 / §P2.7).
 *
 * For above-the-fold hub/moment pages (review setup, drill setup, insights
 * overview, and the header/toolbar chrome of list/detail pages).
 *
 * Mirrors the `useEnterSettle` idiom: matchMedia gate, hidden start-state set
 * only inside `no-preference`, `gsap.set` + `.to` (not `.from`), `clearProps`
 * cleanup, `{ scope, dependencies }`.
 */
export function useRevealMount(
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
			mm.add("(prefers-reduced-motion: no-preference)", () => buildReveal(gsap, root, opts));

			return () => mm.revert();
		},
		{ scope: rootRef, dependencies: [...deps] },
	);
}
