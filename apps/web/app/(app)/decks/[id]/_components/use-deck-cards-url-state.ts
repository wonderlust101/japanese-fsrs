"use client";

import type { Dispatch, SetStateAction } from "react";

import type { CardPageSize } from "./card-list-pagination";
import type { DeckCardsUrlState } from "./deck-cards-url-state";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { parseDeckCardsUrl, serializeDeckCardsUrl } from "./deck-cards-url-state";

const DEFAULT_PAGE_SIZE: CardPageSize = 25;

/**
 * URL-canonical filter state for the deck-detail card list. status / search /
 * sort / page live in the query string so the filtered view is deep-linkable
 * and survives reload (the URL is the single source of truth, derived via
 * `useMemo`, not a duplicated `useState` that would race `router.replace`).
 * `pageSize` is a local viewing preference, not part of the view definition.
 *
 * `updateUrlState` is the single writer: it merges a partial patch and resets
 * to page 1 whenever a field that changes the result set or its order changes,
 * so the user never lands on a stale page. Extracted from `deck-detail-view`.
 */
export function useDeckCardsUrlState(): {
	status: DeckCardsUrlState["status"];
	searchValue: string;
	sort: DeckCardsUrlState["sort"];
	sortDir: DeckCardsUrlState["sortDir"];
	pageIndex: number;
	pageSize: CardPageSize;
	setPageSize: Dispatch<SetStateAction<CardPageSize>>;
	updateUrlState: (patch: Partial<DeckCardsUrlState>) => void;
	handlePageSizeChange: (next: CardPageSize) => void;
} {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const urlState = useMemo(() => parseDeckCardsUrl(k => searchParams.get(k)), [searchParams]);
	const status = urlState.status;
	const searchValue = urlState.search;
	const sort = urlState.sort;
	const sortDir = urlState.sortDir;
	const pageIndex = urlState.page - 1; // 0-indexed for internal use

	const [pageSize, setPageSize] = useState<CardPageSize>(DEFAULT_PAGE_SIZE);

	function updateUrlState(patch: Partial<DeckCardsUrlState>): void {
		const current: DeckCardsUrlState = { status, search: searchValue, sort, sortDir, page: pageIndex + 1 };
		const next = { ...current, ...patch };
		const onlyPageChanged
			= next.status === current.status && next.search === current.search
				&& next.sort === current.sort && next.sortDir === current.sortDir;
		const finalNext = onlyPageChanged ? next : { ...next, page: 1 };
		const qs = serializeDeckCardsUrl(finalNext).toString();
		router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false });
	}

	function handlePageSizeChange(next: CardPageSize): void {
		setPageSize(next);
		// Changing page size changes how the result set paginates, so jump back
		// to page 1 (pageSize itself is local, not a URL param).
		updateUrlState({ page: 1 });
	}

	return {
		status,
		searchValue,
		sort,
		sortDir,
		pageIndex,
		pageSize,
		setPageSize,
		updateUrlState,
		handlePageSizeChange,
	};
}
