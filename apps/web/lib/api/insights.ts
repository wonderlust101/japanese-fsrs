"use client";

import type { ApiInsightsDistributions, ApiMaturitySnapshot } from "@fsrs-japanese/shared-types";
import type { UseSuspenseQueryResult } from "@tanstack/react-query";
import type { MaturityHistoryWindow } from "../actions/insights.actions";

import { useSuspenseQuery } from "@tanstack/react-query";
import {
	getInsightsDistributionsAction,
	getMaturityHistoryAction,

} from "../actions/insights.actions";
import { staleTimes } from "./config";
import { queryKeys } from "./queryKeys";

/**
 * Backend Completion Plan Stage 9 — `GET /api/v1/insights/maturity-history`.
 * Reuses the analytics staleTime (1h) because the snapshot table is updated
 * by a daily cron; the live "today" row is computed on every server call so
 * the chart reflects the current moment without needing a tighter staleTime.
 *
 * `gcTime: 0` pairs with `useSuspenseQuery` to eliminate stale-data flashes on
 * navigation — see `useAnalyticsDashboard` for the rationale.
 */
export function useMaturityHistory(
	days: MaturityHistoryWindow = "90",
): UseSuspenseQueryResult<ReadonlyArray<ApiMaturitySnapshot>, Error> {
	return useSuspenseQuery({
		queryKey: queryKeys.insights.maturityHistory(days),
		queryFn: () => getMaturityHistoryAction(days),
		staleTime: staleTimes.analytics,
		gcTime: 0,
	});
}

/**
 * Bundled distributions for the Statistics page. Four histograms in one
 * round-trip: ratings (again/hard/good/easy), intervals, FSRS stability,
 * FSRS difficulty. Backed by `GET /api/v1/insights/distributions`; uses
 * `apiCallSafe` so auth/5xx returns a zero-filled bundle and the chart
 * components render their calm "no data yet" message instead of erroring.
 *
 * `gcTime: 0` — see `useAnalyticsDashboard` for the navigation-flash rationale.
 */
export function useInsightsDistributions(): UseSuspenseQueryResult<ApiInsightsDistributions, Error> {
	return useSuspenseQuery({
		queryKey: queryKeys.insights.distributions(),
		queryFn: () => getInsightsDistributionsAction(),
		staleTime: staleTimes.analytics,
		gcTime: 0,
	});
}
