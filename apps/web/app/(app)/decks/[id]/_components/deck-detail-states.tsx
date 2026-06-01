"use client";

// Empty / no-match / error states for the deck-detail card list, plus the
// shared Study-deck CTA. Lifted out of deck-detail-view.tsx.

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Primary "Study deck" action, shared by the desktop header slot and the
 * mobile sticky bar. When disabled it renders a bare button (no `<Link>`):
 * the Button sets `pointer-events-none` while disabled, so wrapping it in an
 * anchor would let the parent link still navigate. The `reason` surfaces as a
 * hover title; the page's archived notice / empty state carry it in-flow for
 * touch and screen-reader users.
 */
export function StudyDeckCta({
	href,
	disabled,
	reason,
	full = false,
	size = "md",
}: {
	href: string;
	disabled: boolean;
	reason: string;
	full?: boolean;
	size?: "md" | "lg";
}): React.JSX.Element {
	const button = (
		<Button size={size} disabled={disabled} className={full ? "w-full" : ""}>
			Study deck
		</Button>
	);
	if (disabled) {
		return <span title={reason} className={full ? "block" : "inline-block"}>{button}</span>;
	}
	return <Link href={href} className={full ? "block" : ""}>{button}</Link>;
}

export function EmptyDeckState({ deckId }: { deckId: string }): React.JSX.Element {
	return (
		<EmptyState kanji="空" title="This deck is empty">
			<p className="max-w-measure-tight text-sm text-faded-sumi">
				Add your first card to start studying, or browse premade starter decks.
			</p>
			<div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
				<Link href={`/add?deck=${encodeURIComponent(deckId)}`}>
					<Button size="md">Add Japanese</Button>
				</Link>
				<Link href="/decks/premade">
					<Button size="md" variant="secondary">Browse premade decks</Button>
				</Link>
			</div>
		</EmptyState>
	);
}

export function NoMatchState({
	searchValue,
	selectedStatusLabel,
	onClearSearch,
}: {
	searchValue: string;
	selectedStatusLabel: string;
	onClearSearch: () => void;
}): React.JSX.Element {
	return (
		<EmptyState kanji="空" density="quiet">
			<p className="max-w-measure-tight text-sm text-faded-sumi">
				{searchValue.length > 0
					? (
							<>
								No cards match
								{" "}
								<span className="font-medium text-sumi-ink">
									'
									{searchValue}
									'
								</span>
								.
								{" "}
								<button
									type="button"
									onClick={onClearSearch}
									className="text-sumi-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
								>
									Clear search
								</button>
								.
							</>
						)
					: (
							<>
								No
								{" "}
								{selectedStatusLabel.toLowerCase()}
								{" "}
								{" "}
								{" "}
								cards in this deck.
							</>
						)}
			</p>
		</EmptyState>
	);
}

export function CardListErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
	return (
		<EmptyState density="quiet" role="alert">
			<div>
				<p className="text-sm font-medium text-sumi-ink">Couldn't load this deck's cards.</p>
				<p className="mt-1 max-w-measure-tight text-sm text-faded-sumi">
					The list tried to read from the server and didn't get a reply. Try again in a moment.
				</p>
			</div>
			<Button size="sm" variant="secondary" onClick={onRetry}>
				Try again
			</Button>
		</EmptyState>
	);
}
