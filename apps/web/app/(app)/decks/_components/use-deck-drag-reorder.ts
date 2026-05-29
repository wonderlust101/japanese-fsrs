import type { ApiDeck } from "@fsrs-japanese/shared-types";
import { useCallback, useEffect, useState } from "react";

interface DragState {
	draggedId: string;
	draggedIndex: number;
	overIndex: number | null;
	pointerY: number;
}

/** The slice of `useStudyOrder` this hook reads + writes. */
interface StudyOrderSlice {
	resolvedOrder: ReadonlyArray<string>;
	setOrder: (order: ReadonlyArray<string>) => void;
}

export interface DeckDragReorder {
	/** Active drag, or null. Render reads `draggedId`/`overIndex` for drag/drop styling. */
	dragState: DragState | null;
	/** Pointer-down handler factory for a deck row's drag handle. */
	handleDragHandleDown: (
		deckId: string,
		viewIndex: number,
	) => (event: React.PointerEvent<HTMLButtonElement>) => void;
}

/**
 * Drag-to-reorder pointer state machine for the deck list.
 *
 * Owns the full pointer lifecycle: a `pointerdown` on a row handle seeds
 * `dragState`, then window-level `pointermove`/`pointerup` listeners run the
 * reorder until release. The per-move work is a numeric midpoint scan (row
 * centerlines snapshotted once at drag start, recomputed on scroll/resize) so
 * the hot path never re-queries the DOM, and `pointermove` is coalesced into a
 * single rAF tick. Commit reorders `studyOrder` and announces the new position.
 */
export function useDeckDragReorder(args: {
	canReorder: boolean;
	visibleDecks: ReadonlyArray<ApiDeck>;
	studyOrder: StudyOrderSlice;
	announceMove: (deckId: string, deckName: string, postOrder: ReadonlyArray<string>) => void;
	displayNameOf: (deck: ApiDeck) => string;
}): DeckDragReorder {
	const { canReorder, visibleDecks, studyOrder, announceMove, displayNameOf } = args;
	const [dragState, setDragState] = useState<DragState | null>(null);

	const handleDragHandleDown = useCallback(
		(deckId: string, viewIndex: number) =>
			(event: React.PointerEvent<HTMLButtonElement>) => {
				if (!canReorder)
					return;
				event.preventDefault();
				setDragState({
					draggedId: deckId,
					draggedIndex: viewIndex,
					overIndex: viewIndex,
					pointerY: event.clientY,
				});
			},
		[canReorder],
	);

	useEffect(() => {
		if (dragState === null)
			return;

		// Snapshot row centerlines once at drag start. Recompute on scroll
		// and resize while the drag is active. Doing this work per pointermove
		// (querySelectorAll + N × getBoundingClientRect) was the page's hottest
		// path on long lists; the per-move work is now a numeric scan.
		let midpoints: number[] = [];
		function snapshot(): void {
			const els = document.querySelectorAll<HTMLElement>("[data-deck-id]");
			midpoints = Array.from({ length: els.length });
			for (let i = 0; i < els.length; i++) {
				const el = els[i];
				if (el === undefined)
					continue;
				const rect = el.getBoundingClientRect();
				midpoints[i] = rect.top + rect.height / 2;
			}
		}
		snapshot();

		// Coalesce pointermove into a single rAF tick so we never do more work
		// than the display can paint. Latest clientY wins.
		let pending = false;
		let latestY = dragState.pointerY;
		function onMove(event: PointerEvent): void {
			latestY = event.clientY;
			if (pending)
				return;
			pending = true;
			requestAnimationFrame(() => {
				pending = false;
				let bestIndex = 0;
				let bestDistance = Infinity;
				for (let i = 0; i < midpoints.length; i++) {
					const mid = midpoints[i];
					if (mid === undefined)
						continue;
					const distance = Math.abs(latestY - mid);
					if (distance < bestDistance) {
						bestDistance = distance;
						bestIndex = i;
					}
				}
				setDragState(prev => (prev === null ? null : { ...prev, overIndex: bestIndex, pointerY: latestY }));
			});
		}

		function onUp(): void {
			setDragState((prev) => {
				if (prev === null)
					return null;
				if (prev.overIndex === null || prev.overIndex === prev.draggedIndex)
					return null;
				const fromVisible = visibleDecks[prev.draggedIndex];
				const toVisible = visibleDecks[prev.overIndex];
				if (fromVisible === undefined || toVisible === undefined)
					return null;

				const order = [...studyOrder.resolvedOrder];
				const fromIdx = order.indexOf(fromVisible.id);
				const toIdx = order.indexOf(toVisible.id);
				if (fromIdx === -1 || toIdx === -1)
					return null;

				const moved = order.splice(fromIdx, 1)[0];
				if (moved !== undefined) {
					order.splice(toIdx, 0, moved);
					studyOrder.setOrder(order);
					announceMove(fromVisible.id, displayNameOf(fromVisible), order);
				}
				return null;
			});
		}

		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		window.addEventListener("scroll", snapshot, { passive: true });
		window.addEventListener("resize", snapshot);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			window.removeEventListener("scroll", snapshot);
			window.removeEventListener("resize", snapshot);
		};
	}, [dragState, visibleDecks, studyOrder, announceMove, displayNameOf]);

	return { dragState, handleDragHandleDown };
}
