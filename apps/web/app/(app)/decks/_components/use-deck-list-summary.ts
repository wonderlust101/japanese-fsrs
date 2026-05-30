"use client";

import type { ApiDeck } from "@fsrs-japanese/shared-types";

import type { HeaderVariant } from "./decks-header";

import type { useArchiveSet, useStudyOrder } from "./use-deck-prefs";
import type { DeckStatsSnapshot } from "./use-deck-stats-map";
import { useMemo } from "react";

type ArchiveSet = ReturnType<typeof useArchiveSet>;
type StudyOrder = ReturnType<typeof useStudyOrder>;

interface UseDeckListSummaryArgs {
	allDecks: ReadonlyArray<ApiDeck>;
	archiveSet: ArchiveSet;
	studyOrder: StudyOrder;
	dueByDeckId: DeckStatsSnapshot["dueByDeckId"];
	matureByDeckId: DeckStatsSnapshot["matureByDeckId"];
	displayNameOf: (deck: ApiDeck) => string;
	isLoading: boolean;
	isError: boolean;
	searchQuery: string;
	/** From `useDeckListFiltering` — the post-filter match count. */
	totalCount: number;
}

export interface DeckListSummary {
	activeCount: number;
	archivedCount: number;
	matureTabCount: number;
	totalDueCount: number;
	decksWithDueCount: number;
	priorityDeckName: string | null;
	headerVariant: HeaderVariant;
}

/**
 * Derives the Decks page's header summary: the tab counts (active / mature /
 * archived), the due-workload rollup, the priority deck's display name, and the
 * `HeaderVariant` the `DecksHeader` renders from. Read-only projection of the
 * deck list + stats; extracted from `deck-list.tsx` with identical memo deps.
 */
export function useDeckListSummary(args: UseDeckListSummaryArgs): DeckListSummary {
	const {
		allDecks,
		archiveSet,
		studyOrder,
		dueByDeckId,
		matureByDeckId,
		displayNameOf,
		isLoading,
		isError,
		searchQuery,
		totalCount,
	} = args;

	function isFullyMature(deckId: string): boolean {
		const m = matureByDeckId.get(deckId);
		if (m === undefined)
			return false;
		return m.total > 0 && m.mature >= m.total;
	}

	const archivedCount = useMemo(
		() => allDecks.filter(d => archiveSet.isArchived(d.id)).length,
		[allDecks, archiveSet],
	);
	const activeCount = allDecks.length - archivedCount;

	// Mature-tab population: non-archived decks at 100% mature. Hidden from the
	// count until stats arrive — same behavior as the filter itself.
	const matureTabCount = useMemo(() => {
		let n = 0;
		allDecks.forEach((d) => {
			if (archiveSet.isArchived(d.id))
				return;
			if (isFullyMature(d.id))
				n += 1;
		});
		return n;
	// eslint-disable-next-line react-hooks/exhaustive-deps -- isFullyMature is a pure reader of matureByDeckId, which is already listed; depending on the function identity would recompute every render.
	}, [allDecks, archiveSet, matureByDeckId]);

	// Roll up due workload across all active decks for the header status line.
	const { totalDueCount, decksWithDueCount } = useMemo(() => {
		let total = 0;
		let decks = 0;
		allDecks.forEach((d) => {
			if (archiveSet.isArchived(d.id))
				return;
			const due = dueByDeckId.get(d.id) ?? 0;
			if (due > 0)
				decks += 1;
			total += due;
		});
		return { totalDueCount: total, decksWithDueCount: decks };
	}, [allDecks, archiveSet, dueByDeckId]);

	const priorityDeckId = studyOrder.priorityDeckId;
	const priorityDeckName = useMemo(() => {
		if (priorityDeckId === null)
			return null;
		if (archiveSet.isArchived(priorityDeckId))
			return null;
		const deck = allDecks.find(d => d.id === priorityDeckId);
		return deck === undefined ? null : displayNameOf(deck);
	}, [priorityDeckId, allDecks, archiveSet, displayNameOf]);

	const headerVariant: HeaderVariant = useMemo(() => {
		if (isLoading)
			return { kind: "loading" };
		if (isError)
			return { kind: "error" };
		if (allDecks.length === 0)
			return { kind: "empty" };
		if (searchQuery.length > 0) {
			return { kind: "search", query: searchQuery, matchedCount: totalCount, totalCount: allDecks.length };
		}
		return {
			kind: "default",
			activeCount,
			archivedCount,
			priorityDeckName,
			totalDueCount,
			decksWithDueCount,
		};
	}, [isLoading, isError, allDecks.length, searchQuery, totalCount, activeCount, archivedCount, priorityDeckName, totalDueCount, decksWithDueCount]);

	return {
		activeCount,
		archivedCount,
		matureTabCount,
		totalDueCount,
		decksWithDueCount,
		priorityDeckName,
		headerVariant,
	};
}
