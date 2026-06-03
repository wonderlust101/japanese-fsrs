"use client";

import type {
	ApiDueCard,
	ApiForecastDay,
	ApiList,
	ApiRatingsPreview,
	ApiReviewedCard,
	SessionSummary,
	SessionWeakSpot,
	SubmitReviewInput,
} from "@fsrs-japanese/shared-types";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useReviewSessionStore } from "@/stores/useReviewSessionStore";
import { getDayReflectionAction } from "../actions/reflections.actions";
import {
	closeSessionAction,
	getDueCardsAction,
	getRatingsPreviewAction,
	getReviewForecastAction,
	getSessionSummaryAction,
	rollbackReviewAction,
	submitBatchAction,
	submitReviewAction,
} from "../actions/reviews.actions";
import { diagnoseWeakSpotAction } from "../actions/weak-spots.actions";
import { MAX_ATTEMPTS, offlineQueue } from "../offline-queue";
import { queryKeys } from "./queryKeys";

// Reuses the canonical shared schema-derived type — `rating` excludes 'manual'
// because the user-facing API rejects it; `reviewTimeMs` / `sessionId` are
// optional and may be undefined post-Zod inference.
//
// `warmupSummary` is an internal client-only flag (not part of the wire payload):
// the session client sets it on the final card's submit so the post-persist
// warm-up runs from the hook (mount-independent), surviving the optimistic
// navigation that unmounts the session client. Stripped before the wire call and
// before the offline queue.
type SubmitReviewVariables = SubmitReviewInput & { warmupSummary?: boolean };

export function useSubmitReview(): UseMutationResult<ApiReviewedCard, Error, SubmitReviewVariables> {
	const queryClient = useQueryClient();
	const warmupFinishedSession = useFinishedSessionWarmup();

	return useMutation({
		mutationFn: ({ cardId, rating, reviewTimeMs, sessionId }: SubmitReviewVariables) =>
			submitReviewAction(cardId, rating, reviewTimeMs, sessionId),

		// Hook-level (not per-call): fires regardless of whether the component that
		// called mutate() is still mounted. This is load-bearing for the last-card
		// optimistic navigation, which unmounts the session client before the submit
		// resolves — a per-call onSuccess would be dropped. Attaching here also
		// confirms persistence for the summary page's read-gate (it waits for the
		// final history entry's reviewLogId). The store action no-ops when the entry
		// is missing, so this is safe for every submit (incl. the summary re-apply).
		onSuccess: (data, variables) => {
			if (data.reviewLogId !== null) {
				useReviewSessionStore.getState().actions.attachReviewLogId(variables.cardId, data.reviewLogId);
			}
			// Fire the session-close precompute as soon as the last review is
			// confirmed persisted. onSuccess fires before onSettled, giving the
			// server-side day-reflection generation a head start over the
			// warmup's prefetch calls (which run in onSettled). The in-flight
			// single-flight map in day-reflection.ts deduplicates them into one
			// OpenAI call regardless of which arrives first.
			if (variables.warmupSummary === true && variables.sessionId != null) {
				void closeSessionAction(variables.sessionId);
			}
		},

		onError: (err, variables) => {
			console.error("[Review] Submission failed — queuing offline:", err);
			// The queue assigns its own per-entry idempotency key. Direct submits
			// already used a fresh key inside submitReviewAction; the queue path is
			// distinct because a queued retry must use a stable key across attempts.
			// Strip the client-only `warmupSummary` flag (and sessionId, which the
			// queue doesn't persist — the batch-replay path is sessionless). The
			// queue's add() takes the wire-minus-session shape.
			offlineQueue.add({
				cardId: variables.cardId,
				rating: variables.rating,
				reviewTimeMs: variables.reviewTimeMs,
			});
		},

		onSettled: (_data, _err, variables) => {
			// Mark these stale WITHOUT an immediate refetch (`refetchType: 'none'`).
			// During a session the review overlay suppresses the sidebar, so there's
			// no active `due`/`forecast` observer — a plain invalidate is a no-op
			// mid-session but, on navigation to the summary, the freshly-mounted
			// sidebar observer would replay every accumulated invalidation as a
			// refetch stampede that saturates the browser's ~6-connection limit and
			// starves the summary/forecast/reflection/close requests. Marking stale
			// only lets the remounting observer refetch ONCE (refetchOnMount-if-stale)
			// — the badge still updates, with one request instead of a storm.
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due(), refetchType: "none" });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast(), refetchType: "none" });
			void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard(), refetchType: "none" });
			// Last-card warm-up, fired AFTER persist so the prefetched summary is the
			// complete aggregate (not missing the just-submitted final card). Runs
			// from the hook so it survives the session client's optimistic unmount.
			if (variables.warmupSummary === true && variables.sessionId != null) {
				warmupFinishedSession(variables.sessionId);
			}
		},
	});
}

