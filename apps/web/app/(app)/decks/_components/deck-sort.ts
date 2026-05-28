// Deck comparison + name-truncation helpers for the decks list. Lifted out of deck-list.tsx.

import type { ApiDeck } from "@fsrs-japanese/shared-types";

import type { DecksSortKey } from "./use-deck-prefs";

import { inferDeckLevel } from "@/lib/deck-level";

export function compareDecks(
	a: ApiDeck,
	b: ApiDeck,
	sort: DecksSortKey,
	slotById: ReadonlyMap<string, number>,
	dueById: ReadonlyMap<string, number>,
	displayNameOf: (deck: ApiDeck) => string,
): number {
	switch (sort) {
		case "study-order": {
			const ai = slotById.get(a.id) ?? Number.MAX_SAFE_INTEGER;
			const bi = slotById.get(b.id) ?? Number.MAX_SAFE_INTEGER;
			return ai - bi;
		}
		case "alphabetical":
			return displayNameOf(a).localeCompare(displayNameOf(b), "en", { sensitivity: "base" });
		case "recently-reviewed":
			return b.updatedAt.localeCompare(a.updatedAt);
		case "most-due-first": {
			const ad = dueById.get(a.id) ?? 0;
			const bd = dueById.get(b.id) ?? 0;
			if (ad !== bd)
				return bd - ad;
			return displayNameOf(a).localeCompare(displayNameOf(b));
		}
		case "jlpt-level": {
			const order: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5, beyond_jlpt: 6, kana: 0 };
			const aLevel = inferDeckLevel(a) ?? "";
			const bLevel = inferDeckLevel(b) ?? "";
			const ai = order[aLevel] ?? 99;
			const bi = order[bLevel] ?? 99;
			if (ai !== bi)
				return ai - bi;
			return displayNameOf(a).localeCompare(displayNameOf(b));
		}
	}
}

export function truncate(name: string, max: number): string {
	if (name.length <= max)
		return name;
	return `${name.slice(0, max - 1).trimEnd()}…`;
}
