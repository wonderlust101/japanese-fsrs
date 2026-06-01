"use client";

import type { DashboardHeroVariant } from "./today-hero-types";
import { useRef } from "react";
import { DUR, EASE, STAGGER } from "@/lib/motion/easings";
import { gsap, useGSAP } from "@/lib/motion/register";
import { CaughtUpContent, DueContent, FirstTimeContent } from "./today-hero-content";

// The hero is split across sibling modules: ./today-hero-types (contract),
// ./today-hero-content (variants + layout), ./today-hero-deck-stack (visual),
// and ./today-hero-pre-session-note (the Due note). The public contract is
// re-exported here so existing ./today-hero import sites keep resolving.
export type { DashboardHeroVariant, DueQueue, HeroCta, HeroDeckPreview, HeroDeckTag, HeroKind } from "./today-hero-types";
export { getHeroCta, WEAK_SPOT_QUERY_LIMIT } from "./today-hero-types";

interface DashboardHeroProps {
	variant: DashboardHeroVariant;
	/**
	 * Learner-local calendar key (YYYY-MM-DD). Threaded down for the
	 * pre-session note so the Tomo note cache rotates at local midnight.
	 * Omit or pass `undefined` from dev/showcase surfaces that don't wire
	 * a real calendar — the slot falls back to the preparation line in
	 * that case. The explicit `| undefined` is required to interop with
	 * `exactOptionalPropertyTypes` when the value originates from a
	 * possibly-undefined source.
	 */
	dateKey?: string | undefined;
}

// ── Entry component ──────────────────────────────────────────────────────────

export function DashboardHero({ variant, dateKey }: DashboardHeroProps): React.JSX.Element {
	const sectionRef = useRef<HTMLElement>(null);

	useGSAP(
		() => {
			const root = sectionRef.current;
			if (root === null)
				return;

			const mm = gsap.matchMedia();
			mm.add("(prefers-reduced-motion: no-preference)", () => {
				const ornaments = gsap.utils.toArray<HTMLElement>(
					root.querySelectorAll("[data-deck-ornament]"),
				);
				const headline = root.querySelector<HTMLElement>("[data-hero-headline]");
				const meta = root.querySelector<HTMLElement>("[data-hero-meta]");

				if (ornaments.length === 0 && headline === null && meta === null)
					return;

				// Hidden start-states: ornaments use autoAlpha (aria-hidden decorative);
				// headline + meta use opacity-only (a11y tree must stay visible).
				if (ornaments.length > 0)
					gsap.set(ornaments, { autoAlpha: 0, scale: 0.97 });
				if (headline !== null)
					gsap.set(headline, { opacity: 0, y: 12 });
				if (meta !== null)
					gsap.set(meta, { opacity: 0, y: 8 });

				const tl = gsap.timeline({ defaults: { ease: EASE.out } });

				// Phase 1: deck cards fan in (decorative, staggered).
				if (ornaments.length > 0) {
					tl.to(ornaments, {
						autoAlpha: 1,
						scale: 1,
						duration: DUR.lg,
						stagger: STAGGER.cells,
					}, 0);
				}

				// Phase 2: headline rises into place, overlapping the ornament tail.
				if (headline !== null) {
					tl.to(headline, {
						opacity: 1,
						y: 0,
						duration: DUR.lg,
					}, ornaments.length > 0 ? "-=0.38" : 0);
				}

				// Phase 3: supporting content (breakdown, note, CTAs) follows.
				if (meta !== null) {
					tl.to(meta, {
						opacity: 1,
						y: 0,
						duration: DUR.md,
						ease: EASE.exit,
					}, "-=0.32");
				}

				return () => {
					tl.kill();
					if (ornaments.length > 0)
						gsap.set(ornaments, { clearProps: "opacity,visibility,transform" });
					if (headline !== null)
						gsap.set(headline, { clearProps: "opacity,transform" });
					if (meta !== null)
						gsap.set(meta, { clearProps: "opacity,transform" });
				};
			});

			return () => mm.revert();
		},
		{ scope: sectionRef, dependencies: [variant.kind] },
	);

	return (
		<section
			ref={sectionRef}
			aria-labelledby="hero-headline"
			className="relative overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-base px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7"
		>
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 z-20 h-0.5 bg-inari-vermillion"
			/>

			<div className="relative z-10">
				{variant.kind === "due" && <DueContent queue={variant.queue} dateKey={dateKey} isFirstVisit={variant.isFirstVisit} />}
				{variant.kind === "caught-up" && <CaughtUpContent />}
				{variant.kind === "first-time" && <FirstTimeContent />}
			</div>
		</section>
	);
}
