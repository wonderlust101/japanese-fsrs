// Row mappers for the cross-deck Cards table — both directions:
//   • toResultRow            — ApiCrossDeckCardListItem (already deck-joined) → row
//   • apiCardToRow           — ApiCardListItem (deck-scoped) + deckId/deckName → row
//   • bulkMoveSyntheticCard  — synthetic single-card payload for the bulk-Move dialog
//   • truncate               — name truncation for toast labels
//
// The `cards` module owns CardsResultRow, so it owns the mappers; deck-side
// surfaces (deck-detail, deck-preview) import these instead of carrying their
// own copies.

import type { ApiCardListItem, ApiCrossDeckCardListItem } from "@fsrs-japanese/shared-types";
import type { CardsResultRow } from "./cards-results-table";

import { getSentenceFrontBack, getWordFields } from "@fsrs-japanese/shared-types";

export function toResultRow(item: ApiCrossDeckCardListItem): CardsResultRow {
	const wf = getWordFields(item);
	return {
		id: item.id,
		word: wf?.word ?? "—",
		reading: wf?.reading ?? "",
		meaning: wf?.meaning ?? "",
		deckId: item.deckId,
		deckName: item.deckName,
		jlptLevel: item.jlptLevel,
		partOfSpeech: wf?.partOfSpeech ?? null,
		state: item.state,
		isSuspended: item.isSuspended,
		lapses: item.lapses,
		due: item.due,
	};
}

/**
 * Maps the deck-list shape onto the Cards browser table's row shape so the
 * two pages can share the same rendering primitive. Sentence cards fall back
 * to front/back text for the headword/meaning so the row still says
 * something* useful even though the table is tuned for vocabulary cards.
 * `lapses` defaults to 0 because `ApiCardListItem` doesn't yet pick that
 * column — the health badge will activate on this page once `lapses` is
 * added to the picked schema (the backend service already projects it).
 */
export function apiCardToRow(card: ApiCardListItem, deckId: string, deckName: string): CardsResultRow {
	const wordFields = getWordFields(card);
	const sentence = getSentenceFrontBack(card);
	return {
		id: card.id,
		word: wordFields?.word ?? sentence?.front ?? "—",
		reading: wordFields?.reading ?? "",
		meaning: wordFields?.meaning ?? sentence?.back ?? "",
		deckId,
		deckName,
		jlptLevel: card.jlptLevel,
		partOfSpeech: wordFields?.partOfSpeech ?? null,
		state: card.state,
		isSuspended: card.isSuspended,
		lapses: 0,
		due: card.due,
	};
}

/**
 * Synthetic single-card payload so the bulk Move flow can reuse MoveCardDialog
 * (which is built around one card). Only the display label matters here; the
 * actual ids come from the live selection set at confirm time.
 */
export function bulkMoveSyntheticCard(count: number): ApiCardListItem {
	return {
		id: "bulk",
		fieldsData: { word: `${count} ${count === 1 ? "card" : "cards"}`, reading: "", meaning: "" },
		layoutType: "vocabulary",
		jlptLevel: null,
		state: 0 as ApiCardListItem["state"],
		isSuspended: false,
		due: new Date().toISOString(),
	};
}

export function truncate(name: string, max: number): string {
	if (name.length <= max)
		return name;
	return `${name.slice(0, max - 1).trimEnd()}…`;
}
