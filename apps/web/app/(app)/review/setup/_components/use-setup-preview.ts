"use client";

import type { ApiDeck, ApiDueCard } from "@fsrs-japanese/shared-types";
import type { buildPreviewSnapshot } from "./setup-preview-data";
import type { QueueBreakdown } from "@/lib/review/queue-classify";

import type { SessionTuning } from "@/stores/useSessionTuningStore";

import { useMemo, useRef } from "react";

import { estimateSessionSeconds, formatSessionEstimate } from "@/lib/review/estimate-time";
import { countQueueBreakdown } from "@/lib/review/queue-classify";
import { randomSeed } from "@/lib/runtime";

import { filterCardsForSession } from "./setup-session-filter";

type PreviewSnapshot = ReturnType<typeof buildPreviewSnapshot>;

/**
 * The review-setup filter preview: applies the live tuning to the due queue and
 * projects the resulting session (cards, breakdown, total, time estimate). When
 * the dev preview snapshot is active it short-circuits to the snapshot's shape
 * instead of filtering live data.
 *
 * The shuffle seed is stable per mount (a ref), so toggling an unrelated tuning
 * (e.g. session size) doesn't re-randomize the shuffled order on every recompute.
 * Extracted from `setup-client.tsx`.
 */
export function useSetupPreview({ dueItems, tuning, allDecks, initialTodayKey, initialTimeZone, previewSnapshot }: {
	dueItems: ReadonlyArray<ApiDueCard>;
	tuning: SessionTuning;
	allDecks: ReadonlyArray<ApiDeck>;
	initialTodayKey: string;
	initialTimeZone: string;
	previewSnapshot: PreviewSnapshot | null;
}): {
	previewCards: ApiDueCard[];
	previewBreakdown: QueueBreakdown;
	previewTotal: number;
	timeEstimate: ReturnType<typeof formatSessionEstimate>;
} {
	const shuffleSeedRef = useRef<number>(randomSeed());

	const previewCards = useMemo<ApiDueCard[]>(() => {
		if (previewSnapshot !== null)
			return [];
		return filterCardsForSession(dueItems, tuning, {
			todayKey: initialTodayKey,
			timeZone: initialTimeZone,
			decks: allDecks,
			shuffleSeed: shuffleSeedRef.current,
		});
	}, [dueItems, tuning, initialTodayKey, initialTimeZone, allDecks, previewSnapshot]);

	const previewBreakdown: QueueBreakdown = useMemo(() => {
		if (previewSnapshot !== null)
			return previewSnapshot.breakdown;
		return countQueueBreakdown(previewCards, initialTodayKey, initialTimeZone);
	}, [previewCards, initialTodayKey, initialTimeZone, previewSnapshot]);

	const previewTotal = previewBreakdown.reviewCount + previewBreakdown.newCount + previewBreakdown.backlogCount;

	const timeEstimate = useMemo(() => {
		if (previewSnapshot !== null) {
			const secs
				= previewBreakdown.reviewCount * 15
					+ previewBreakdown.newCount * 25
					+ previewBreakdown.backlogCount * 15;
			return formatSessionEstimate(secs);
		}
		return formatSessionEstimate(estimateSessionSeconds(previewCards));
	}, [previewSnapshot, previewBreakdown, previewCards]);

	return { previewCards, previewBreakdown, previewTotal, timeEstimate };
}
