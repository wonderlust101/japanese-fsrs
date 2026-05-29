import type { SessionSummary } from "@fsrs-japanese/shared-types";

import { describe, expect, it } from "vitest";

import { makeSessionSummary } from "@/test/factories";
import { buildSummaryContent, classifySession, inputsFromSummary } from "../summary-pattern";

function summaryWithWeakSpots(count: number, overrides: Partial<SessionSummary> = {}): SessionSummary {
	return makeSessionSummary({
		...overrides,
		weakSpots: Array.from({ length: count }, (_, i) => ({
			weakSpotId: `ws-${i}`,
			cardId: `card-${i}`,
			deckId: "deck-1",
			word: `言葉${i}`,
			reading: null,
			diagnosis: null,
			prescription: null,
			resolved: false,
			createdAt: "2026-05-27T00:00:00.000Z",
		})),
	});
}

describe("classifySession (re-exported)", () => {
	it("strong: 90%+ accuracy, no weak spots, no again", () => {
		expect(classifySession({
			totalCards: 10,
			accuracyPct: 95,
			again: 0,
			hard: 0,
			good: 5,
			easy: 5,
			weakSpotCount: 0,
			endedEarly: false,
		})).toBe("strong");
	});

	it("no-pattern when totalCards < 5", () => {
		expect(classifySession({
			totalCards: 3,
			accuracyPct: 100,
			again: 0,
			hard: 0,
			good: 3,
			easy: 0,
			weakSpotCount: 0,
			endedEarly: false,
		})).toBe("no-pattern");
	});

	it("ended-early supersedes all other inputs (after the no-pattern guard)", () => {
		expect(classifySession({
			totalCards: 30,
			accuracyPct: 100,
			again: 0,
			hard: 0,
			good: 30,
			easy: 0,
			weakSpotCount: 0,
			endedEarly: true,
		})).toBe("ended-early");
	});

	it("weakSpot wins over difficult when weakSpotCount >= 3", () => {
		expect(classifySession({
			totalCards: 20,
			accuracyPct: 50, // also matches difficult
			again: 5,
			hard: 5,
			good: 10,
			easy: 0,
			weakSpotCount: 4,
			endedEarly: false,
		})).toBe("weakSpot");
	});

	it("difficult when accuracy < 65; mixed when accuracy in [65, 90) with no weak spots", () => {
		expect(classifySession({
			totalCards: 20,
			accuracyPct: 60,
			again: 4,
			hard: 4,
			good: 12,
			easy: 0,
			weakSpotCount: 0,
			endedEarly: false,
		})).toBe("difficult");

		expect(classifySession({
			totalCards: 20,
			accuracyPct: 80,
			again: 1,
			hard: 1,
			good: 10,
			easy: 8,
			weakSpotCount: 0,
			endedEarly: false,
		})).toBe("mixed");
	});
});

describe("inputsFromSummary", () => {
	it("copies the rating breakdown + weakSpot count, threading the endedEarly flag", () => {
		const summary = summaryWithWeakSpots(2, {
			totalCards: 12,
			accuracyPct: 91,
			ratingBreakdown: { again: 0, hard: 2, good: 8, easy: 2 },
		});
		const inputs = inputsFromSummary(summary, true);
		expect(inputs).toEqual({
			totalCards: 12,
			accuracyPct: 91,
			again: 0,
			hard: 2,
			good: 8,
			easy: 2,
			weakSpotCount: 2,
			endedEarly: true,
		});
	});
});

