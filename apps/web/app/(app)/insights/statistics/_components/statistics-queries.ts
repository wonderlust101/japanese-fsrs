"use client";

import type {
	ApiDeck,
	ApiInsightsDistributions,
	ApiList,
	ApiMaturitySnapshot,
} from "@fsrs-japanese/shared-types";

import type { UseSuspenseQueryResult } from "@tanstack/react-query";
import type { MaturityHistoryWindow } from "@/lib/actions/insights.actions";

import { useSuspenseQuery } from "@tanstack/react-query";
import { listDecksStrictAction } from "@/lib/actions/decks.actions";
import {
	getInsightsDistributionsStrictAction,
	getMaturityHistoryStrictAction,

} from "@/lib/actions/insights.actions";

/**
 * Statistics-only query hooks that surface real errors. They call the throwing
 * (strict) action variants and use statistics-scoped keys so they never clash
 * with the fail-open shared caches used elsewhere (today, overview, decks
 * browser). This is the contained way to give the deep-dive a "couldn't load,
 * retry" state without changing app-wide resilience.
 *
 * `gcTime: 0` ensures stale data never flashes on navigation back to the
 * Statistics page — the cache is evicted on unmount so `useSuspenseQuery`
 * suspends on the next visit and the Suspense boundary fires fresh data.
 */

const STALE = 1000 * 60 * 5;

export function useStatisticsDistributions(): UseSuspenseQueryResult<ApiInsightsDistributions, Error> {
	return useSuspenseQuery({
		queryKey: ["statistics", "distributions"],
		queryFn: getInsightsDistributionsStrictAction,
		staleTime: STALE,
		gcTime: 0,
	});
}

export function useStatisticsMaturityHistory(
	days: MaturityHistoryWindow = "90",
): UseSuspenseQueryResult<ReadonlyArray<ApiMaturitySnapshot>, Error> {
	return useSuspenseQuery({
		queryKey: ["statistics", "maturity-history", days],
		queryFn: () => getMaturityHistoryStrictAction(days),
		staleTime: STALE,
		gcTime: 0,
	});
}

export function useStatisticsDecks(
	limit = 50,
): UseSuspenseQueryResult<ApiList<ApiDeck>, Error> {
	return useSuspenseQuery({
		queryKey: ["statistics", "decks", limit],
		queryFn: () => listDecksStrictAction({ limit }),
		staleTime: STALE,
		gcTime: 0,
	});
}
