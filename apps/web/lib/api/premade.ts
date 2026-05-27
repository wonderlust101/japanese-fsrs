"use client";

import type {
	ApiCopyPremadeDeckResult,
	ApiList,
	ApiPremadeDeck,
} from "@fsrs-japanese/shared-types";

import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import {
	useMutation,
	useQuery,
	useQueryClient,

} from "@tanstack/react-query";
import {
	copyPremadeDeckAction,
	listPremadeDecksAction,
} from "../actions/premade.actions";
import { staleTimes } from "./config";
import { queryKeys } from "./queryKeys";

export function usePremadeDecks(): UseQueryResult<ApiList<ApiPremadeDeck>, Error> {
	return useQuery({
		queryKey: queryKeys.premadeDecks.list(),
		queryFn: () => listPremadeDecksAction(),
		staleTime: staleTimes.deckList,
	});
}

/**
 * Backend Completion Plan Stage 4 (copy model). Replaces the prior
 * `useSubscribeToPremadeDeck` and `useUnsubscribeFromPremadeDeck` hooks
 * plus `useMySubscriptions`. Copying clones every source card into a new
 * standalone deck; refreshing content means deleting the deck and copying
 * again (the FSRS-progress cost is surfaced explicitly to the user).
 */
export function useCopyPremadeDeck(): UseMutationResult<ApiCopyPremadeDeckResult, Error, string> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (premadeDeckId: string) => copyPremadeDeckAction(premadeDeckId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			// Copying creates N cards in state=0 that are due immediately; without
			// these invalidations the /review page keeps its stale (empty)
			// snapshot for the full 5-minute staleTime window.
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});
}
