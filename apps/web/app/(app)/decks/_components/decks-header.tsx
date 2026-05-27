import React from "react";

import { PAGE_HEADER_PADDING, PageHeader } from "@/components/ui/PageHeader";

/**
 * Canonical Tomo page header for the Decks page.
 *
 * Replaces the earlier tinted-panel editorial header so Decks joins the same
 * kanji-eyebrow + display-title + status-subtitle rhythm used by Today and
 * Review Setup. The status sub-line communicates due workload across all
 * decks in one sentence so the user understands their shape of the day
 * before scanning the list.
 */

export interface DecksHeaderProps {
	variant: HeaderVariant;
}

export type HeaderVariant
	= | { kind: "loading" }
		| { kind: "error" }
		| { kind: "empty" }
		| { kind: "search"; query: string; matchedCount: number; totalCount: number }
		| {
			kind: "default";
			activeCount: number;
			archivedCount: number;
			priorityDeckName: string | null;
			totalDueCount: number;
			decksWithDueCount: number;
		};

export function DecksHeader({ variant }: DecksHeaderProps): React.JSX.Element {
	const subtitle = buildSubtitleText(variant);

	return (
		<div className={PAGE_HEADER_PADDING}>
			<PageHeader
				kanji="棚"
				label="Decks"
				title="Decks"
				subtitle={subtitle}
			/>
		</div>
	);
}

function buildSubtitleText(variant: HeaderVariant): string {
	switch (variant.kind) {
		case "loading":
			return "Loading your decks.";
		case "error":
			return "Couldn't reach your decks.";
		case "empty":
			return "Empty for now. Add a deck to begin.";
		case "search": {
			const { totalCount, matchedCount, query } = variant;
			return `${matchedCount} of ${totalCount} decks matching '${query}'.`;
		}
		case "default": {
			const { activeCount, totalDueCount, decksWithDueCount } = variant;
			if (activeCount === 0) {
				return "No active decks. Restore an archived deck or add a new one.";
			}
			if (totalDueCount === 0) {
				return `${activeCount} ${plural(activeCount, "deck")}. Nothing due right now.`;
			}
			const deckWord = plural(decksWithDueCount, "deck");
			return `${totalDueCount} due across ${decksWithDueCount} ${deckWord} today.`;
		}
	}
}

function plural(n: number, word: string): string {
	return n === 1 ? word : `${word}s`;
}