export function useDueCards(opts?: { enabled?: boolean }): UseQueryResult<ApiList<ApiDueCard>> {
	return useQuery({
		queryKey: queryKeys.reviews.due(),
		queryFn: getDueCardsAction,
		staleTime: 1000 * 60 * 5,
		// One retry instead of the default 3. A 403/401 from infrastructure is
		// permanent (not transient), and retrying three times floods server logs
		// with `POST /<page> 500` entries — especially because this query is
		// mounted globally via useReviewsSubLabel in every (app)-shell page.
		// ApiHttpError.status is stripped across the server-action boundary in
		// production so we can't gate on status code here; 1 retry is enough for
		// genuine transient network blips.
		retry: 1,
		// Default: always on (the nav badge observes this unconditionally). The
		// session client passes `enabled: phase === 'idle'` so it only fetches to
		// bootstrap a session and stops observing once one is active/finished.
		...(opts?.enabled !== undefined && { enabled: opts.enabled }),
	});
}

/**
 * Anki-style next-interval preview for a single card. Used to render the
 * "what happens if I rate this?" labels above each rating button when the
 * answer is revealed. Disabled when `cardId` is null (no active card).
 *
 * Stable per (cardId, FSRS-state) — since FSRS state only changes after a
 * rating is submitted, we cache aggressively here; `useSubmitReview` already
 * invalidates `reviews.due` which forces the next card view to refetch.
 */
export function useRatingsPreview(cardId: string | null): UseQueryResult<ApiRatingsPreview> {
	return useQuery({
		queryKey: queryKeys.reviews.preview(cardId ?? ""),
		queryFn: () => getRatingsPreviewAction(cardId as string),
		enabled: cardId !== null,
		staleTime: 1000 * 60 * 5,
	});
}

export function useReviewForecast(): UseQueryResult<ApiList<ApiForecastDay>> {
	return useQuery({
		queryKey: queryKeys.reviews.forecast(),
		queryFn: getReviewForecastAction,
		staleTime: 1000 * 60 * 30,
	});
}

/**
 * Imperative warm-up fired when a session finishes: prefetches the
 * session-summary, forecast, and day-reflection queries so the Review Summary
 * page subscribes to in-flight fetches at mount instead of starting cold ones.
 * Uses the same query keys the summary page reads, so React Query dedupes —
 * no double fetch.
 *
 * The session-close signal (server-side precompute) is NOT fired here; it
 * fires in useSubmitReview's onSuccess for the last card so it has a head
 * start before these prefetch calls run in onSettled.
 *
 * Call only once the final review has persisted: the session-summary +
 * day-reflection RPCs read persisted `review_logs`, so the session client
 * invokes this from the last submit's `onSettled` (and from the ended-early
 * navigation, only when cards were actually rated).
 */
export function useFinishedSessionWarmup(): (sessionId: string) => void {
	const queryClient = useQueryClient();
	return useCallback((sessionId: string) => {
		void queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.summary(sessionId),
			queryFn: () => getSessionSummaryAction(sessionId),
			staleTime: Infinity,
		});
		void queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.forecast(),
			queryFn: getReviewForecastAction,
			staleTime: 1000 * 60 * 30,
		});
		// Match useDayReflectionQuery's staleTime (FIVE_MIN_MS) so the summary
		// page treats the warmed result as fresh and subscribes without a refetch.
		void queryClient.prefetchQuery({
			queryKey: queryKeys.reviews.dayReflection(sessionId),
			queryFn: () => getDayReflectionAction(sessionId),
			staleTime: 1000 * 60 * 5,
		});
	}, [queryClient]);
}

/**
 * Roll back a specific review log. The summary surfaces this on each
 * weak-spot row when the local session matches the summary's session id,
 * so the user can undo a misclick within the same closure moment.
 *
 * Cache invalidations cover every surface that observes the card's FSRS
 * state — due queue, forecast, heatmap, accuracy, card detail — plus the
 * session summary itself so the row count + accuracy refresh.
 */
