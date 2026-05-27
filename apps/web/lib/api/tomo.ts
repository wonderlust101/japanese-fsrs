"use client";

import type { ApiTomoNote } from "@fsrs-japanese/shared-types";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { getTomoNoteAction } from "../actions/tomo.actions";

import { queryKeys } from "./queryKeys";

/**
 * One day in milliseconds. The Tomo note is server-cached per learner-day,
 *  so the client can hold the same response for the full day without
 *  refetching; the next dateKey naturally rotates the cache entry.
 */
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

interface UseTomoNoteOptions {
	/**
	 * Calendar date key in the learner's timezone (YYYY-MM-DD). Becomes the
	 * last segment of the cache key so the note rotates at local midnight.
	 */
	dateKey: string;

	/**
	 * Gate the network call. Today wires this to `false` while the weak-spots
	 * query is loading or has unresolved items, so the AI daily quota is only
	 * spent on calm days when the note will actually render.
	 */
	enabled: boolean;
}

export function useTomoNoteQuery(
	opts: UseTomoNoteOptions,
): UseQueryResult<ApiTomoNote | null, Error> {
	return useQuery({
		queryKey: queryKeys.tomo.note(opts.dateKey),
		queryFn: () => getTomoNoteAction(),
		enabled: opts.enabled,
		staleTime: ONE_DAY_MS,
		gcTime: ONE_DAY_MS,
		// Quota errors arrive as 429 → safe action returns null → never thrown.
		// No retry policy needed; the safe action is the failure boundary.
		retry: false,
	});
}
