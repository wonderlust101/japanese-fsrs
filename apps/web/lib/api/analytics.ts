"use client";

import type { ApiAnalyticsDashboard } from "@fsrs-japanese/shared-types";
import type { UseSuspenseQueryResult } from "@tanstack/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";

import { getDashboardAction } from "../actions/analytics.actions";
import { staleTimes } from "./config";
import { queryKeys } from "./queryKeys";

/**
 * Bundled fetch for the analytics page — combines heatmap, accuracy, JLPT
 * gap, and milestone forecast into a single round-trip. Every live caller
 * uses this hook; the granular variants were retired in the dead-code
 * sweep because no surface needed partial refresh.
 *
 * `gcTime: 0` ensures the cache entry is evicted as soon as the last observer
 * unmounts (page navigation). On the next visit the query has no cached data,
 * so `useSuspenseQuery` suspends and the Suspense boundary fires instead of
 * flashing stale data from the previous session.
 */
export function useAnalyticsDashboard(): UseSuspenseQueryResult<ApiAnalyticsDashboard, Error> {
	return useSuspenseQuery({
		queryKey: queryKeys.analytics.dashboard(),
		queryFn: getDashboardAction,
		staleTime: staleTimes.analytics,
		gcTime: 0,
	});
}