export function useRollbackReviewMutation(): UseMutationResult<void, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (reviewLogId: string) => rollbackReviewAction(reviewLogId),
		onSuccess: () => {
			// Invalidate every cache the rolled-back review can touch: the due
			// queue + forecast (card may re-appear), analytics fan-out (heatmap
			// + accuracy reflect the now-removed review), and the cards root so
			// any open card detail re-reads its FSRS state.
			void queryClient.invalidateQueries({ queryKey: ["reviews"] });
			void queryClient.invalidateQueries({ queryKey: ["analytics"] });
			void queryClient.invalidateQueries({ queryKey: queryKeys.cards.all() });
		},
	});
}

export function useSessionSummary(
	sessionId: string | null,
	opts?: { placeholderData?: SessionSummary | undefined },
): UseQueryResult<SessionSummary> {
	const safeId = sessionId ?? "";
	return useQuery({
		queryKey: queryKeys.reviews.summary(safeId),
		queryFn: () => getSessionSummaryAction(safeId),
		enabled: sessionId !== null,
		staleTime: Infinity,
		// The summary endpoint returns 404 for "no rows for this session id"
		// (including the legitimate ended-early-with-no-reviews case). Default
		// retry behavior would chase those 404s through ~10s of exponential
		// backoff before the page can render its forgiving empty state.
		// Single-shot read; if it failed once it will fail again the same way.
		retry: false,
		// Local-first: when the just-finished session is still in the store, the
		// page passes a provisional summary (correct totals/breakdown/time,
		// empty weak spots) so the closing screen's numbers paint immediately
		// instead of behind the full-page loader. `isPlaceholderData` stays true
		// until the real read resolves, so the page can gate pattern-derived copy
		// (hero + action labels) on the server data and avoid a headline flip.
		...(opts?.placeholderData !== undefined && { placeholderData: opts.placeholderData }),
	});
}

// Max diagnose calls in flight at once. Sized to stay comfortably under the
// per-minute AI rate limiter (20/min) even on an unusually weak-spot-heavy
// session, while leaving the common case (< 6 weak spots) effectively
// unbounded so every row's diagnosis starts immediately.
const DIAGNOSE_CONCURRENCY = 6;

/**
 * Fires AI diagnosis per undiagnosed weak spot for a finished session and
 * patches each result into the session-summary cache the moment it resolves,
 * so the rows fill in incrementally (each `WeakSpotRow` shows its own
 * "Diagnosing…" pulse until patched) with no batch wait and no summary refetch.
 *
 * Replaces the prior single-batch endpoint. Per-row is the faster path to a
 * fully-populated summary — the first diagnosis appears after the *quickest*
 * call instead of the slowest, and there is no second `/session-summary`
 * round-trip — at the cost of one AI-quota unit per weak spot (bounded by the
 * concurrency cap above).
 *
 * Fires at most once per mount (ref-guarded). Pass the resolved summary's
 * `weakSpots` once available and a real `sessionId` (null for fixture /
 * ended-early surfaces, which carry pre-baked or no diagnoses); the hook
 * no-ops until there is at least one undiagnosed weak spot.
 */
export function useIncrementalSessionDiagnosis(
	sessionId: string | null,
	weakSpots: readonly SessionWeakSpot[] | undefined,
): void {
	const queryClient = useQueryClient();
	const firedRef = useRef(false);

	useEffect(() => {
		if (firedRef.current)
			return;
		if (sessionId === null || weakSpots === undefined)
			return;
		const pending = weakSpots
			.filter(w => w.diagnosis === null)
			.map(w => w.weakSpotId);
		if (pending.length === 0)
			return;
		firedRef.current = true;

		const summaryKey = queryKeys.reviews.summary(sessionId);

		// Copy the diagnosis/prescription off the diagnose response onto the
		// matching summary row (ApiWeakSpotListItem.id === SessionWeakSpot.weakSpotId).
		// staleTime is Infinity on the summary query, so this patch is not
		// clobbered by a refetch.
		const patchRow = (item: { id: string; diagnosis: string | null; prescription: string | null }): void => {
			queryClient.setQueryData<SessionSummary>(summaryKey, (old) => {
				if (old === undefined)
					return old;
				return {
					...old,
					weakSpots: old.weakSpots.map(w =>
						w.weakSpotId === item.id
							? { ...w, diagnosis: item.diagnosis, prescription: item.prescription }
							: w),
				};
			});
		};

		// Bounded-concurrency worker pool: each worker pulls the next id,
		// diagnoses it, patches its row, and repeats. Per-row failures are
		// swallowed — diagnosis is advisory, so a failed row simply keeps its
		// "Diagnosing…" pulse (same end-state as a failed batch row before).
		let cursor = 0;
		const runWorker = async (): Promise<void> => {
			while (cursor < pending.length) {
				const id = pending[cursor];
				cursor += 1;
				if (id === undefined)
					continue;
				try {
					patchRow(await diagnoseWeakSpotAction(id));
				} catch {
					// Advisory enhancement — leave the row undiagnosed on failure.
				}
			}
		};

		const workerCount = Math.min(DIAGNOSE_CONCURRENCY, pending.length);
		void Promise.allSettled(Array.from({ length: workerCount }, () => runWorker()));
	}, [sessionId, weakSpots, queryClient]);
}

