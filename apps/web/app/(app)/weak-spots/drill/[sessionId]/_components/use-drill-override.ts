"use client";

import type {
	ApiWeakSpotDrillAttemptResult,
	ApiWeakSpotDrillSessionDetailCard,
	SubmitReviewInput,
} from "@fsrs-japanese/shared-types";

import type { useToast } from "@/components/ui/Toast";
import type { useDrillActions } from "@/stores/useWeakSpotDrillSessionStore";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

import { queryKeys } from "@/lib/api/queryKeys";
import { useSubmitReview } from "@/lib/api/reviews";

type RealReviewRating = SubmitReviewInput["rating"];
type DrillActions = ReturnType<typeof useDrillActions>;
type ShowToast = ReturnType<typeof useToast>["showToast"];

// When the override succeeds, the queue still needs to advance locally. The
// drill summary distinguishes "rated as drill" from "counted as review" via
// the record's `countedAsReview` flag, so the local attempt is preserved with
// the closest equivalent drill bucket — this is local accounting only, not a
// wire write (the network drill-attempt mutation is skipped on the override
// path).
function mapRealRatingToDrillResult(rating: RealReviewRating): ApiWeakSpotDrillAttemptResult {
	if (rating === "again")
		return "missed";
	if (rating === "hard")
		return "hesitated";
	return "remembered";
}

/**
 * The drill "explicit real-review override" sub-feature, extracted from
 * `drill-session-client.tsx`. The learner can opt a drill answer into the
 * canonical schedule:
 *   1. Submit a fresh canonical review (hits process_review() → a real
 *      review_logs row).
 *   2. Advance the local drill queue with countedAsReview=true so the summary
 *      labels the card distinctly — without a wire write.
 *   3. Skip the drill-attempt network mutation for that card.
 *   4. Invalidate the weak-spots family so the unresolved-count badge updates.
 *
 * Owns the panel open state, the submit mutation, and the query client. The
 * collapse effect closes the panel whenever a new card surfaces. Handlers are
 * memoised so the keyboard hook's effect deps stay stable.
 */
export function useDrillOverride({ isActive, showAnswer, currentCard, currentIndex, isDev, actions, showToast }: {
	isActive: boolean;
	showAnswer: boolean;
	currentCard: ApiWeakSpotDrillSessionDetailCard | undefined;
	currentIndex: number;
	isDev: boolean;
	actions: DrillActions;
	showToast: ShowToast;
}): {
	overrideOpen: boolean;
	overrideBusy: boolean;
	handleSubmitAsReview: (rating: RealReviewRating) => void;
	handleOpenOverride: () => void;
	handleCancelOverride: () => void;
} {
	const submitReviewMutation = useSubmitReview();
	const queryClient = useQueryClient();
	const [overrideOpen, setOverrideOpen] = useState(false);
	// Lock the override panel while the canonical review submission is in
	// flight so a double-click doesn't fire two reviews for the same card.
	const overrideBusy = submitReviewMutation.isPending;

	const handleSubmitAsReview = useCallback(
		(rating: RealReviewRating) => {
			if (!isActive)
				return;
			if (currentCard === undefined)
				return;
			const cardId = currentCard.cardId;
			if (cardId === null) {
				showToast("This card has been deleted and can't be counted as a review.", "error");
				return;
			}
			if (isDev) {
				actions.recordAttempt(mapRealRatingToDrillResult(rating), true);
				setOverrideOpen(false);
				showToast("Counted as a real review.", "info");
				return;
			}
			submitReviewMutation.mutate(
				{ cardId, rating },
				{
					onSuccess: () => {
						actions.recordAttempt(mapRealRatingToDrillResult(rating), true);
						setOverrideOpen(false);
						void queryClient.invalidateQueries({ queryKey: queryKeys.weakSpots.all() });
						showToast("Counted as a real review.", "info");
					},
					onError: (err) => {
						showToast(err.message ?? "Couldn't submit that review.", "error");
					},
				},
			);
		},
		[isActive, currentCard, isDev, actions, submitReviewMutation, queryClient, showToast],
	);

	const handleOpenOverride = useCallback(() => {
		if (!isActive || !showAnswer || overrideBusy)
			return;
		setOverrideOpen(true);
	}, [isActive, showAnswer, overrideBusy]);

	const handleCancelOverride = useCallback(() => {
		if (overrideBusy)
			return;
		setOverrideOpen(false);
	}, [overrideBusy]);

	// Collapse the override panel automatically whenever a new card surfaces
	// so a held-open state from card N doesn't carry into card N+1.
	useEffect(() => {
		setOverrideOpen(false); // eslint-disable-line react/set-state-in-effect -- collapses the override panel when a new card surfaces
	}, [currentIndex]);

	return { overrideOpen, overrideBusy, handleSubmitAsReview, handleOpenOverride, handleCancelOverride };
}