describe("buildSummaryContent — per-pattern content + routing", () => {
	it("strong → 'Leave for today' primary, no problem cards, no secondary", () => {
		const summary = makeSessionSummary({
			totalCards: 10,
			accuracyPct: 95,
			ratingBreakdown: { again: 0, hard: 0, good: 8, easy: 2 },
			weakSpots: [],
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("strong");
		expect(content.primary.route.kind).toBe("today");
		expect(content.secondary).toBeUndefined();
		expect(content.showWeakSpots).toBe(false);
		expect(content.showTomorrowGlance).toBe(true);
	});

	it("mixed (no weak spots) → primary leaves for today, no secondary", () => {
		const summary = makeSessionSummary({
			totalCards: 20,
			accuracyPct: 80,
			ratingBreakdown: { again: 1, hard: 1, good: 14, easy: 4 },
			weakSpots: [],
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("mixed");
		expect(content.primary.route.kind).toBe("today");
		expect(content.secondary).toBeUndefined();
		expect(content.diagnosisAside).toBeNull();
	});

	it("difficult with weak-spot ids → primary review-weak-spots route carries the ids", () => {
		const summary = summaryWithWeakSpots(1, {
			totalCards: 20,
			accuracyPct: 50,
			ratingBreakdown: { again: 6, hard: 4, good: 10, easy: 0 },
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("difficult");
		if (content.primary.route.kind !== "review-weak-spots")
			throw new Error("expected review-weak-spots route");
		expect(content.primary.route.cardIds).toEqual(["card-0"]);
		expect(content.secondary?.route.kind).toBe("today");
	});

	it("difficult with empty weak-spot ids falls back to insights route", () => {
		const summary = makeSessionSummary({
			totalCards: 20,
			accuracyPct: 50,
			ratingBreakdown: { again: 6, hard: 4, good: 10, easy: 0 },
			weakSpots: [],
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("difficult");
		expect(content.primary.route.kind).toBe("insights");
	});

	it("weakSpot → primary repair, secondary today, showWeakSpots true", () => {
		const summary = summaryWithWeakSpots(4, {
			totalCards: 20,
			accuracyPct: 75,
			ratingBreakdown: { again: 2, hard: 3, good: 15, easy: 0 },
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("weakSpot");
		expect(content.primary.route.kind).toBe("repair");
		expect(content.secondary?.route.kind).toBe("today");
		expect(content.showWeakSpots).toBe(true);
		expect(content.showTomorrowGlance).toBe(true);
	});

	it("ended-early with no weak spots: no secondary, today primary", () => {
		const summary = makeSessionSummary({
			totalCards: 30,
			accuracyPct: 100,
			ratingBreakdown: { again: 0, hard: 0, good: 30, easy: 0 },
			weakSpots: [],
		});
		const content = buildSummaryContent(summary, true);
		expect(content.pattern).toBe("ended-early");
		expect(content.primary.route.kind).toBe("today");
		expect(content.secondary).toBeUndefined();
	});

	it("ended-early with weak spots adds a 'Improve weak spots' secondary action", () => {
		const summary = summaryWithWeakSpots(1, {
			totalCards: 30,
			accuracyPct: 100,
			ratingBreakdown: { again: 0, hard: 0, good: 30, easy: 0 },
		});
		const content = buildSummaryContent(summary, true);
		expect(content.pattern).toBe("ended-early");
		expect(content.secondary?.route.kind).toBe("repair");
	});

	it("no-pattern → 'Short and sweet' kicker, no tomorrow glance, no secondary", () => {
		const summary = makeSessionSummary({
			totalCards: 3,
			accuracyPct: 100,
			ratingBreakdown: { again: 0, hard: 0, good: 3, easy: 0 },
			weakSpots: [],
		});
		const content = buildSummaryContent(summary, false);
		expect(content.pattern).toBe("no-pattern");
		expect(content.primary.route.kind).toBe("today");
		expect(content.secondary).toBeUndefined();
		expect(content.showTomorrowGlance).toBe(false);
	});
});

describe("buildSummaryContent — formatTokens via diagnosisAside", () => {
	function asideForTokens(count: number): string | null {
		const summary = summaryWithWeakSpots(count, {
			totalCards: 20,
			accuracyPct: 80,
			ratingBreakdown: { again: 1, hard: 1, good: 14, easy: 4 },
		});
		return buildSummaryContent(summary, false).diagnosisAside;
	}

	it("0 tokens → null aside", () => {
		expect(asideForTokens(0)).toBeNull();
	});

	it("1 token → 'X showed up …'", () => {
		const out = asideForTokens(1);
		expect(out).toBe("言葉0 showed up in repeated misses.");
	});

	it("2 tokens → 'X and Y showed up …'", () => {
		const out = asideForTokens(2);
		expect(out).toBe("言葉0 and 言葉1 showed up in repeated misses.");
	});

	it("3+ tokens → Oxford comma joining (caps at 3)", () => {
		// 5 weak spots, but formatTokens is fed slice(0, 3).
		const out = asideForTokens(5);
		expect(out).toBe("言葉0, 言葉1, and 言葉2 showed up in repeated misses.");
	});
});
