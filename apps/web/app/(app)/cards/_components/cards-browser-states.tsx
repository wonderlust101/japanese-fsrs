"use client";

// First-run empty state + delete-confirmation dialog for the cross-deck cards
// browser. Lifted out of cards-browser-view.tsx.

import { Button, ButtonLink } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";

export function FirstRunEmptyState(): React.JSX.Element {
	return (
		<EmptyState kanji="始" title="No cards yet" className="mt-10">
			<p className="max-w-measure-tight text-sm text-faded-sumi">
				Add your first card to start practicing across every deck.
			</p>
			{/* Vermillion CTA: the empty state is one of the few surfaces on /cards
          where Tomo's brand accent is justified on a large affordance. The
          page is otherwise restrained sumi-on-paper; the red reads as a
          deliberate "first step" without breaking the neutral surface budget. */}
			<ButtonLink href="/add" variant="primary" size="md">
				Add a card
			</ButtonLink>
		</EmptyState>
	);
}

export function ConfirmDeleteDialog({
	open,
	title,
	description,
	isSubmitting,
	onCancel,
	onConfirm,
}: {
	open: boolean;
	title: string;
	description: string;
	isSubmitting: boolean;
	onCancel: () => void;
	onConfirm: () => void;
}): React.JSX.Element {
	return (
		<Dialog
			open={open}
			onClose={onCancel}
			title={title}
			eyebrow={{ kanji: "削", label: "Confirm delete" }}
		>
			<p className="text-sm text-sumi-ink/85">{description}</p>
			<div className="mt-5 flex justify-end gap-2">
				<Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
				<Button variant="danger" onClick={onConfirm} loading={isSubmitting}>Delete</Button>
			</div>
		</Dialog>
	);
}
