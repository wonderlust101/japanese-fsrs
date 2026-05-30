"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";

/**
 * Curate-mode + bulk-selection state for the Decks list. Owns the multi-select
 * set the curate bar's bulk actions operate on, and clears it automatically
 * when the user leaves curate mode so a stale selection can't carry into the
 * next curate session.
 *
 * Extracted from `deck-list.tsx` (the orchestrator passes `selectedIds` and
 * `setCurateMode` into `useDeckListActions` for the bulk handlers).
 */
export function useDeckListSelection(): {
	curateMode: boolean;
	setCurateMode: Dispatch<SetStateAction<boolean>>;
	selectedIds: ReadonlySet<string>;
	toggleSelected: (deckId: string) => void;
} {
	const [curateMode, setCurateMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());

	useEffect(() => {
		if (!curateMode)
			setSelectedIds(new Set()); // eslint-disable-line react/set-state-in-effect -- clears the bulk selection when leaving curate mode
	}, [curateMode]);

	function toggleSelected(deckId: string): void {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(deckId))
				next.delete(deckId);
			else next.add(deckId);
			return next;
		});
	}

	return { curateMode, setCurateMode, selectedIds, toggleSelected };
}
