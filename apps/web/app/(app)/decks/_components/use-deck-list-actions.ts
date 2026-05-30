"use client";

import type { ApiDeck } from "@fsrs-japanese/shared-types";
import type { Dispatch, SetStateAction } from "react";

import type { useArchiveSet, useStudyOrder } from "./use-deck-prefs";
import { useQueryClient } from "@tanstack/react-query";

import { useCallback, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { deleteDeckAction } from "@/lib/actions/decks.actions";
import { useCopyDeck } from "@/lib/api/decks";

import { queryKeys } from "@/lib/api/queryKeys";
import { truncate } from "./deck-sort";

type ArchiveSet = ReturnType<typeof useArchiveSet>;
type StudyOrder = ReturnType<typeof useStudyOrder>;
type ToastApi = ReturnType<typeof useToast>;

/**
 * Which dialog (if any) the Decks page is showing. The list view owns the
 * `activeDialog` state (its render branches on it); this type lives here
 * because `useDeckListActions` is the main writer of it (bulk-delete closes
 * the curate bar and opens the confirm dialog).
 */
export type ActiveDialog
	= | { kind: "none" }
		| { kind: "rename"; deck: ApiDeck }
		| { kind: "delete"; deck: ApiDeck }
		| { kind: "edit"; deck: ApiDeck }
		| { kind: "create" }
		| { kind: "bulk-delete" };

interface UseDeckListActionsArgs {
	archiveSet: ArchiveSet;
	studyOrder: StudyOrder;
	displayNameOf: (deck: ApiDeck) => string;
	selectedIds: ReadonlySet<string>;
	setCurateMode: Dispatch<SetStateAction<boolean>>;
	setActiveDialog: Dispatch<SetStateAction<ActiveDialog>>;
}

export interface DeckListActions {
	/** Polite live-region text for screen-reader reorder announcements. */
	liveMessage: string;
	/** Announce a deck's new position; passed to the drag-reorder hook too. */
	announceMove: (deckId: string, deckName: string, postOrder: ReadonlyArray<string>) => void;
	handleSetAsPriority: (deckId: string, deckName: string) => void;
	handleArchive: (deckId: string, deckName: string) => void;
	handleRestore: (deckId: string, deckName: string) => void;
	handleCopy: (deckId: string, deckName: string) => void;
	handleBulkArchive: () => void;
	handleBulkCopy: () => void;
	handleBulkDelete: () => void;
	handleBulkMoveToTop: () => void;
	handleMoveUp: (deck: ApiDeck) => void;
	handleMoveDown: (deck: ApiDeck) => void;
	toast: ToastApi["toast"];
	showToast: ToastApi["showToast"];
	dismissToast: ToastApi["dismissToast"];
}

/**
 * All the imperative actions on the Decks list: single-deck (pin priority,
 * archive, restore, copy) and bulk (archive, copy, delete, move-to-top) plus
 * the kebab reorder moves, each wired to its toast + screen-reader
 * announcement. Owns the toast queue and the copy mutation; reads selection +
 * dialog setters from the orchestrator.
 *
 * Extracted from `deck-list.tsx` verbatim — same optimistic toasts, same Undo
 * affordances, same parallel fan-out on bulk operations.
 */
export function useDeckListActions(args: UseDeckListActionsArgs): DeckListActions {
	const { archiveSet, studyOrder, displayNameOf, selectedIds, setCurateMode, setActiveDialog } = args;

	const queryClient = useQueryClient();
	const copyMutation = useCopyDeck();
	const { toast, showToast, dismissToast } = useToast();
	const [liveMessage, setLiveMessage] = useState("");

	const priorityDeckId = studyOrder.priorityDeckId;

	// Polite announcer for ordering changes (pointer-drag, kebab move-up/down,
	// bulk move-to-top). Appending a zero-width space when the message repeats
	// forces SRs to re-announce identical text on consecutive moves.
	const announceOrder = useCallback((message: string) => {
		setLiveMessage(prev => (prev === message ? `${message}​` : message));
	}, []);

	// Announce the new position of `deckId` against the resolved study order
	// *after* it's been mutated. Caller passes the post-mutation order so the
	// index reflects the user-visible state.
	const announceMove = useCallback(
		(deckId: string, deckName: string, postOrder: ReadonlyArray<string>) => {
			const idx = postOrder.indexOf(deckId);
			if (idx === -1)
				return;
			announceOrder(`Moved ${deckName} to position ${idx + 1} of ${postOrder.length}.`);
		},
		[announceOrder],
	);

	function handleSetAsPriority(deckId: string, deckName: string): void {
		if (archiveSet.isArchived(deckId)) {
			archiveSet.restore(deckId);
		}
		studyOrder.setAsPriority(deckId);
		showToast(`Pinned "${truncate(deckName, 28)}" as priority.`);
	}

	function handleArchive(deckId: string, deckName: string): void {
		// Capture priority status BEFORE mutating; archive demotes the priority
		// deck silently, so the toast carries the warning instead of a modal.
		const wasPriority = deckId === priorityDeckId;
		archiveSet.archive(deckId);
		const suffix = wasPriority ? " (your priority deck)" : "";
		showToast(
			`Archived "${truncate(deckName, 28)}"${suffix}.`,
			"info",
			{ label: "Undo", onClick: () => archiveSet.restore(deckId) },
		);
	}

	function handleRestore(deckId: string, deckName: string): void {
		archiveSet.restore(deckId);
		showToast(
			`Restored "${truncate(deckName, 28)}".`,
			"info",
			{ label: "Undo", onClick: () => archiveSet.archive(deckId) },
		);
	}

	function handleCopy(deckId: string, deckName: string): void {
		copyMutation.mutate(deckId, {
			onSuccess: () => {
				showToast(`Copied "${truncate(deckName, 28)}".`);
			},
			onError: () => {
				showToast(`Couldn't copy "${truncate(deckName, 28)}". Please try again.`, "error");
			},
		});
	}

	function handleBulkArchive(): void {
		const ids = [...selectedIds];
		// Capture priority inclusion BEFORE mutating; mirrors the single-row
		// archive flow so power users get the same safety net (warning copy
		// + Undo) when curate-mode bulk-archive happens to include slot 01.
		const includesPriority = priorityDeckId !== null && ids.includes(priorityDeckId);
		archiveSet.archiveMany(ids);
		const suffix = includesPriority ? " (including your priority deck)" : "";
		showToast(
			`Archived ${ids.length} deck${ids.length === 1 ? "" : "s"}${suffix}.`,
			"info",
			{ label: "Undo", onClick: () => { for (const id of ids) archiveSet.restore(id); } },
		);
		setCurateMode(false);
	}

	function handleBulkCopy(): void {
		const ids = [...selectedIds];
		setCurateMode(false);
		void Promise.allSettled(
			ids.map(id => copyMutation.mutateAsync(id)),
		).then((results) => {
			const failures = results.filter(r => r.status === "rejected").length;
			if (failures === 0) {
				showToast(`Copied ${ids.length} deck${ids.length === 1 ? "" : "s"}.`);
			} else if (failures === ids.length) {
				showToast(`Couldn't copy ${ids.length} deck${ids.length === 1 ? "" : "s"}.`, "error");
			} else {
				showToast(`Copied ${ids.length - failures}. ${failures} failed.`, "error");
			}
		});
	}

	function handleBulkDelete(): void {
		const ids = [...selectedIds];
		setCurateMode(false);
		setActiveDialog({ kind: "none" });
		void Promise.allSettled(
			ids.map(id => deleteDeckAction(id)),
		).then((results) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() });
			const failures = results.filter(r => r.status === "rejected").length;
			if (failures === 0) {
				showToast(`Deleted ${ids.length} deck${ids.length === 1 ? "" : "s"}.`);
			} else if (failures === ids.length) {
				showToast(`Couldn't delete ${ids.length} deck${ids.length === 1 ? "" : "s"}.`, "error");
			} else {
				showToast(`Deleted ${ids.length - failures}. ${failures} failed.`, "error");
			}
		});
	}

	function handleBulkMoveToTop(): void {
		const ids = [...selectedIds];
		studyOrder.moveToTop(ids);
		showToast(`Moved ${ids.length} deck${ids.length === 1 ? "" : "s"} to the top of the study order.`);
		announceOrder(`Moved ${ids.length} deck${ids.length === 1 ? "" : "s"} to the top of the study order.`);
		setCurateMode(false);
	}

	function handleMoveUp(deck: ApiDeck): void {
		studyOrder.moveUp(deck.id);
		const order = [...studyOrder.resolvedOrder];
		const idx = order.indexOf(deck.id);
		if (idx > 0) {
			const above = order[idx - 1];
			if (above !== undefined) {
				order[idx - 1] = deck.id;
				order[idx] = above;
			}
		}
		announceMove(deck.id, displayNameOf(deck), order);
	}

	function handleMoveDown(deck: ApiDeck): void {
		studyOrder.moveDown(deck.id);
		const order = [...studyOrder.resolvedOrder];
		const idx = order.indexOf(deck.id);
		if (idx >= 0 && idx < order.length - 1) {
			const below = order[idx + 1];
			if (below !== undefined) {
				order[idx + 1] = deck.id;
				order[idx] = below;
			}
		}
		announceMove(deck.id, displayNameOf(deck), order);
	}

	return {
		liveMessage,
		announceMove,
		handleSetAsPriority,
		handleArchive,
		handleRestore,
		handleCopy,
		handleBulkArchive,
		handleBulkCopy,
		handleBulkDelete,
		handleBulkMoveToTop,
		handleMoveUp,
		handleMoveDown,
		toast,
		showToast,
		dismissToast,
	};
}