/**
 * Drains the offline queue exactly once per mount, unless the queue has
 * tipped into the "stuck" state (5+ consecutive failed attempts). When stuck,
 * auto-drain skips and the user must explicitly tap "Retry now" via the
 * `useOfflineQueueStatus` hook to clear the flag and try again.
 */
export function useOfflineSync(): void {
	const flushedRef = useRef(false);

	useEffect(() => {
		if (flushedRef.current)
			return;
		if (offlineQueue.isStuck())
			return;
		if (offlineQueue.size() === 0)
			return;
		flushedRef.current = true;

		void runOfflineDrain();
	}, []);
}

/** Single-flight drain shared by useOfflineSync (auto) and retryNow (manual). */
async function runOfflineDrain(): Promise<void> {
	const { reviews, batchKey } = offlineQueue.drainBatch();
	if (reviews.length === 0)
		return;

	// Strip queue-only metadata (queuedAt, idempotencyKey) before sending —
	// the wire format is SubmitReviewInput. The batch idempotency key is
	// sent in the header; per-entry keys stay in localStorage so a re-queue
	// after a failed batch preserves them.
	const wireReviews: SubmitReviewInput[] = reviews.map(r => ({
		cardId: r.cardId,
		rating: r.rating,
		reviewTimeMs: r.reviewTimeMs,
	}));

	try {
		const result = await submitBatchAction(wireReviews, batchKey);
		offlineQueue.confirmBatch();
		// Attach the server-side review log ids onto the local session history
		// so the Review Summary's "Roll back" affordance works for cards that
		// were submitted via the offline-replay path. The store action is a
		// no-op when `phase` isn't 'active' | 'finished', so calling it after
		// navigation away from the session is safe.
		const attach = useReviewSessionStore.getState().actions.attachReviewLogId;
		for (const r of result.results) {
			if (r.reviewLogId !== null)
				attach(r.id, r.reviewLogId);
		}
	} catch {
		offlineQueue.replayBatch(reviews);
		offlineQueue.recordFailure();
	}
}

/**
 * Reactive view of the offline queue: count of pending entries and whether
 * the queue has hit the stuck threshold. `retryNow` and `discardPending`
 * back the buttons in the stuck-state banner.
 */
export interface OfflineQueueStatus {
	count: number;
	attempts: number;
	stuck: boolean;
	retryNow: () => void;
	discardPending: () => void;
}

interface QueueSnapshot {
	count: number;
	attempts: number;
}

const SERVER_SNAPSHOT: QueueSnapshot = { count: 0, attempts: 0 };
let cachedSnapshot: QueueSnapshot = SERVER_SNAPSHOT;

function getSnapshot(): QueueSnapshot {
	const next: QueueSnapshot = {
		count: offlineQueue.size(),
		attempts: offlineQueue.attempts(),
	};
	// Stable identity — useSyncExternalStore re-renders only when reference changes.
	if (cachedSnapshot.count === next.count && cachedSnapshot.attempts === next.attempts) {
		return cachedSnapshot;
	}
	cachedSnapshot = next;
	return next;
}

function getServerSnapshot(): QueueSnapshot {
	return SERVER_SNAPSHOT;
}

export function useOfflineQueueStatus(): OfflineQueueStatus {
	const snapshot = useSyncExternalStore(
		listener => offlineQueue.subscribe(listener),
		getSnapshot,
		getServerSnapshot,
	);

	const retryNow = useCallback(() => {
		offlineQueue.resetAttempts();
		void runOfflineDrain();
	}, []);

	const discardPending = useCallback(() => {
		offlineQueue.clear();
	}, []);

	return {
		count: snapshot.count,
		attempts: snapshot.attempts,
		stuck: snapshot.attempts >= MAX_ATTEMPTS,
		retryNow,
		discardPending,
	};
}
