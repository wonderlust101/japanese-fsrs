"use client";

// The hero deck-stack visual: fanned deck cards, position tokens, the tag
// pill, and the deck normalizer + level mark colors. Decorative (aria-hidden).

import type { HeroDeckPreview, HeroDeckTag } from "./today-hero-types";

import type { JlptPillLevel } from "@/components/ui/Pill";
import { JlptPill } from "@/components/ui/Pill";
import { formatCompactCount, safeNonNegativeInteger } from "./today-format";

// ── Deck stack ───────────────────────────────────────────────────────────────

export function DeckStack({
	decks,
	overflowDecks,
	resting = false,
	emptyLabel = "No deck data",
	emptyDescription = "Reviews can still start from the queue total.",
}: {
	decks: HeroDeckPreview[];
	overflowDecks: number;
	resting?: boolean;
	emptyLabel?: string;
	emptyDescription?: string;
}): React.JSX.Element {
	const visibleDecks = decks.slice(0, 3).map(normalizeHeroDeck);
	const safeOverflowDecks = safeNonNegativeInteger(overflowDecks);

	if (visibleDecks.length === 0) {
		return (
			<div className="today-hero-deck-stack relative z-10 flex h-[16.75rem] w-full max-w-[27.5rem] items-center justify-center" aria-hidden="true">
				<div className="today-hero-card-shell today-hero-card-single w-full max-w-[24.5rem]">
					<div className="today-hero-card-surface relative overflow-hidden rounded-xs border border-dashed border-soft-hairline bg-warm-paper-raised/70 p-5">
						<div className="mx-auto mb-4 flex h-16 max-w-[13rem] items-end justify-center gap-2 border-b border-soft-hairline/70" aria-hidden="true">
							<span className="block h-9 w-12 rotate-[-3deg] rounded-[1px] border border-soft-hairline bg-cream-inset" />
							<span className="block h-12 w-12 rotate-[2deg] rounded-[1px] border border-inari-vermillion/30 bg-inari-vermillion/10" />
							<span className="block h-8 w-12 rotate-[-1deg] rounded-[1px] border border-soft-hairline bg-warm-paper-base" />
						</div>
						<p className="font-mono text-xs text-faded-sumi">
							{emptyLabel}
						</p>
						<p className="mt-3 text-sm leading-relaxed text-faded-sumi">
							{emptyDescription}
						</p>
					</div>
				</div>
			</div>
		);
	}

	const visibleDeckCount = visibleDecks.length;

	return (
		<div className="today-hero-deck-stack relative z-10 h-[17.25rem] w-full max-w-[28rem]" aria-hidden="true">
			{visibleDecks.map((deck, index) => (
				<DeckStackCard
					key={deck.id}
					deck={deck}
					index={index}
					visibleDeckCount={visibleDeckCount}
					resting={resting}
					overflowDecks={index === 0 ? safeOverflowDecks : 0}
				/>
			))}
		</div>
	);
}

const STACK_POSITIONS = [
	"z-40 left-1/2 top-[98px] -translate-x-1/2 rotate-[-0.8deg]",
	"z-30 left-[55%] top-[64px] -translate-x-1/2 rotate-[1.6deg]",
	"z-20 left-[47%] top-[38px] -translate-x-1/2 rotate-[-2deg]",
] as const;
const TWO_DECK_POSITIONS = [
	"z-40 left-[47%] top-1/2 -translate-x-1/2 -translate-y-[30%] rotate-[-0.8deg]",
	"z-30 left-[56%] top-1/2 -translate-x-1/2 -translate-y-[52%] rotate-[1.6deg]",
] as const;
const SINGLE_DECK_POSITION = "z-40 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-0";

function DeckStackCard({
	deck,
	index,
	visibleDeckCount,
	resting,
	overflowDecks,
}: {
	deck: HeroDeckPreview;
	index: number;
	visibleDeckCount: number;
	resting: boolean;
	overflowDecks: number;
}): React.JSX.Element {
	const countLabel = deck.dueCount === 0
		? (resting ? "settled" : "no due cards")
		: `${formatCompactCount(deck.dueCount)} due`;

	return (
		<article
			data-deck-ornament
			className={[
				`today-hero-card-shell today-hero-card-${index} absolute w-[min(84%,22rem)]`,
				deckPositionClass(index, visibleDeckCount),
			].join(" ")}
		>
			<div
				className={[
					"today-hero-card-surface relative overflow-hidden rounded-xs",
					"border border-soft-hairline/85 bg-warm-paper-raised p-4",
				].join(" ")}
				style={{ borderTopColor: markColorForTag(deck.tag) }}
			>
				<div className="flex items-center justify-between gap-3">
					<span className="font-mono text-sm text-sumi-ink/60">
						Deck
					</span>
					<HeroDeckTagPill tag={deck.tag} />
				</div>

				<h3 className="mt-4 truncate text-base font-semibold text-sumi-ink">
					{deck.title}
				</h3>
				<p className="mt-1 truncate text-sm text-faded-sumi">
					{deck.subtitle}
				</p>

				<div className="mt-5 flex items-end justify-between gap-4">
					<p className="font-mono text-sm tabular-nums text-sumi-ink">
						{countLabel}
					</p>
					{overflowDecks > 0 && (
						<p className="font-mono text-xs tabular-nums text-faded-sumi">
							+
							{formatCompactCount(overflowDecks)}
							{" "}
							more
						</p>
					)}
				</div>
			</div>
		</article>
	);
}

function deckPositionClass(index: number, visibleDeckCount: number): string {
	if (visibleDeckCount === 1) {
		return SINGLE_DECK_POSITION;
	}

	if (visibleDeckCount === 2) {
		return TWO_DECK_POSITIONS[index] ?? TWO_DECK_POSITIONS[0];
	}

	return STACK_POSITIONS[index] ?? STACK_POSITIONS[0];
}

function HeroDeckTagPill({ tag }: { tag: HeroDeckTag }): React.JSX.Element {
	if (tag.kind === "level") {
		return <JlptPill level={tag.level} size="sm" />;
	}

	return <span className="h-5" aria-hidden="true" />;
}

function normalizeHeroDeck(deck: HeroDeckPreview): HeroDeckPreview {
	const {
		dueCount,
		id,
		newCount,
		reviewCount,
		subtitle,
		title,
		...rest
	} = deck;

	return {
		...rest,
		id: id.trim(),
		title: title.trim() || "Untitled deck",
		subtitle: subtitle.trim() || "Review queue",
		dueCount: safeNonNegativeInteger(dueCount),
		...(newCount === undefined ? {} : { newCount: safeNonNegativeInteger(newCount) }),
		...(reviewCount === undefined ? {} : { reviewCount: safeNonNegativeInteger(reviewCount) }),
	};
}

// ── Color tokens ─────────────────────────────────────────────────────────────

const LEVEL_MARK_COLORS: Record<JlptPillLevel, string> = {
	N5: "var(--color-deck-n5-mark)",
	N4: "var(--color-deck-n4-mark)",
	N3: "var(--color-deck-n3-mark)",
	N2: "var(--color-deck-n2-mark)",
	N1: "var(--color-deck-n1-mark)",
	beyond: "var(--color-deck-beyond-mark)",
	beyond_jlpt: "var(--color-deck-beyond-mark)",
	kana: "var(--color-deck-n4-mark)",
};

function markColorForTag(tag: HeroDeckTag): string {
	return tag.kind === "level"
		? LEVEL_MARK_COLORS[tag.level]
		: "var(--color-soft-hairline)";
}
