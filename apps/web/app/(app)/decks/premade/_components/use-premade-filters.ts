"use client";

import type { ApiPremadeDeck, JLPTLevel } from "@fsrs-japanese/shared-types";
import type { Dispatch, SetStateAction } from "react";
import type { DecksPageSize } from "@/app/(app)/decks/_components/decks-pagination";

import { useEffect, useMemo, useState } from "react";

// ── Filter + sort dimensions ───────────────────────────────────────────────
// Exported so the catalogue's toolbar dropdowns and this hook share one source
// of truth (the hook owns the live state; the dropdowns render the options).

export type JlptFilter = "all" | JLPTLevel;

export const JLPT_ORDER: ReadonlyArray<JlptFilter> = ["all", "N5", "N4", "N3", "N2", "N1", "beyond_jlpt"];

export const JLPT_LABEL: Record<JlptFilter, string> = {
	all: "Any level",
	N5: "N5",
	N4: "N4",
	N3: "N3",
	N2: "N2",
	N1: "N1",
	beyond_jlpt: "Beyond",
};

export type SortKey = "jlpt" | "name" | "cards-desc" | "cards-asc";

export const SORT_ORDER: ReadonlyArray<SortKey> = ["jlpt", "name", "cards-desc", "cards-asc"];

export const SORT_LABEL: Record<SortKey, string> = {
	"jlpt": "JLPT level",
	"name": "Name",
	"cards-desc": "Most cards",
	"cards-asc": "Fewest cards",
};

// Curriculum order for the default sort. Level-agnostic decks (jlptLevel null,
// e.g. a future Joyo Kanji deck) sink below N1; Beyond JLPT sits last.
const JLPT_SORT_RANK: Record<JLPTLevel, number> = {
	N5: 1,
	N4: 2,
	N3: 3,
	N2: 4,
	N1: 5,
	beyond_jlpt: 7,
};

function jlptRank(level: JLPTLevel | null): number {
	return level === null ? 6 : JLPT_SORT_RANK[level];
}

function sortDecks(decks: ReadonlyArray<ApiPremadeDeck>, sort: SortKey): ApiPremadeDeck[] {
	const out = [...decks];
	switch (sort) {
		case "name":
			return out.sort((a, b) => a.name.localeCompare(b.name));
		case "cards-desc":
			return out.sort((a, b) => b.cardCount - a.cardCount || a.name.localeCompare(b.name));
		case "cards-asc":
			return out.sort((a, b) => a.cardCount - b.cardCount || a.name.localeCompare(b.name));
		case "jlpt":
			return out.sort((a, b) => jlptRank(a.jlptLevel) - jlptRank(b.jlptLevel) || a.name.localeCompare(b.name));
	}
}

const DEFAULT_PAGE_SIZE: DecksPageSize = 12;

/**
 * Client-side JLPT filter + sort + pagination over the premade catalogue (small
 * enough that server-side paging wouldn't earn its complexity). Owns the four
 * view dimensions and resets to page 1 on any result-set-narrowing change.
 * Extracted from `premade-catalogue.tsx`.
 */
export function usePremadeFilters(allDecks: ReadonlyArray<ApiPremadeDeck>): {
	jlpt: JlptFilter;
	setJlpt: Dispatch<SetStateAction<JlptFilter>>;
	sort: SortKey;
	setSort: Dispatch<SetStateAction<SortKey>>;
	page: number;
	setPage: Dispatch<SetStateAction<number>>;
	pageSize: DecksPageSize;
	setPageSize: Dispatch<SetStateAction<DecksPageSize>>;
	totalCount: number;
	totalPages: number;
	safePage: number;
	pageItems: ApiPremadeDeck[];
	jlptTriggerLabel: string;
} {
	const [jlpt, setJlpt] = useState<JlptFilter>("all");
	const [sort, setSort] = useState<SortKey>("jlpt");
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState<DecksPageSize>(DEFAULT_PAGE_SIZE);

	const filteredDecks = useMemo(
		() => (jlpt === "all" ? allDecks : allDecks.filter(deck => deck.jlptLevel === jlpt)),
		[allDecks, jlpt],
	);

	const sortedDecks = useMemo(() => sortDecks(filteredDecks, sort), [filteredDecks, sort]);

	const totalCount = sortedDecks.length;
	const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
	// Clamp so a filter/sort change that shrinks the list can't strand the view
	// on an out-of-range page before the reset effect runs.
	const safePage = Math.min(page, totalPages);
	const pageItems = useMemo(
		() => sortedDecks.slice((safePage - 1) * pageSize, safePage * pageSize),
		[sortedDecks, safePage, pageSize],
	);

	// Any narrowing of the result set (filter, sort, or page-size change)
	// returns to page 1.
	useEffect(() => { setPage(1); }, [jlpt, sort, pageSize]); // eslint-disable-line react/set-state-in-effect -- returns to page 1 when filters/sort/page-size narrow the result set

	// Trigger reads 'JLPT N5' / 'Beyond JLPT' / 'Any level' so the chip is
	// self-identifying beside the Sort chip.
	const jlptTriggerLabel
		= jlpt === "all" ? "Any level" : jlpt === "beyond_jlpt" ? "Beyond JLPT" : `JLPT ${jlpt}`;

	return {
		jlpt,
		setJlpt,
		sort,
		setSort,
		page,
		setPage,
		pageSize,
		setPageSize,
		totalCount,
		totalPages,
		safePage,
		pageItems,
		jlptTriggerLabel,
	};
}
