"use client";

import type { ApiDeck } from "@fsrs-japanese/shared-types";
import type { Dispatch, SetStateAction } from "react";

import type { DecksPageSize } from "./decks-pagination";

import type { DeckViewPrefs, useArchiveSet, useStudyOrder } from "./use-deck-prefs";
import type { DeckStatsSnapshot } from "./use-deck-stats-map";
import { useEffect, useMemo, useState } from "react";

import { compareDecks } from "./deck-sort";

type ArchiveSet = ReturnType<typeof useArchiveSet>;
type StudyOrder = ReturnType<typeof useStudyOrder>;

// Default page size on first load. Users can pick from DECKS_PAGE_SIZE_OPTIONS
// via the per-page selector in the footer.
const DEFAULT_DECKS_PAGE_SIZE: DecksPageSize = 12;

interface UseDeckListFilteringArgs {
	allDecks: ReadonlyArray<ApiDeck>;
	prefs: DeckViewPrefs;
	archiveSet: ArchiveSet;
	studyOrder: StudyOrder;
	dueByDeckId: DeckStatsSnapshot["dueByDeckId"];
	matureByDeckId: DeckStatsSnapshot["matureByDeckId"];
	displayNameOf: (deck: ApiDeck) => string;
}

export interface DeckListFiltering {
	searchInputValue: string;
	setSearchInputValue: Dispatch<SetStateAction<string>>;
	searchQuery: string;
	page: number;
	setPage: Dispatch<SetStateAction<number>>;
	pageSize: DecksPageSize;
	setPageSize: Dispatch<SetStateAction<DecksPageSize>>;
	slotByDeckId: ReadonlyMap<string, number>;
	visibleDecks: ApiDeck[];
	totalCount: number;
	totalPages: number;
	safePage: number;
	canReorder: boolean;
}

/**
 * Owns the Decks list's search / filter / sort / pagination pipeline: the
 * debounced search term, the active page + page size, and the derived
 * `visibleDecks` slice (plus `sortedDecks` for the drag-reorder hook and
 * `slotByDeckId` for study-order slot badges).
 *
 * Extracted verbatim from `deck-list.tsx` — same memo dependency arrays and
 * eslint directives, so behavior is unchanged.
 */
export function useDeckListFiltering(args: UseDeckListFilteringArgs): DeckListFiltering {
	const { allDecks, prefs, archiveSet, studyOrder, dueByDeckId, matureByDeckId, displayNameOf } = args;

	const [searchInputValue, setSearchInputValue] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<DecksPageSize>(DEFAULT_DECKS_PAGE_SIZE);

	useEffect(() => {
		const id = window.setTimeout(() => setSearchQuery(searchInputValue.trim()), 180);
		return () => window.clearTimeout(id);
	}, [searchInputValue]);

	useEffect(() => { setPage(1); }, [prefs.sort, prefs.typeFilter, prefs.view, searchQuery, pageSize]); // eslint-disable-line react/set-state-in-effect -- returns to page 1 when filters/sort/page-size narrow the result set

	function isFullyMature(deckId: string): boolean {
		const m = matureByDeckId.get(deckId);
		if (m === undefined)
			return false;
		return m.total > 0 && m.mature >= m.total;
	}

	const slotByDeckId = useMemo(() => {
		const map = new Map<string, number>();
		let slot = 1;
		for (const deckId of studyOrder.resolvedOrder) {
			if (archiveSet.isArchived(deckId))
				continue;
			map.set(deckId, slot++);
		}
		return map;
	}, [studyOrder.resolvedOrder, archiveSet]);

	const filteredDecks: ApiDeck[] = useMemo(() => {
		const q = searchQuery.toLowerCase();
		return allDecks.filter((deck) => {
			const archived = archiveSet.isArchived(deck.id);
			// Tab filter: Active = non-archived; Mature = non-archived AND fully mature;
			// Archived = archived only. Mature is a sub-filter on Active.
			switch (prefs.view) {
				case "active":
					if (archived)
						return false;
					break;
				case "mature":
					if (archived)
						return false;
					if (!isFullyMature(deck.id))
						return false;
					break;
				case "archived":
					if (!archived)
						return false;
					break;
			}
			if (prefs.typeFilter !== "all" && deck.deckType !== prefs.typeFilter)
				return false;
			if (q.length > 0) {
				const haystack = `${displayNameOf(deck)} ${deck.description ?? ""}`.toLowerCase();
				if (!haystack.includes(q))
					return false;
			}
			return true;
		});
	// eslint-disable-next-line react-hooks/exhaustive-deps -- isFullyMature is a pure reader of matureByDeckId, which is already listed; depending on the function identity would recompute every render.
	}, [allDecks, prefs.typeFilter, prefs.view, searchQuery, archiveSet, displayNameOf, matureByDeckId]);

	const sortedDecks: ApiDeck[] = useMemo(() => {
		const list = [...filteredDecks];
		list.sort((a, b) => compareDecks(a, b, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf));
		return list;
	}, [filteredDecks, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf]);

	const totalCount = sortedDecks.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	const safePage = Math.min(page, totalPages);
	const pageStart = (safePage - 1) * pageSize;
	const pageEnd = Math.min(pageStart + pageSize, totalCount);
	const visibleDecks = useMemo(() => sortedDecks.slice(pageStart, pageEnd), [sortedDecks, pageStart, pageEnd]);

	// Drag-to-reorder is enabled in study-order sort on the active-decks view.
	// Reordering only makes sense while looking at the live study queue — not
	// when viewing the mature or archived subsets.
	const canReorder = prefs.sort === "study-order" && prefs.view === "active";

	return {
		searchInputValue,
		setSearchInputValue,
		searchQuery,
		page,
		setPage,
		pageSize,
		setPageSize,
		slotByDeckId,
		visibleDecks,
		totalCount,
		totalPages,
		safePage,
		canReorder,
	};
}
