import type { ApiDueCard } from "@fsrs-japanese/shared-types";

// FSRS state values: 0=new, 1=learning, 2=review, 3=relearning.
// Pace targets (seconds per card), per product direction:
//   new          25s  (more time to absorb fresh material)
//   relearning   20s  (just lapsed; learner needs a moment)
//   learning     20s  (in the gentle reintroduction window)
//   review       15s  (normal recall pace)
//
// These are coarse averages. The label rounds to whole minutes and uses
// "≈" framing so the estimate reads as honest fuzziness, not false precision.

const SECS_NEW = 25;
const SECS_LEARNING = 20;
const SECS_RELEARNING = 20;
const SECS_REVIEW = 15;

const FSRS_NEW = 0;
const FSRS_LEARNING = 1;
const FSRS_RELEARNING = 3;

export interface TimeEstimate {
	totalSeconds: number;
	label: string; // human-readable, e.g. "≈ 18 min"
}

export function estimateSessionSeconds(cards: ReadonlyArray<ApiDueCard>): number {
	let secs = 0;
	for (const c of cards) {
		if (c.state === FSRS_NEW)
			secs += SECS_NEW;
		else if (c.state === FSRS_LEARNING)
			secs += SECS_LEARNING;
		else if (c.state === FSRS_RELEARNING)
			secs += SECS_RELEARNING;
		else secs += SECS_REVIEW;
	}
	return secs;
}

export function estimateSessionFromCounts(counts: {
	newCount: number;
	reviewCount: number;
	learningCount?: number;
	relearningCount?: number;
}): number {
	return (
		counts.newCount * SECS_NEW
		+ counts.reviewCount * SECS_REVIEW
		+ (counts.learningCount ?? 0) * SECS_LEARNING
		+ (counts.relearningCount ?? 0) * SECS_RELEARNING
	);
}

export function formatSessionEstimate(totalSeconds: number): TimeEstimate {
	if (totalSeconds <= 0)
		return { totalSeconds: 0, label: "0 min" };
	if (totalSeconds < 60)
		return { totalSeconds, label: "under a minute" };
	const minutes = Math.max(1, Math.round(totalSeconds / 60));
	return { totalSeconds, label: `≈ ${minutes} min` };
}

export function estimateSessionTime(cards: ReadonlyArray<ApiDueCard>): TimeEstimate {
	return formatSessionEstimate(estimateSessionSeconds(cards));
}
