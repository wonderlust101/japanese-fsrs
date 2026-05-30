"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { deleteCardAction } from "@/lib/actions/cards.actions";
import {
	useForgetCardMutation,
	useMoveCardMutation,
	useRescheduleCardMutation,
	useSuspendCardMutation,
	useUnsuspendCardMutation,
} from "@/lib/api/cards";
import { queryKeys } from "@/lib/api/queryKeys";

/**
 * Every mutation the card-detail page drives — delete, suspend / unsuspend,
 * move, and the two repair operations (forget, reschedule) — plus the
 * suspend-direction-aware `pending` / `error` projection the suspend dialog
 * renders. Owns the router (delete navigates back to the deck) and the query
 * client (delete invalidates the deck + due caches).
 *
 * Extracted from `card-detail-view.tsx`. `closeRepairDialog` stays in the view
 * since it also clears the view's dialog state; it calls `.reset()` on the
 * forget / reschedule mutations returned here.
 */
export function useCardDetailMutations({ cardId, deckId, isSuspended }: {
	cardId: string;
	deckId: string;
	isSuspended: boolean;
}): {
	deleteMutation: UseMutationResult<Awaited<ReturnType<typeof deleteCardAction>>, Error, void>;
	suspendMutation: ReturnType<typeof useSuspendCardMutation>;
	unsuspendMutation: ReturnType<typeof useUnsuspendCardMutation>;
	moveMutation: ReturnType<typeof useMoveCardMutation>;
	forgetMutation: ReturnType<typeof useForgetCardMutation>;
	rescheduleMutation: ReturnType<typeof useRescheduleCardMutation>;
	suspendPending: boolean;
	suspendError: string | null;
} {
	const router = useRouter();
	const queryClient = useQueryClient();

	const deleteMutation = useMutation({
		mutationFn: () => deleteCardAction(cardId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			router.push(`/decks/${deckId}`);
		},
	});

	// The hooks invalidate cards.all() + decks.all() so the liveCard query
	// re-reads after suspend/unsuspend (driving the `isSuspended` chrome) and
	// every list view that includes this card refreshes after a move.
	const suspendMutation = useSuspendCardMutation();
	const unsuspendMutation = useUnsuspendCardMutation();
	const moveMutation = useMoveCardMutation();
	const forgetMutation = useForgetCardMutation();
	const rescheduleMutation = useRescheduleCardMutation();

	const suspendPending = isSuspended ? unsuspendMutation.isPending : suspendMutation.isPending;
	const suspendError = isSuspended
		? (unsuspendMutation.isError ? (unsuspendMutation.error?.message ?? "Unknown error") : null)
		: (suspendMutation.isError ? (suspendMutation.error?.message ?? "Unknown error") : null);

	return {
		deleteMutation,
		suspendMutation,
		unsuspendMutation,
		moveMutation,
		forgetMutation,
		rescheduleMutation,
		suspendPending,
		suspendError,
	};
}
