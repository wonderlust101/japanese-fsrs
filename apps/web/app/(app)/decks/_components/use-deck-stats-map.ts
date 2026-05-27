"use client";

import type { ApiDeck, ApiDeckWithStats } from "@fsrs-japanese/shared-types";
import { useQueries } from "@tanstack/react-query";

import { getDeckAction } from "@/lib/actions/decks.actions";
import { queryKeys } from "@/lib/api/queryKeys";

export interface DeckStatsSnapshot {
	dueByDeckId: ReadonlyMap<string, number>;
	matureByDeckId: ReadonlyMap<string, { mature: number; total: number }>;
	pending: boolean;
}

const EMPTY_SNAPSHOT: DeckStatsSnapshot = {
	dueByDeckId: new Map(),
	matureByDeckId: new Map(),
	pending: false,
};

// Subscribes to per-deck detail queries and projects them to two stable maps.
// `combine` runs after every query update and returns the projection as a
// single referentially-stable object, so downstream memos don't churn on every
// parent render (the bug fixed here: `useQueries` returns a fresh array each
// render, which invalidated naive `useMemo` deps).
export function useDeckStatsMap(allDecks: ReadonlyArray<ApiDeck>): DeckStatsSnapshot {
	return useQueries({
		queries: allDecks.map(deck => ({
			queryKey: queryKeys.decks.detail(deck.id),
			queryFn: () => getDeckAction(deck.id),
		})),
		combine: (results) => {
			if (allDecks.length === 0)
				return EMPTY_SNAPSHOT;
			const dueByDeckId = new Map<string, number>();
			const matureByDeckId = new Map<string, { mature: number; total: number }>();
			let pending = false;
			for (let i = 0; i < allDecks.length; i++) {
				const deck = allDecks[i];
				const result = results[i];
				if (deck === undefined || result === undefined)
					continue;
				if (result.isPending)
					pending = true;
				const stats = result.data as ApiDeckWithStats | null | undefined;
				if (stats != null) {
					dueByDeckId.set(deck.id, stats.dueCount ?? 0);
					matureByDeckId.set(deck.id, { mature: stats.matureCount ?? 0, total: stats.cardCount });
				}
			}
			return { dueByDeckId, matureByDeckId, pending };
		},
	});
}
