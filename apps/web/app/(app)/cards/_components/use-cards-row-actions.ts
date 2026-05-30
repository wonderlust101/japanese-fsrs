"use client";

import type { ApiCardListItem, ApiCrossDeckCardListItem } from "@fsrs-japanese/shared-types";
import type { Dispatch, SetStateAction } from "react";

import type { CardRowAction } from "./cards-results-table";
import type { useToast } from "@/components/ui/Toast";

import { getWordFields } from "@fsrs-japanese/shared-types";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
	useBulkDeleteCardsMutation,
	useBulkMoveCardsMutation,
	useBulkSuspendCardsMutation,
	useCopyCardMutation,
	useDeleteCardMutation,
	useMoveCardMutation,
} from "@/lib/api/cards";

type ShowToast = ReturnType<typeof useToast>["showToast"];

interface UseCardsRowActionsArgs {
	/** Live cross-deck items, used to resolve a row id back to its full card. */
	items: ReadonlyArray<ApiCrossDeckCardListItem> | undefined;
	selected: ReadonlySet<string>;
	clearSelection: () => void;
	showToast: ShowToast;
}

/**
 * Every mutating action on the cards browser — single-row (edit/copy/move/
 * delete) and bulk (move/suspend/delete) — plus the dialog-target state each
 * action drives and its success/error toast. Owns the six card mutations, the
 * router (for edit navigation), and the five dialog open/target states.
 *
 * Extracted from `cards-browser-view.tsx` verbatim; the render reads the
 * mutation `isPending`/`error` flags and the dialog state off the return.
 */
