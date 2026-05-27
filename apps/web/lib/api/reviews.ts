"use client";

import type {
	ApiBatchDiagnoseResult,
	ApiDueCard,
	ApiForecastDay,
	ApiList,
	ApiRatingsPreview,
	ApiReviewedCard,
	SessionSummary,
	SubmitReviewInput,
} from "@fsrs-japanese/shared-types";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { useReviewSessionStore } from "@/stores/useReviewSessionStore";
import {
	batchDiagnoseSessionWeakSpotsAction,
	getDueCardsAction,
	getRatingsPreviewAction,
	getReviewForecastAction,
	getSessionSummaryAction,
	rollbackReviewAction,
	submitBatchAction,
	submitReviewAction,
} from "../actions/reviews.actions";
import { MAX_ATTEMPTS, offlineQueue } from "../offline-queue";
import { queryKeys } from "./queryKeys";

// Reuses the canonical shared schema-derived type — `rating` excludes 'manual'
// because the user-facing API rejects it; `reviewTimeMs` / `sessionId` are
// optional and may be undefined post-Zod inference.
type SubmitReviewVariables = SubmitReviewInput;

export function useSubmitReview(): UseMutationResult<ApiReviewedCard, Error, SubmitReviewVariables> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ cardId, rating, reviewTimeMs, sessionId }: SubmitReviewVariables) =>
			submitReviewAction(cardId, rating, reviewTimeMs, sessionId),

		onError: (err, variables) => {
			console.error("[Review] Submission failed — queuing offline:", err);
			// The queue assigns its own per-entry idempotency key. Direct submits
			// already used a fresh key inside submitReviewAction; the queue path is
			// distinct because a queued retry must use a stable key across attempts.
			offlineQueue.add(variables);
		},

		onSettled: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() });
			void queryClient.invalidateQueries({ queryKey: queryKeys.analytics.dashboard() });
		},
	});
}

export function useDueCards(): UseQueryResult<ApiList<ApiDueCard>> {
	return useQuery({
		queryKey: queryKeys.reviews.due(),
		queryFn: getDueCardsAction,
		staleTime: 1000 * 60 * 5,
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

export function useSessionSummary(sessionId: string | null): UseQueryResult<SessionSummary> {
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
	});
}

// Batch diagnose mutation. On success, invalidate the session-summary
// query so the freshly-populated diagnoses re-render inline on the
// weak-spot rows.
export function useBatchDiagnoseSessionWeakSpots(
	sessionId: string | null,
): UseMutationResult<ApiBatchDiagnoseResult, Error, void> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => {
			if (sessionId === null) {
				return Promise.reject(new Error("No session ID for batch diagnose"));
			}
			return batchDiagnoseSessionWeakSpotsAction(sessionId);
		},
		onSuccess: () => {
			if (sessionId !== null) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.reviews.summary(sessionId),
				});
			}
		},
	});
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
