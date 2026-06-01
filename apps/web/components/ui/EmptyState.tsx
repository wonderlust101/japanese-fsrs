"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { useEnterSettle } from "@/hooks/use-enter-settle";

type EmptyStateDensity = "primary" | "quiet";

interface EmptyStateProps {
	/**
	 * Vermillion display-kanji ornament (e.g. 始 / 空). The shared empty-surface
	 * device. Omit for error states, which lead with the message.
	 */
	kanji?: string;
	/** Bold title line. Omit for the quietest states (a one-line no-match). */
	title?: string;
	/**
	 * Visual tier. `primary` is the loud "nothing here yet" beat (bigger kanji,
	 * more padding); `quiet` is the secondary beat (no-match, inline error) one
	 * step down, per the documented "hierarchy through scale" the deck surfaces
	 * already used. Same bordered card either way.
	 */
	density?: EmptyStateDensity;
	/** a11y role on the container. `status` (default) for empties; `alert` for errors. */
	role?: "status" | "alert";
	/** Outer-margin escape hatch (e.g. `mt-10` when the panel follows a toolbar). */
	className?: string;
	/** Body copy and any CTA(s). */
	children: ReactNode;
}

/**
 * The one empty / zero-data / inline-error panel for the app: a centered,
 * bordered warm-paper card with an optional vermillion kanji ornament, an
 * optional title, and body + CTA as children. Replaces the five hand-built
 * variants that had drifted on border, padding, gap, and title weight.
 *
 * Motion (per `docs/motion/DASHBOARD_MOTION_SPEC.md` §2.5): on mount the kanji
 * ornament settles (`scale 0.96 → 1`, autoAlpha — decorative), and the copy
 * group (title + body/CTA children) rises and fades in with a small stagger,
 * overlapping the tail of the ornament (ornament leads). Copy uses `opacity`,
 * never `autoAlpha`, so the heading and CTA stay in the a11y tree through the
 * tween. Gated behind `prefers-reduced-motion: no-preference`; the SSR markup is
 * the reduced-motion experience (everything at its final state).
 *
 * For the full-page kitsune empty beat (a whole report or list that can't yet
 * appear), use the sibling {@link KitsuneEmptyState} instead: a different,
 * larger composition that intentionally stays separate from this card.
 */
export function EmptyState({
	kanji,
	title,
	density = "primary",
	role = "status",
	className = "",
	children,
}: EmptyStateProps): React.JSX.Element {
	const isPrimary = density === "primary";
	const rootRef = useRef<HTMLDivElement>(null);

	useEnterSettle(rootRef, {
		ornamentSelector: "[data-empty-ornament]",
		copySelector: "[data-empty-copy]",
	});

	return (
		<div
			ref={rootRef}
			role={role}
			className={[
				"flex flex-col items-center rounded-xs border border-soft-hairline bg-warm-paper-raised text-center",
				isPrimary ? "gap-4 px-6 py-12" : "gap-3 px-6 py-10",
				className,
			].filter(c => c.length > 0).join(" ")}
		>
			{kanji !== undefined && (
				<span
					lang="ja"
					aria-hidden="true"
					data-empty-ornament
					className={[
						"font-display leading-none",
						isPrimary ? "text-3xl text-inari-vermillion" : "text-numeral text-inari-vermillion/75",
					].join(" ")}
				>
					{kanji}
				</span>
			)}
			{title !== undefined && (
				<h2 data-empty-copy className="text-lg font-semibold text-sumi-ink">{title}</h2>
			)}
			{/* Children (body + CTA) grouped into one copy item so the settle
          stagger has a single trailing target. The wrapper inherits the
          column gap/centering so spacing is unchanged from a flat list. */}
			<div
				data-empty-copy
				className={[
					"flex flex-col items-center",
					isPrimary ? "gap-4" : "gap-3",
				].join(" ")}
			>
				{children}
			</div>
		</div>
	);
}
