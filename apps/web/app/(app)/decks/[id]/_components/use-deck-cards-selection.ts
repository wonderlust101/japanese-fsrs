"use client";

import type { ApiCardListItem } from "@fsrs-japanese/shared-types";

import type { CardPageSize } from "./card-list-pagination";
import type { DeckCardsUrlState } from "./deck-cards-url-state";

import { useEffect, useMemo, useState } from "react";

/**
 * Id-keyed bulk-selection state for the deck-detail card list. Drops the
 * selection whenever the *result set* changes (filter / search / sort / page
 * size) but keeps it across page navigation, since selection is id-keyed not
 * row-position based. Mirrors `useCardsSelection` in the cards browser.
 */
export function useDeckCardsSelection(
	visibleCards: ReadonlyArray<ApiCardListItem>,
	resultSet: {
		status: DeckCardsUrlState["status"];
		trimmedSearch: string;
		sort: DeckCardsUrlState["sort"];
		sortDir: DeckCardsUrlState["sortDir"];
		pageSize: CardPageSize;
	},
): {
	selected: ReadonlySet<string>;
	toggleSelection: (id: string) => void;
	toggleAllVisible: () => void;
	clearSelection: () => void;
} {
	const { status, trimmedSearch, sort, sortDir, pageSize } = resultSet;
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

	useEffect(() => {
		setSelected(new Set()); // eslint-disable-line react/set-state-in-effect -- drops the id-keyed selection when the result set changes (filter/search/sort/page size)
	}, [status, trimmedSearch, sort, sortDir, pageSize]);

	const visibleIds = useMemo(() => visibleCards.map(c => c.id), [visibleCards]);

	function toggleSelection(id: string): void {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id))
				next.delete(id);
			else next.add(id);
			return next;
		});
	}

	function toggleAllVisible(): void {
		setSelected((prev) => {
			const allChecked = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
			const next = new Set(prev);
			for (const id of visibleIds) {
				if (allChecked)
					next.delete(id);
				else next.add(id);
			}
			return next;
		});
	}

	function clearSelection(): void {
		setSelected(new Set());
	}

	return { selected, toggleSelection, toggleAllVisible, clearSelection };
}
