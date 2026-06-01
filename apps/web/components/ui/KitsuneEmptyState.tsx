"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { Logo } from "@/components/ui/Logo";
import { QuietLink } from "@/components/ui/QuietLink";
import { useEnterSettle } from "@/hooks/use-enter-settle";

interface KitsuneEmptyStateProps {
	/** Accessible name for the empty-state region. */
	ariaLabel: string;
	/** Display-font headline line: the kitsune's one quiet statement. */
	headline: string;
	/** Body prose; a string, or rich nodes when copy branches (e.g. a dev hint). */
	body: ReactNode;
	ctaHref: string;
	ctaLabel: string;
}

/**
 * The full-page "kitsune at a quiet moment" empty state: a centered kitsune
 * mark, a display-font headline, a faded prose line, and one quiet CTA. This
 * is the larger, borderless brand beat that the page-level surfaces reach for
 * when a whole report or list can't yet appear.
 *
 * Motion (per `docs/motion/DASHBOARD_MOTION_SPEC.md` §2.5): the kitsune mark
 * settles in (`scale 0.96 → 1`, autoAlpha — decorative), then the copy group
 * (headline, body, CTA) rises and fades with a small stagger, overlapping the
 * tail of the mark settle. Copy uses `opacity`, never `autoAlpha`, so the
 * headline and link stay in the a11y tree through the tween. Gated behind
 * `prefers-reduced-motion: no-preference`; SSR markup is the reduced-motion
 * experience.
 *
 * Deliberately distinct from {@link EmptyState}, the compact bordered
 * kanji-card used for zero-data / no-match / inline-error *inside* a content
 * area. Two archetypes, one per scale; do not collapse them.
 *
 * Extracted from the structurally-identical empty states the Insights pages
 * (and weak-spots) had each hand-rolled, so only the copy varies per surface.
 */
export function KitsuneEmptyState({
	ariaLabel,
	headline,
	body,
	ctaHref,
	ctaLabel,
}: KitsuneEmptyStateProps): React.JSX.Element {
	const rootRef = useRef<HTMLElement>(null);

	useEnterSettle(rootRef, {
		ornamentSelector: "[data-empty-ornament]",
		copySelector: "[data-empty-copy]",
	});

	return (
		<section
			ref={rootRef}
			aria-label={ariaLabel}
			className="mx-auto mt-12 flex flex-col items-center gap-y-6 py-6 text-center lg:mt-20"
		>
			<span data-empty-ornament className="inline-block">
				<Logo size={112} showWordmark={false} priority />
			</span>

			<p data-empty-copy className="max-w-measure-tight font-display text-lg leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
				{headline}
			</p>

			<p data-empty-copy className="max-w-measure text-sm leading-relaxed text-faded-sumi">
				{body}
			</p>

			<div data-empty-copy className="pt-2">
				<QuietLink href={ctaHref} tone="brand" trailingArrow size="md">
					{ctaLabel}
				</QuietLink>
			</div>
		</section>
	);
}
