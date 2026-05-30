"use client";

import type { ApiCardListItem } from "@fsrs-japanese/shared-types";
import type { Dispatch, SetStateAction } from "react";

import type { useToast } from "@/components/ui/Toast";

import { useState } from "react";

import {
	useBulkDeleteCardsMutation,
	useBulkMoveCardsMutation,
	useBulkSuspendCardsMutation,
} from "@/lib/api/cards";

type ShowToast = ReturnType<typeof useToast>["showToast"];

/**
 * Bulk card actions for the deck-detail view — move / suspend / delete over the
 * current id selection — plus the move/delete confirm-dialog open state and the
 * shared success/failure toast. Owns the three bulk mutations (which invalidate
 * cards.* + decks.*). Mirrors the bulk surface in the cards browser.
 */
export function useDeckCardsBulkActions({ selected, clearSelection, showToast }: {
	selected: ReadonlySet<string>;
	clearSelection: () => void;
	showToast: ShowToast;
}): {
	bulkMoveMutation: ReturnType<typeof useBulkMoveCardsMutation>;
	bulkDeleteMutation: ReturnType<typeof useBulkDeleteCardsMutation>;
	bulkMoveOpen: boolean;
	setBulkMoveOpen: Dispatch<SetStateAction<boolean>>;
	bulkDeleteOpen: boolean;
	setBulkDeleteOpen: Dispatch<SetStateAction<boolean>>;
	handleBulkMoveConfirm: (card: ApiCardListItem, targetDeckId: string) => void;
	handleBulkSuspend: () => void;
	handleBulkDeleteConfirm: () => void;
} {
	const bulkMoveMutation = useBulkMoveCardsMutation();
	const bulkSuspendMutation = useBulkSuspendCardsMutation();
	const bulkDeleteMutation = useBulkDeleteCardsMutation();
	const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
	const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

	function reportBulkResult(label: string, result: { succeeded: readonly string[]; failed: readonly { id: string; error: string }[] }): void {
		const ok = result.succeeded.length;
		const no = result.failed.length;
		if (no === 0)
			showToast(`${label}: ${ok} ${ok === 1 ? "card" : "cards"} updated.`);
		else showToast(`${label}: ${ok} updated, ${no} failed.`, "error");
	}

	function handleBulkMoveConfirm(_card: ApiCardListItem, targetDeckId: string): void {
		bulkMoveMutation.mutate({ ids: [...selected], targetDeckId }, {
			onSuccess: (result) => { reportBulkResult("Move", result); clearSelection(); setBulkMoveOpen(false); },
			onError: () => showToast("Couldn't move those cards. Please try again.", "error"),
		});
	}

	function handleBulkSuspend(): void {
		bulkSuspendMutation.mutate([...selected], {
			onSuccess: (result) => { reportBulkResult("Suspend", result); clearSelection(); },
			onError: () => showToast("Couldn't suspend those cards. Please try again.", "error"),
		});
	}

	function handleBulkDeleteConfirm(): void {
		bulkDeleteMutation.mutate([...selected], {
			onSuccess: (result) => { reportBulkResult("Delete", result); clearSelection(); setBulkDeleteOpen(false); },
			onError: () => showToast("Couldn't delete those cards. Please try again.", "error"),
		});
	}

	return {
		bulkMoveMutation,
		bulkDeleteMutation,
		bulkMoveOpen,
		setBulkMoveOpen,
		bulkDeleteOpen,
		setBulkDeleteOpen,
		handleBulkMoveConfirm,
		handleBulkSuspend,
		handleBulkDeleteConfirm,
	};
}
