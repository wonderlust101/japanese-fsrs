"use client";

// Empty / no-matches / error states for the decks list. Lifted out of deck-list.tsx.

import Link from "next/link";

import { Button } from "@/components/ui/Button";
import { EmptyState as EmptyStatePanel } from "@/components/ui/EmptyState";

export function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
	return (
		<EmptyStatePanel kanji="空" title="Your library is empty." className="mt-10">
			<p className="max-w-measure-tight text-sm text-faded-sumi">
				A few minutes a day adds up. Start with a premade deck if you're not sure where to begin.
			</p>
			<div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
				<Button size="md" onClick={onCreate}>Build my own deck</Button>
				<Link href="/decks/premade" className="inline-flex">
					<Button size="md" variant="secondary" className="w-full sm:w-auto">
						Browse premade decks
					</Button>
				</Link>
			</div>
		</EmptyStatePanel>
	);
}

export function NoMatchesState({
	query,
	view,
	typeFilter,
}: {
	query: string;
	view: "active" | "mature" | "archived";
	typeFilter: string;
}): React.JSX.Element {
	let body: React.ReactNode;
	if (query.length > 0) {
		body = (
			<>
				No decks match
				{" "}
				<span className="text-sumi-ink/85">
					'
					{query}
					'
				</span>
				. Try a different term.
			</>
		);
	} else if (view === "archived") {
		body = "No archived decks yet. Archive a deck from its options menu to hide it from the queue.";
	} else if (view === "mature") {
		body = "No fully-mature decks yet. A deck becomes mature once every card has reached a 21-day interval.";
	} else if (typeFilter !== "all") {
		body = `No ${typeFilter} decks. Adjust the Type filter to see more.`;
	} else {
		body = "No decks in this view.";
	}

	// Kanji eyebrow gives the empty state the same brand vocabulary the
	// cards page uses (空 for filtered-zero, 始 for first-run). 棚 ("tana",
	// shelf) is the natural kanji for "decks" — it's literally the noun
	// for the rack/shelf objects of the same shape. Keeps the visual
	// dialect consistent between sibling pages.
	return (
		<div className="mt-2 rounded-xs border border-soft-hairline bg-cream-inset/45 p-6 text-center">
			<span
				lang="ja"
				aria-hidden="true"
				className="font-display text-numeral leading-none text-inari-vermillion/75"
			>
				棚
			</span>
			<h2 className="mt-3 text-sm font-normal text-faded-sumi">{body}</h2>
		</div>
	);
}

export function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
	return (
		<div className="mt-2 rounded-xs border border-soft-hairline bg-cream-inset/55 p-6 text-center">
			<h2 className="text-sm font-medium text-sumi-ink">Couldn't load your decks.</h2>
			<p className="mt-1 text-sm text-faded-sumi">
				The library tried to read from the server and didn't get a reply. Try again in a moment.
			</p>
			<div className="mt-4">
				<Button size="sm" variant="secondary" onClick={onRetry}>
					Try again
				</Button>
			</div>
		</div>
	);
}
