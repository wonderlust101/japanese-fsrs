"use client";

import type { CardsPageSize } from "./cards-pagination";
import type { CardsResultRow } from "./cards-results-table";
import type { useCardsUrlFilterState } from "./use-cards-url-filter-state";

import { useEffect, useMemo, useState } from "react";

type CardsFilterState = ReturnType<typeof useCardsUrlFilterState>["state"];

/**
 * Id-keyed bulk-selection state for the cards browser. Tracks the selected card
 * ids (stable across page navigation, since selection is keyed by id not row
 * position) and drops the selection whenever the *result set* changes — any
 * filter, sort, or page-size change, but NOT a page flip.
 *
 * Extracted from `cards-browser-view.tsx` with the same effect dependency list.
 */
export function useCardsSelection(
	rows: ReadonlyArray<CardsResultRow>,
	state: CardsFilterState,
	pageSize: CardsPageSize,
): {
	selected: ReadonlySet<string>;
	visibleIds: string[];
	toggleSelection: (id: string) => void;
	toggleAllVisible: () => void;
	clearSelection: () => void;
} {
	const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

	// Clear selection whenever any filter or page-size change happens. Page
	// itself is intentionally NOT in the dep list — flipping pages shouldn't
	// drop the current selection (it's tracked by id, not row position).
	useEffect(() => {
		setSelected(new Set()); // eslint-disable-line react/set-state-in-effect -- drops the id-keyed selection when the result set changes (filters), not on page nav
	}, [
		state.search,
		state.deckId,
		state.jlpt,
		state.status,
		state.missingField,
		state.presentField,
		state.pitchPattern,
		state.viewId,
		state.sort,
		state.sortDir,
		pageSize,
	]);

	const visibleIds = useMemo(() => rows.map(r => r.id), [rows]);

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
			if (allChecked) {
				const next = new Set(prev);
				for (const id of visibleIds) next.delete(id);
				return next;
			}
			const next = new Set(prev);
			for (const id of visibleIds) next.add(id);
			return next;
		});
	}

	function clearSelection(): void {
		setSelected(new Set());
	}

	return { selected, visibleIds, toggleSelection, toggleAllVisible, clearSelection };
}
