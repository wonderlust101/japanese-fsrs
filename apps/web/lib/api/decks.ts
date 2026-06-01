"use client";

import type {
	ApiCopyDeckResult,
	ApiDeck,
	ApiDeckWithStats,
	ApiList,
} from "@fsrs-japanese/shared-types";
import type { UseMutationResult, UseQueryResult, UseSuspenseQueryResult } from "@tanstack/react-query";

import type { DeckListView } from "../actions/decks.actions";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,

} from "@tanstack/react-query";
import {
	archiveDeckAction,
	copyDeckAction,
	listDecksAction,
	listDecksWithStatsAction,
	unarchiveDeckAction,

} from "../actions/decks.actions";
import { queryKeys } from "./queryKeys";

/**
 * Lists decks for the current user. The optional `view` is forwarded to the
 * server (migration 20260622000000_deck_archive.sql): `'active'` (default)
 * hides archived decks, `'archived'` shows only archived, `'all'` returns
 * both. The query key includes the view so cache entries don't bleed across
 * tabs.
 */
export function useDecks(
	limit: number = 8,
	view: DeckListView = "active",
): UseQueryResult<ApiList<ApiDeck>, Error> {
	return useQuery({
		queryKey: [...queryKeys.decks.list(), { limit, view }] as const,
		queryFn: () => listDecksAction({ limit, view }),
		staleTime: 1000 * 60 * 5,
	});
}

/**
 * Lists decks with their server-rolled-up stats (due / new / mature counts).
 * Same endpoint and cache family as {@link useDecks}, but typed and parsed as
 * `ApiDeckWithStats` so consumers can read `dueCount` without a per-deck
 * `getDeck` fanout. The query key carries a `withStats` discriminator so the
 * richer payload doesn't collide with the slim `useDecks` cache entry.
 */
export function useDecksWithStats(
	limit: number = 8,
	view: DeckListView = "active",
): UseQueryResult<ApiList<ApiDeckWithStats>, Error> {
	return useQuery({
		queryKey: [...queryKeys.decks.list(), { limit, view, withStats: true }] as const,
		queryFn: () => listDecksWithStatsAction({ limit, view }),
		staleTime: 1000 * 60 * 5,
	});
}

/**
 * Suspense variant of {@link useDecks}. Use on page-level components where the
 * deck list is the primary data. Paired with `gcTime: 0` so the cache entry is
 * evicted on unmount — on the next navigation the query has no cached data,
 * `useSuspenseQuery` suspends, and the Suspense boundary fires instead of
 * flashing stale data.
 */
export function useSuspenseDecks(
	limit: number = 8,
	view: DeckListView = "active",
): UseSuspenseQueryResult<ApiList<ApiDeck>, Error> {
	return useSuspenseQuery({
		queryKey: [...queryKeys.decks.list(), { limit, view }] as const,
		queryFn: () => listDecksAction({ limit, view }),
		staleTime: 1000 * 60 * 5,
		gcTime: 0,
	});
}

/**
 * Suspense variant of {@link useDecksWithStats}. `gcTime: 0` ensures stale
 * deck+stats data never flashes on navigation — see `useSuspenseDecks`.
 */
export function useSuspenseDecksWithStats(
	limit: number = 8,
	view: DeckListView = "active",
): UseSuspenseQueryResult<ApiList<ApiDeckWithStats>, Error> {
	return useSuspenseQuery({
		queryKey: [...queryKeys.decks.list(), { limit, view, withStats: true }] as const,
		queryFn: () => listDecksWithStatsAction({ limit, view }),
		staleTime: 1000 * 60 * 5,
		gcTime: 0,
	});
}

/**
 * POST /api/v1/decks/:id/copy. On success invalidates `decks.list` (the new
 * deck's cards are state=0 and due now) plus the review queues so the
 * forecast + due-strip pick the new inventory up immediately. Mirrors the
 * cache-busting pattern in `useCopyPremadeDeck`.
 */
export function useCopyDeck(): UseMutationResult<ApiCopyDeckResult, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (deckId: string) => copyDeckAction(deckId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});
}

/**
 * POST /api/v1/decks/:id/archive. Archive freezes the deck (write paths gate
 * via `assertDeckActive`) and excludes its cards from `/reviews/due`,
 * `/reviews/forecast`, and drill selection. The endpoint is idempotent —
 * archiving an already-archived deck preserves the original timestamp.
 *
 * Cache scope: list + reviews queues (same rationale as copy). Forecast is
 * invalidated because archived-deck cards are now excluded from the daily
 * projection (migration 20260623000000_archive_aware_forecast_and_drill.sql).
 */
export function useArchiveDeck(): UseMutationResult<ApiDeck, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (deckId: string) => archiveDeckAction(deckId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});
}

/** POST /api/v1/decks/:id/unarchive. Inverse of `useArchiveDeck`. */
export function useUnarchiveDeck(): UseMutationResult<ApiDeck, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (deckId: string) => unarchiveDeckAction(deckId),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
		},
	});
}
