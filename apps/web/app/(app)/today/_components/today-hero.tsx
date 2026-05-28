"use client";

import type { DashboardHeroVariant } from "./today-hero-types";
import { CaughtUpContent, DueContent, FirstTimeContent, ResumeContent } from "./today-hero-content";

// The hero is split across sibling modules: ./today-hero-types (contract),
// ./today-hero-content (variants + layout), ./today-hero-deck-stack (visual),
// and ./today-hero-pre-session-note (the Due note). The public contract is
// re-exported here so existing ./today-hero import sites keep resolving.
export type { DashboardHeroVariant, DueQueue, HeroCta, HeroDeckPreview, HeroDeckTag, HeroKind, ResumeContextSnapshot } from "./today-hero-types";
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
	return (
		<section
			aria-labelledby="hero-headline"
			className="relative overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-base px-4 py-5 sm:px-6 sm:py-6 lg:px-7 lg:py-7"
		>
			<span
				aria-hidden="true"
				className="absolute inset-x-0 top-0 z-20 h-0.5 bg-inari-vermillion"
			/>

			<div className="relative z-10">
				{variant.kind === "due" && <DueContent queue={variant.queue} dateKey={dateKey} />}
				{variant.kind === "caught-up" && <CaughtUpContent />}
				{variant.kind === "first-time" && <FirstTimeContent />}
				{variant.kind === "resume" && <ResumeContent context={variant.context} />}
			</div>
		</section>
	);
}
