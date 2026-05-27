"use client";

import type {
	ApiBulkCardMutationResult,
	ApiCard,
	ApiCardQualityIssue,
	ApiReviewedCard,
} from "@fsrs-japanese/shared-types";

import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import type { CrossDeckCardsActionOptions, CrossDeckListResult } from "../actions/cards.actions";
import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,

} from "@tanstack/react-query";
import {
	bulkDeleteCardsAction,
	bulkMoveCardsAction,
	bulkSuspendCardsAction,
	bulkUnsuspendCardsAction,
	copyCardAction,
	deleteCardAction,
	forgetCardAction,
	listCardsCrossDeckAction,
	moveCardAction,
	rescheduleCardAction,
	suspendCardAction,
	unsuspendCardAction,

} from "../actions/cards.actions";
import { getCardQualityIssuesAction } from "../actions/insights.actions";

import { staleTimes } from "./config";
import { queryKeys } from "./queryKeys";

// ─── Reads ────────────────────────────────────────────────────────────────────

/**
 * Cross-deck card-browser list. The filter object is part of the cache key
 * so each (deck/status/jlpt/search/missingField/sort) combination caches
 * independently. `apiCallSafe` keeps the action graceful: auth/5xx returns
 * the empty page rather than throwing, so the table renders an empty state
 * instead of an error.
 */
export function useCardsCrossDeckQuery(
	opts: CrossDeckCardsActionOptions = {},
): UseQueryResult<CrossDeckListResult, Error> {
	return useQuery({
		queryKey: queryKeys.cards.crossDeck(opts),
		queryFn: () => listCardsCrossDeckAction(opts),
		staleTime: staleTimes.cardsList,
		// Keep the previous result visible during a refetch under a new
		// queryKey (filter/sort/search change). Without this, TanStack's
		// cache lookup misses on the new key, `data` becomes undefined,
		// `isLoading` flips true, and the consumer treats it as a cold
		// boot. With this, the prior rows stay on screen and only
		// `isFetching` flips — letting the cards page show a table-level
		// skeleton while keeping the toolbar and chip strip interactive.
		placeholderData: keepPreviousData,
	});
}

/**
 * Card-health summary for the /cards quality-bars panel. Six rows
 * `{ issueType, count }` keyed off the backend's enum — `CardsQualityBars`
 * maps them to its display labels at render time.
 */
export function useCardQualityIssuesQuery(): UseQueryResult<ReadonlyArray<ApiCardQualityIssue>, Error> {
	return useQuery({
		queryKey: queryKeys.cards.qualityIssues(),
		queryFn: () => getCardQualityIssuesAction(),
		staleTime: staleTimes.analytics,
	});
}

// ─── Single-card mutations ────────────────────────────────────────────────────

/**
 * Invalidates every cards.* cache + the affected decks' rollups, plus the
 * review queue (due + forecast). A card mutation can change what's
 * reviewable — delete removes a due card, move re-groups it, edit changes the
 * cached content — so the today/review surfaces must refetch too.
 */
function useCardCachesInvalidator(): () => Promise<void> {
	const queryClient = useQueryClient();
	return async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: queryKeys.cards.all() }),
			queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() }),
			queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() }),
			queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() }),
		]);
	};
}

export function useDeleteCardMutation(): UseMutationResult<void, Error, string> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (cardId: string) => deleteCardAction(cardId),
		onSuccess: () => invalidate(),
	});
}

export interface MoveCardVariables { cardId: string; targetDeckId: string }
export function useMoveCardMutation(): UseMutationResult<ApiCard, Error, MoveCardVariables> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: v => moveCardAction(v.cardId, v.targetDeckId),
		onSuccess: () => invalidate(),
	});
}

export function useCopyCardMutation(): UseMutationResult<ApiCard, Error, MoveCardVariables> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: v => copyCardAction(v.cardId, v.targetDeckId),
		onSuccess: () => invalidate(),
	});
}

export function useSuspendCardMutation(): UseMutationResult<ApiCard, Error, string> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (cardId: string) => suspendCardAction(cardId),
		onSuccess: () => invalidate(),
	});
}

export function useUnsuspendCardMutation(): UseMutationResult<ApiCard, Error, string> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (cardId: string) => unsuspendCardAction(cardId),
		onSuccess: () => invalidate(),
	});
}

export interface ForgetCardVariables { cardId: string; resetCount?: boolean }

/** Reset FSRS scheduling and queue the card as new. */
export function useForgetCardMutation(): UseMutationResult<ApiReviewedCard, Error, ForgetCardVariables> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: v => forgetCardAction(v.cardId, v.resetCount === true ? { resetCount: true } : {}),
		onSuccess: () => invalidate(),
	});
}

/** Replay the card's history and recompute FSRS state from scratch. */
export function useRescheduleCardMutation(): UseMutationResult<ApiReviewedCard, Error, string> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (cardId: string) => rescheduleCardAction(cardId),
		onSuccess: () => invalidate(),
	});
}

// ─── Bulk mutations ───────────────────────────────────────────────────────────

export interface BulkMoveVariables { ids: readonly string[]; targetDeckId: string }
export function useBulkMoveCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, BulkMoveVariables> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: v => bulkMoveCardsAction(v.ids, v.targetDeckId),
		onSuccess: () => invalidate(),
	});
}

export function useBulkSuspendCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (ids: readonly string[]) => bulkSuspendCardsAction(ids),
		onSuccess: () => invalidate(),
	});
}

export function useBulkUnsuspendCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (ids: readonly string[]) => bulkUnsuspendCardsAction(ids),
		onSuccess: () => invalidate(),
	});
}

export function useBulkDeleteCardsMutation(): UseMutationResult<ApiBulkCardMutationResult, Error, readonly string[]> {
	const invalidate = useCardCachesInvalidator();
	return useMutation({
		mutationFn: (ids: readonly string[]) => bulkDeleteCardsAction(ids),
		onSuccess: () => invalidate(),
	});
}
