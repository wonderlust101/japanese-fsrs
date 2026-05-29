// Session-pattern classifier shared by the frontend's `summary-pattern.ts`
// (which maps patterns to UI prose) and the backend's
// `day-reflection.service.ts` (which uses the pattern to pick fallback
// prose when the AI generator is unavailable). Lifted from the frontend
// in the audit-remediation pass so the two consumers can't drift.
//
// The function is pure: inputs → pattern label. The per-pattern prose
// mapping stays in each consumer's own file because the frontend's UI
// copy and the backend's fallback copy are allowed to diverge (e.g. the
// frontend can pick longer prose for a richer card; the backend stays
// terse for cache efficiency).

export type SessionPattern
	= | "strong"
		| "mixed"
		| "difficult"
		| "weakSpot"
		| "ended-early"
		| "no-pattern";

export interface PatternInputs {
	totalCards: number;
	accuracyPct: number;
	again: number;
	hard: number;
	good: number;
	easy: number;
	weakSpotCount: number;
	endedEarly: boolean;
}

// Threshold constants. Exported so consumers can reference the same
// numbers in copy ("8 or more lapses…") without duplicating literals.
export const NO_PATTERN_MIN_CARDS = 5;
export const WEAK_SPOT_MIN_COUNT = 3;
export const DIFFICULT_MAX_ACCURACY = 65;
export const DIFFICULT_MAX_AGAIN_RATIO = 0.25;
export const STRONG_MIN_ACCURACY = 90;

/**
 * Ordered most-specific-first; first matching predicate wins. The order
 * matters: a session with 4 weak spots AND 60% accuracy lands in
 * 'weakSpot' (not 'difficult') because the weak-spot signal is the more
 * actionable read.
 */
export function classifySession(i: PatternInputs): SessionPattern {
	if (i.totalCards < NO_PATTERN_MIN_CARDS)
		return "no-pattern";
	if (i.endedEarly)
		return "ended-early";
	if (i.weakSpotCount >= WEAK_SPOT_MIN_COUNT)
		return "weakSpot";
	if (i.accuracyPct < DIFFICULT_MAX_ACCURACY)
		return "difficult";
	if (i.totalCards > 0 && i.again / i.totalCards > DIFFICULT_MAX_AGAIN_RATIO)
		return "difficult";
	if (
		i.accuracyPct >= STRONG_MIN_ACCURACY
		&& i.weakSpotCount === 0
		&& i.again === 0
	) {
		return "strong";
	}
	return "mixed";
}
