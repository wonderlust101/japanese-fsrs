import type { ApiDueCard } from "@fsrs-japanese/shared-types";

import { describe, expect, it } from "vitest";

import { makeDueCard } from "@/test/factories";
import {
	estimateSessionFromCounts,
	estimateSessionSeconds,
	estimateSessionTime,
	formatSessionEstimate,
} from "../estimate-time";
import {
	classifyCard,
	countQueueBreakdown,
	EMPTY_BREAKDOWN,
	priorityForKind,
	totalFromBreakdown,
} from "../queue-classify";

const TIME_ZONE = "UTC";

// ── classifyCard ────────────────────────────────────────────────────────────

describe("classifyCard", () => {
	it("returns 'new' when state === 0 regardless of due date", () => {
		const card = makeDueCard({ state: 0, due: "2026-04-01T00:00:00.000Z" });
		expect(classifyCard(card, "2026-05-27", TIME_ZONE)).toBe("new");
	});

	it("returns 'review' when due == today (state=2)", () => {
		const card = makeDueCard({ state: 2, due: "2026-05-27T00:00:00.000Z" });
		expect(classifyCard(card, "2026-05-27", TIME_ZONE)).toBe("review");
	});

	it("returns 'backlog' when dueKey < todayKey", () => {
		const card = makeDueCard({ state: 2, due: "2026-05-20T00:00:00.000Z" });
		expect(classifyCard(card, "2026-05-27", TIME_ZONE)).toBe("backlog");
	});

	it("falls back to 'review' when due is malformed and cannot parse", () => {
		// A malformed due that can't be parsed and is also not a YYYY-MM-DD shape
		// degrades to a slice — the comparator will not classify as backlog.
		const card = makeDueCard({ state: 2, due: "not-a-real-date" });
		expect(classifyCard(card, "2026-05-27", TIME_ZONE)).toBe("review");
	});
});

// ── countQueueBreakdown ─────────────────────────────────────────────────────

describe("countQueueBreakdown", () => {
	it("returns the zero-breakdown for empty input", () => {
		expect(countQueueBreakdown([], "2026-05-27", TIME_ZONE)).toEqual(EMPTY_BREAKDOWN);
	});

	it("tallies new / review / backlog correctly across a mixed batch", () => {
		const items: ApiDueCard[] = [
			makeDueCard({ id: "c1", state: 0 }), // new
			makeDueCard({ id: "c2", state: 0 }), // new
			makeDueCard({ id: "c3", state: 2, due: "2026-05-27T00:00:00.000Z" }), // review
			makeDueCard({ id: "c4", state: 2, due: "2026-05-26T00:00:00.000Z" }), // backlog
		];
		expect(countQueueBreakdown(items, "2026-05-27", TIME_ZONE)).toEqual({
			newCount: 2,
			reviewCount: 1,
			backlogCount: 1,
		});
	});

	it("totalFromBreakdown sums the three counts", () => {
		expect(totalFromBreakdown({ newCount: 3, reviewCount: 2, backlogCount: 1 })).toBe(6);
	});
});

// ── priorityForKind ─────────────────────────────────────────────────────────

describe("priorityForKind", () => {
	it("orders backlog (0) before review (1) before new (2)", () => {
		expect(priorityForKind("backlog")).toBe(0);
		expect(priorityForKind("review")).toBe(1);
		expect(priorityForKind("new")).toBe(2);
	});
});

// ── estimateSessionSeconds ──────────────────────────────────────────────────

describe("estimateSessionSeconds", () => {
	it("maps each FSRS state to its pace constant: 25/20/15/20", () => {
		// state values: 0=new (25), 1=learning (20), 2=review (15), 3=relearning (20)
		const cards: ApiDueCard[] = [
			makeDueCard({ state: 0 }), // 25
			makeDueCard({ state: 1 }), // 20
			makeDueCard({ state: 2 }), // 15
			makeDueCard({ state: 3 }), // 20
		];
		expect(estimateSessionSeconds(cards)).toBe(25 + 20 + 15 + 20);
	});

	it("returns 0 for an empty input", () => {
		expect(estimateSessionSeconds([])).toBe(0);
	});
});

// ── estimateSessionFromCounts ───────────────────────────────────────────────

describe("estimateSessionFromCounts", () => {
	it("uses 25s/new + 15s/review by default; learning/relearning omitted", () => {
		expect(estimateSessionFromCounts({ newCount: 4, reviewCount: 10 })).toBe(4 * 25 + 10 * 15);
	});

	it("includes learning and relearning when provided", () => {
		expect(estimateSessionFromCounts({
			newCount: 1,
			reviewCount: 1,
			learningCount: 1,
			relearningCount: 1,
		})).toBe(25 + 15 + 20 + 20);
	});
});

// ── formatSessionEstimate ───────────────────────────────────────────────────

describe("formatSessionEstimate boundaries", () => {
	it("0 seconds -> '0 min'", () => {
		expect(formatSessionEstimate(0)).toEqual({ totalSeconds: 0, label: "0 min" });
	});

	it("59 seconds -> 'under a minute'", () => {
		const r = formatSessionEstimate(59);
		expect(r.label).toBe("under a minute");
		expect(r.totalSeconds).toBe(59);
	});

	it("60 seconds -> '≈ 1 min'", () => {
		const r = formatSessionEstimate(60);
		expect(r.label).toBe("≈ 1 min");
	});

	it("150 seconds rounds to '≈ 3 min'", () => {
		const r = formatSessionEstimate(150);
		expect(r.label).toBe("≈ 3 min");
	});

	it("negative seconds clamp to 0", () => {
		expect(formatSessionEstimate(-30).label).toBe("0 min");
	});
});

// ── estimateSessionTime — integration ───────────────────────────────────────

describe("estimateSessionTime", () => {
	it("composes seconds + format", () => {
		const cards: ApiDueCard[] = [makeDueCard({ state: 0 }), makeDueCard({ state: 0 })]; // 50s
		const t = estimateSessionTime(cards);
		expect(t.label).toBe("under a minute");
		expect(t.totalSeconds).toBe(50);
	});
});
