import type { UseMutationResult } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { copyCardAction, deleteCardAction, moveCardAction } from "@/lib/actions/cards.actions";
import { queryKeys } from "@/lib/api/queryKeys";

type DeleteResult = Awaited<ReturnType<typeof deleteCardAction>>;
type MoveResult = Awaited<ReturnType<typeof moveCardAction>>;
type CopyResult = Awaited<ReturnType<typeof copyCardAction>>;
interface CardTargetVars { cardId: string; targetDeckId: string }

export interface DeckCardMutations {
	deleteCardMutation: UseMutationResult<DeleteResult, Error, string>;
	moveCardMutation: UseMutationResult<MoveResult, Error, CardTargetVars>;
	copyCardMutation: UseMutationResult<CopyResult, Error, CardTargetVars>;
}

/**
 * The three single-card mutations for the deck-detail view: delete, move, copy.
 *
 * Each owns only its cache-invalidation policy. Success toasts + dialog
 * dismissal deliberately stay at the call site (the dialog `onConfirm`
 * closures) because they differ per surface — keeping them here would force
 * the hook to depend on the toast system and dialog state.
 *
 * - delete: refreshes this deck's cards + detail + the due queue.
 * - move: also refreshes the target deck + the decks list.
 * - copy: leaves the source untouched, so it refreshes the target deck's
 *   caches plus the decks list, due queue, and forecast (the clone lands in
 *   state=0 and is due immediately).
 */
export function useDeckCardMutations(deckId: string): DeckCardMutations {
	const queryClient = useQueryClient();

	const deleteCardMutation = useMutation({
		mutationFn: (cardId: string) => deleteCardAction(cardId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
		},
	});

	const moveCardMutation = useMutation({
		mutationFn: ({ cardId, targetDeckId }: CardTargetVars) =>
			moveCardAction(cardId, targetDeckId),
		onSuccess: (_data, { targetDeckId }) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
		},
	});

	const copyCardMutation = useMutation({
		mutationFn: ({ cardId, targetDeckId }: CardTargetVars) =>
			copyCardAction(cardId, targetDeckId),
		onSuccess: (_data, { targetDeckId }) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});

	return { deleteCardMutation, moveCardMutation, copyCardMutation };
}
