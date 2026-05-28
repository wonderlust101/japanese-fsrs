"use client";

// Card-deletion dialogs for deck detail: single-card delete + bulk delete.
// Lifted out of deck-detail-view.tsx.

import type { ApiCardListItem } from "@fsrs-japanese/shared-types";
import { getSentenceFrontBack, getWordFields } from "@fsrs-japanese/shared-types";
import { useMemo } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function BulkDeleteCardsDialog({
	open,
	count,
	isSubmitting,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	count: number;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}): React.JSX.Element {
	return (
		<Dialog open={open} onClose={onCancel} title={`Delete ${count} ${count === 1 ? "card" : "cards"}?`}>
			<p className="mb-5 text-sm text-faded-sumi">
				Their review history will be removed permanently. This cannot be undone.
			</p>
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
					Cancel
				</Button>
				<Button type="button" variant="danger" loading={isSubmitting} onClick={onConfirm}>
					Delete
					{" "}
					{count === 1 ? "card" : "cards"}
				</Button>
			</div>
		</Dialog>
	);
}

export function CardDeleteDialog({
	target,
	isDeleting,
	errorMessage,
	onCancel,
	onConfirm,
}: {
	target: ApiCardListItem | null;
	isDeleting: boolean;
	errorMessage: string | null;
	onCancel: () => void;
	onConfirm: (card: ApiCardListItem) => void;
}): React.JSX.Element {
	const word = useMemo(() => {
		if (target === null)
			return "";
		const wordFields = getWordFields(target);
		const sentence = getSentenceFrontBack(target);
		return wordFields?.word ?? sentence?.front ?? "this card";
	}, [target]);

	return (
		<Dialog open={target !== null} onClose={onCancel} title="Delete card">
			<p className="mb-5 text-sm text-faded-sumi">
				Permanently delete
				{" "}
				<span lang="ja" className="font-semibold text-sumi-ink">{word}</span>
				{" "}
				from this deck? This cannot be undone.
			</p>
			{errorMessage !== null && (
				<p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">{errorMessage}</p>
			)}
			<div className="flex justify-end gap-2">
				<Button type="button" variant="ghost" onClick={onCancel} disabled={isDeleting}>
					Cancel
				</Button>
				<Button
					type="button"
					variant="danger"
					loading={isDeleting}
					onClick={() => {
						if (target !== null)
							onConfirm(target);
					}}
				>
					Delete card
				</Button>
			</div>
		</Dialog>
	);
}
