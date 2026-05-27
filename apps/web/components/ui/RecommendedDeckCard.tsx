"use client";

import type { JlptPillLevel } from "./Pill";
import { JlptPill } from "./Pill";

interface RecommendedDeckCardProps {
	name: string;
	description: string;
	level: JlptPillLevel;
	levelLabel: string;
	count: number;
	subscribed: boolean;
	onToggle: () => void;
}

function PlusGlyph(): React.JSX.Element {
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
			<path
				d="M6 1.5v9M1.5 6h9"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
			/>
		</svg>
	);
}

function CheckGlyph(): React.JSX.Element {
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
			<path
				d="M2 6 L 5 9 L 10 3"
				stroke="currentColor"
				strokeWidth="1.25"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * A list-row affordance for the Decks step. Lives nested inside the
 * onboarding foreground card, so it does NOT carry the host Card anatomy
 * (no top stripe — nested cards are anti-pattern). Renders as a clean
 * hairline-bordered row with a subscribe toggle and a level pill.
 */
export function RecommendedDeckCard({
	name,
	description,
	level,
	levelLabel,
	count,
	subscribed,
	onToggle,
}: RecommendedDeckCardProps): React.JSX.Element {
	return (
		<div
			className={[
				"ui-motion-colors group flex w-full items-center gap-4 px-4 py-3 sm:px-5 sm:py-4 rounded-xs",
				"border",
				subscribed
					? "border-inari-vermillion/40 bg-vermillion-wash/40"
					: "border-soft-hairline bg-transparent hover:bg-cream-inset/40",
			].join(" ")}
		>
			<JlptPill level={level} label={levelLabel} size="sm" />

			<div className="flex-1 min-w-0">
				<p className="truncate text-sm font-medium text-sumi-ink">{name}</p>
				{/* line-clamp-2 lets longer descriptions wrap to two lines instead of
            cutting off mid-word with a single-line ellipsis. Mirrors how the
            /decks/premade catalogue treats deck descriptions and keeps the
            row's vertical rhythm stable across short + medium copy. */}
				<p className="mt-0.5 line-clamp-2 text-xs leading-snug text-faded-sumi">
					{description}
				</p>
			</div>

			<p className="shrink-0 font-mono text-xs tabular-nums text-faded-sumi">
				{count.toLocaleString()}
			</p>

			<button
				type="button"
				onClick={onToggle}
				aria-pressed={subscribed}
				className={[
					"ui-motion-pressable shrink-0 inline-flex items-center justify-center gap-2 h-8 px-3 rounded-xs text-xs font-medium",
					"border",
					"focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2",
					subscribed
						? "bg-inari-vermillion border-inari-vermillion text-warm-paper-raised hover:bg-inari-vermillion-deep hover:border-inari-vermillion-deep"
						: "bg-warm-paper-raised border-soft-hairline text-sumi-ink hover:border-faded-sumi",
				].join(" ")}
			>
				{subscribed ? <CheckGlyph /> : <PlusGlyph />}
				<span>{subscribed ? "Added" : "Add"}</span>
			</button>
		</div>
	);
}