export function useCardsRowActions(args: UseCardsRowActionsArgs): {
	deleteMutation: ReturnType<typeof useDeleteCardMutation>;
	moveMutation: ReturnType<typeof useMoveCardMutation>;
	copyMutation: ReturnType<typeof useCopyCardMutation>;
	bulkMoveMutation: ReturnType<typeof useBulkMoveCardsMutation>;
	bulkSuspendMutation: ReturnType<typeof useBulkSuspendCardsMutation>;
	bulkDeleteMutation: ReturnType<typeof useBulkDeleteCardsMutation>;
	confirmDelete: ApiCrossDeckCardListItem | null;
	setConfirmDelete: Dispatch<SetStateAction<ApiCrossDeckCardListItem | null>>;
	moveTarget: ApiCrossDeckCardListItem | null;
	setMoveTarget: Dispatch<SetStateAction<ApiCrossDeckCardListItem | null>>;
	copyTarget: ApiCrossDeckCardListItem | null;
	setCopyTarget: Dispatch<SetStateAction<ApiCrossDeckCardListItem | null>>;
	bulkMoveOpen: boolean;
	setBulkMoveOpen: Dispatch<SetStateAction<boolean>>;
	bulkDeleteOpen: boolean;
	setBulkDeleteOpen: Dispatch<SetStateAction<boolean>>;
	handleRowAction: (cardId: string, action: CardRowAction) => void;
	confirmRowDelete: () => void;
	handleMoveConfirm: (card: ApiCardListItem, targetDeckId: string) => void;
	handleCopyConfirm: (card: ApiCardListItem, targetDeckId: string) => void;
	handleBulkMoveConfirm: (card: ApiCardListItem, targetDeckId: string) => void;
	handleBulkSuspend: () => void;
	handleBulkDeleteConfirm: () => void;
} {
	const { items, selected, clearSelection, showToast } = args;
	const router = useRouter();

	const deleteMutation = useDeleteCardMutation();
	const moveMutation = useMoveCardMutation();
	const copyMutation = useCopyCardMutation();
	const bulkMoveMutation = useBulkMoveCardsMutation();
	const bulkSuspendMutation = useBulkSuspendCardsMutation();
	const bulkDeleteMutation = useBulkDeleteCardsMutation();

	const [confirmDelete, setConfirmDelete] = useState<ApiCrossDeckCardListItem | null>(null);
	const [moveTarget, setMoveTarget] = useState<ApiCrossDeckCardListItem | null>(null);
	const [copyTarget, setCopyTarget] = useState<ApiCrossDeckCardListItem | null>(null);
	const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	function wireItemById(cardId: string): ApiCrossDeckCardListItem | undefined {
		if (items === undefined)
			return undefined;
		return items.find(i => i.id === cardId);
	}

	function handleRowAction(cardId: string, action: CardRowAction): void {
		const item = wireItemById(cardId);
		if (action === "edit") {
			router.push(`/cards/${cardId}`);
			return;
		}
		if (item === undefined) {
			showToast("Dev-fixture row: real actions require live data.", "info");
			return;
		}
		switch (action) {
			case "add-copy": setCopyTarget(item); return;
			case "move": setMoveTarget(item); return;
			case "delete": setConfirmDelete(item);
		}
	}

	function confirmRowDelete(): void {
		if (confirmDelete === null)
			return;
		const card = confirmDelete;
		const wf = getWordFields(card);
		const label = wf?.word ?? "card";
		deleteMutation.mutate(card.id, {
			onSuccess: () => {
				showToast(`Deleted ${label}.`, "info");
				setConfirmDelete(null);
			},
			onError: () => showToast("Couldn't delete that card. Please try again.", "error"),
		});
	}

	function handleMoveConfirm(card: ApiCardListItem, targetDeckId: string): void {
		moveMutation.mutate({ cardId: card.id, targetDeckId }, {
			onSuccess: () => {
				showToast("Card moved.", "info");
				setMoveTarget(null);
			},
			onError: () => showToast("Couldn't move that card. Please try again.", "error"),
		});
	}

	function handleCopyConfirm(card: ApiCardListItem, targetDeckId: string): void {
		copyMutation.mutate({ cardId: card.id, targetDeckId }, {
			onSuccess: () => {
				showToast("Copy added to the deck.", "info");
				setCopyTarget(null);
			},
			onError: () => showToast("Couldn't copy that card. Please try again.", "error"),
		});
	}

	function reportBulkResult(label: string, result: { succeeded: string[]; failed: { id: string; error: string }[] }): void {
		const succeeded = result.succeeded.length;
		const failed = result.failed.length;
		if (failed === 0) {
			showToast(`${label}: ${succeeded} ${succeeded === 1 ? "card" : "cards"} updated.`, "info");
		} else {
			showToast(`${label}: ${succeeded} updated, ${failed} failed.`, "error");
		}
	}

	function handleBulkMoveConfirm(_card: ApiCardListItem, targetDeckId: string): void {
		const ids = [...selected];
		bulkMoveMutation.mutate({ ids, targetDeckId }, {
			onSuccess: (result) => {
				reportBulkResult("Move", result);
				clearSelection();
				setBulkMoveOpen(false);
			},
			onError: () => showToast("Couldn't move those cards. Please try again.", "error"),
		});
	}

	function handleBulkSuspend(): void {
		const ids = [...selected];
		bulkSuspendMutation.mutate(ids, {
			onSuccess: (result) => { reportBulkResult("Suspend", result); clearSelection(); },
			onError: () => showToast("Couldn't suspend those cards. Please try again.", "error"),
		});
	}

	function handleBulkDeleteConfirm(): void {
		const ids = [...selected];
		bulkDeleteMutation.mutate(ids, {
			onSuccess: (result) => {
				reportBulkResult("Delete", result);
				clearSelection();
				setBulkDeleteOpen(false);
			},
			onError: () => showToast("Couldn't delete those cards. Please try again.", "error"),
		});
	}

	return {
		deleteMutation,
		moveMutation,
		copyMutation,
		bulkMoveMutation,
		bulkSuspendMutation,
		bulkDeleteMutation,
		confirmDelete,
		setConfirmDelete,
		moveTarget,
		setMoveTarget,
		copyTarget,
		setCopyTarget,
		bulkMoveOpen,
		setBulkMoveOpen,
		bulkDeleteOpen,
		setBulkDeleteOpen,
		handleRowAction,
		confirmRowDelete,
		handleMoveConfirm,
		handleCopyConfirm,
		handleBulkMoveConfirm,
		handleBulkSuspend,
		handleBulkDeleteConfirm,
	};
}
