"use client";

import type { ApiPremadeDeck } from "@fsrs-japanese/shared-types";

import { useState } from "react";

import { useToast } from "@/components/ui/Toast";
import { useCopyPremadeDeck } from "@/lib/api/premade";

type ToastApi = ReturnType<typeof useToast>;

/**
 * Copy-to-library action for the premade catalogue. Tracks the in-flight copy
 * by premade-deck id (so only the active row is disabled while a copy runs) and
 * owns the toast queue for the success / failure notice. Extracted from
 * `premade-catalogue.tsx`.
 */
export function usePremadeCopy(): {
	handleCopy: (deck: ApiPremadeDeck) => void;
	pendingId: string | null;
	toast: ToastApi["toast"];
	dismissToast: ToastApi["dismissToast"];
} {
	const { toast, showToast, dismissToast } = useToast();
	const copyMutation = useCopyPremadeDeck();
	const [pendingId, setPendingId] = useState<string | null>(null);

	function handleCopy(deck: ApiPremadeDeck): void {
		if (pendingId !== null)
			return;
		setPendingId(deck.id);
		copyMutation.mutate(deck.id, {
			onSuccess: (result) => {
				setPendingId(null);
				showToast(
					`Added ${result.cardCount} ${result.cardCount === 1 ? "card" : "cards"} from ${deck.name} to your library.`,
				);
			},
			onError: () => {
				setPendingId(null);
				showToast("Couldn't add this deck. Please try again in a moment.", "error");
			},
		});
	}

	return { handleCopy, pendingId, toast, dismissToast };
}
