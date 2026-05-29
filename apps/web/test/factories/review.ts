/**
 * Factory functions for review wire shapes.
 *
 * Covers:
 *   • `SubmitReviewInput` — the body of `POST /api/v1/reviews/submit`
 *   • `ApiReviewedCard` — the response body of the same endpoint and the
 *     row shape used in batch responses
 *   • `SessionSummary` — `GET /api/v1/reviews/session-summary/:sessionId`
 *   • `ApiRatingsPreview` — `GET /api/v1/reviews/:cardId/preview`
 *
 * Defaults reflect a healthy session: 10 cards, 80% accuracy, no weak
 * spots. Override individual fields to model edge cases.
 */

import type {
	ApiRatingsPreview,
	ApiReviewedCard,
	SessionSummary,
	SubmitReviewInput,
} from "@fsrs-japanese/shared-types";

import { State } from "@fsrs-japanese/shared-types";

// `State.Review` = 2 in the numeric ts-fsrs enum. See note in
// `factories/card.ts` on why this is surfaced as a const.
const STATE_REVIEW = State.Review;

export function makeSubmitReviewInput(overrides: Partial<SubmitReviewInput> = {}): SubmitReviewInput {
	const base: SubmitReviewInput = {
		cardId: "11111111-1111-1111-1111-111111111111",
		rating: "good",
		reviewTimeMs: 4200,
		sessionId: "55555555-5555-5555-5555-555555555555",
	};
	return { ...base, ...overrides };
}

/**
 * `ApiReviewedCard` is the per-card response shape. The historic factory
 * name `makeReviewLog` is kept for callers that talk about "review logs" —
 * structurally they're the same wire shape.
 */
export function makeReviewLog(overrides: Partial<ApiReviewedCard> = {}): ApiReviewedCard {
	const base: ApiReviewedCard = {
		id: "11111111-1111-1111-1111-111111111111",
		reviewLogId: "66666666-6666-6666-6666-666666666666",
		due: "2026-05-30T00:00:00.000Z",
		stability: 3.5,
		difficulty: 5.2,
		scheduledDays: 3,
		state: STATE_REVIEW,
	};
	return { ...base, ...overrides };
}

export function makeSessionSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
	const base: SessionSummary = {
		sessionId: "55555555-5555-5555-5555-555555555555",
		totalCards: 10,
		totalTimeMs: 95_000,
		accuracyPct: 80,
		nextDueAt: "2026-05-28T00:00:00.000Z",
		ratingBreakdown: {
			again: 1,
			hard: 1,
			good: 6,
			easy: 2,
		},
		weakSpots: [],
		userTotalSessions: 2,
		sessionsToday: 1,
	};
	return { ...base, ...overrides };
}

export function makeRatingsPreview(overrides: Partial<ApiRatingsPreview> = {}): ApiRatingsPreview {
	const base: ApiRatingsPreview = {
		again: { scheduledDays: 0, due: "2026-05-27T00:10:00.000Z" },
		hard: { scheduledDays: 1, due: "2026-05-28T00:00:00.000Z" },
		good: { scheduledDays: 3, due: "2026-05-30T00:00:00.000Z" },
		easy: { scheduledDays: 7, due: "2026-06-03T00:00:00.000Z" },
	};
	return { ...base, ...overrides };
}
