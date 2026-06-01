import type { ApiDueCard } from "@fsrs-japanese/shared-types";

import { afterEach, describe, expect, it } from "vitest";

import { useReviewSessionStore } from "../useReviewSessionStore";

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// We don't validate against ApiDueCardSchema here — the store treats cards as
// opaque payloads and only reads `.id`. Casting through `as ApiDueCard` is
// the documented pattern for the test tier (test-file ESLint override allows
// `no-explicit-any` and skips strict type-import enforcement).

function makeCard(id: string): ApiDueCard {
	return {
		id,
		deckId: "deck-1",
		jlptLevel: "N5",
		state: 0,
		due: "2026-05-27",
		fieldsData: { word: "", reading: "", meaning: "" },
		layoutType: "vocabulary",
	} as unknown as ApiDueCard;
}

const CARDS: ApiDueCard[] = [makeCard("c1"), makeCard("c2"), makeCard("c3")];

// `getState().actions` is stable across resets, so we can safely cache it.
const actions = useReviewSessionStore.getState().actions;

afterEach(() => {
	// Return to a clean `idle` state between every test. The store is a
	// module singleton — without this, history bleeds across cases and you
	// chase mysterious phantom transitions.
	actions.reset();
});

describe("useReviewSessionStore", () => {
	describe("initial state", () => {
		it("starts in the idle phase", () => {
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});

	describe("startSession", () => {
		it("transitions idle → active with queue, fresh sessionId, and zeroed cursor", () => {
			actions.startSession(CARDS);

			const s = useReviewSessionStore.getState();
			expect(s.phase).toBe("active");
			if (s.phase !== "active")
				return; // narrowing
			expect(s.queue).toHaveLength(3);
			expect(s.currentIndex).toBe(0);
			expect(s.showAnswer).toBe(false);
			expect(s.sessionHistory).toEqual([]);
			expect(typeof s.sessionId).toBe("string");
			expect(s.sessionId.length).toBeGreaterThan(0);
		});

		it("produces a unique sessionId per session", () => {
			actions.startSession(CARDS);
			const first = useReviewSessionStore.getState();
			const firstId = first.phase === "active" ? first.sessionId : null;

			actions.reset();
			actions.startSession(CARDS);
			const second = useReviewSessionStore.getState();
			const secondId = second.phase === "active" ? second.sessionId : null;

			expect(firstId).not.toBeNull();
			expect(secondId).not.toBeNull();
			expect(firstId).not.toBe(secondId);
		});
	});

	describe("flipCard", () => {
		it("sets showAnswer=true in active phase", () => {
			actions.startSession(CARDS);
			actions.flipCard();

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.showAnswer).toBe(true);
		});

		it("no-ops in idle", () => {
			actions.flipCard();
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});

	describe("submitRating", () => {
		it("appends to sessionHistory, advances index, resets showAnswer", () => {
			actions.startSession(CARDS);
			actions.flipCard();
			actions.submitRating("good");

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.currentIndex).toBe(1);
			expect(s.showAnswer).toBe(false);
			expect(s.sessionHistory).toHaveLength(1);
			expect(s.sessionHistory[0]?.card.id).toBe("c1");
			expect(s.sessionHistory[0]?.rating).toBe("good");
			expect(s.sessionHistory[0]?.reviewLogId).toBeUndefined();
		});

		it("no-ops when called past the end of the queue", () => {
			actions.startSession([makeCard("only")]);
			actions.submitRating("good"); // currentIndex → 1, equals queue.length

			const before = useReviewSessionStore.getState();
			const beforeHistoryLen = before.phase === "active" ? before.sessionHistory.length : -1;

			actions.submitRating("again"); // past end → no-op

			const after = useReviewSessionStore.getState();
			if (after.phase !== "active")
				throw new Error("expected active");
			expect(after.sessionHistory.length).toBe(beforeHistoryLen);
			expect(after.currentIndex).toBe(1);
		});

		it("no-ops in idle", () => {
			actions.submitRating("good");
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});

	describe("undoLastRating", () => {
		it("rewinds the cursor by one and restores showAnswer=true", () => {
			actions.startSession(CARDS);
			actions.flipCard();
			actions.submitRating("good");
			actions.submitRating("hard");

			actions.undoLastRating();

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.currentIndex).toBe(1);
			expect(s.showAnswer).toBe(true);
			expect(s.sessionHistory).toHaveLength(1);
			expect(s.sessionHistory[0]?.card.id).toBe("c1");
		});

		it("no-ops when sessionHistory is empty", () => {
			actions.startSession(CARDS);
			actions.undoLastRating();

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.currentIndex).toBe(0);
			expect(s.sessionHistory).toHaveLength(0);
		});

		it("no-ops when currentIndex is 0", () => {
			// Synthesizes a state where history has an entry but cursor is already
			// at zero — defensive: never observed in practice but the guard exists.
			actions.startSession(CARDS);
			useReviewSessionStore.setState({
				phase: "active",
				sessionId: "sid",
				queue: CARDS,
				currentIndex: 0,
				showAnswer: false,
				sessionHistory: [{ card: CARDS[0]!, rating: "good" }],
				actions,
			}, true);

			actions.undoLastRating();

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.currentIndex).toBe(0);
			expect(s.sessionHistory).toHaveLength(1);
		});

		it("no-ops in idle/finished", () => {
			actions.undoLastRating();
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});

	describe("attachReviewLogId", () => {
		it("patches the most recent entry for the given cardId", () => {
			actions.startSession(CARDS);
			actions.submitRating("good"); // c1
			actions.submitRating("hard"); // c2

			actions.attachReviewLogId("c2", "rl-c2");

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.sessionHistory[1]?.reviewLogId).toBe("rl-c2");
			expect(s.sessionHistory[0]?.reviewLogId).toBeUndefined();
		});

		it("uses tail-search: when a card is rated twice, patches the latest null entry", () => {
			// Force a state with two entries for the same card; the second is
			// still pending. The tail walk MUST patch index 1, not index 0.
			useReviewSessionStore.setState({
				phase: "active",
				sessionId: "sid",
				queue: CARDS,
				currentIndex: 2,
				showAnswer: false,
				sessionHistory: [
					{ card: CARDS[0]!, rating: "good", reviewLogId: "rl-old" },
					{ card: CARDS[0]!, rating: "again" }, // still pending
				],
				actions,
			}, true);

			actions.attachReviewLogId("c1", "rl-new");

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.sessionHistory[0]?.reviewLogId).toBe("rl-old");
			expect(s.sessionHistory[1]?.reviewLogId).toBe("rl-new");
		});

		it("is a no-op when no matching null entry exists (already attached)", () => {
			actions.startSession(CARDS);
			actions.submitRating("good");
			actions.attachReviewLogId("c1", "rl-1");

			// Second attach should be ignored — entry already has a reviewLogId.
			actions.attachReviewLogId("c1", "rl-1-DUPLICATE");

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.sessionHistory[0]?.reviewLogId).toBe("rl-1");
		});

		it("works in finished phase too (summary page may attach late)", () => {
			actions.startSession([CARDS[0]!]);
			actions.submitRating("good");
			actions.endSession();

			actions.attachReviewLogId("c1", "rl-late");

			const s = useReviewSessionStore.getState();
			if (s.phase !== "finished")
				throw new Error("expected finished");
			expect(s.sessionHistory[0]?.reviewLogId).toBe("rl-late");
		});
	});

	describe("attachReviewTimeMs", () => {
		it("patches the most recent entry for the given cardId", () => {
			actions.startSession(CARDS);
			actions.submitRating("good"); // c1
			actions.submitRating("hard"); // c2

			actions.attachReviewTimeMs("c2", 4200);

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.sessionHistory[1]?.reviewTimeMs).toBe(4200);
			expect(s.sessionHistory[0]?.reviewTimeMs).toBeUndefined();
		});

		it("is a no-op when the matching entry already has a time recorded", () => {
			actions.startSession(CARDS);
			actions.submitRating("good");
			actions.attachReviewTimeMs("c1", 1000);
			actions.attachReviewTimeMs("c1", 9999); // ignored — already timed

			const s = useReviewSessionStore.getState();
			if (s.phase !== "active")
				throw new Error("expected active");
			expect(s.sessionHistory[0]?.reviewTimeMs).toBe(1000);
		});
	});

	describe("endSession", () => {
		it("transitions active → finished and preserves sessionId + history", () => {
			actions.startSession(CARDS);
			actions.submitRating("good");
			const activeBefore = useReviewSessionStore.getState();
			const sidBefore = activeBefore.phase === "active" ? activeBefore.sessionId : null;

			actions.endSession();

			const s = useReviewSessionStore.getState();
			expect(s.phase).toBe("finished");
			if (s.phase !== "finished")
				return;
			expect(s.sessionId).toBe(sidBefore);
			expect(s.sessionHistory).toHaveLength(1);
		});

		it("no-ops in idle", () => {
			actions.endSession();
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});

	describe("reset", () => {
		it("returns from active to idle", () => {
			actions.startSession(CARDS);
			actions.reset();
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});

		it("returns from finished to idle", () => {
			actions.startSession([CARDS[0]!]);
			actions.submitRating("good");
			actions.endSession();
			actions.reset();
			expect(useReviewSessionStore.getState().phase).toBe("idle");
		});
	});
});
