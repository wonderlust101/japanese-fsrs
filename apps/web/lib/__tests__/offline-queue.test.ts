import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MAX_ATTEMPTS, offlineQueue } from "../offline-queue";

// Hoisted shared state so the `vi.mock` factory below can safely reference
// it — Vitest moves `vi.mock` calls to the top of the file, but variables
// inside `vi.hoisted` are also hoisted, keeping the factory deterministic.
const { uuidQueue } = vi.hoisted(() => ({ uuidQueue: [] as string[] }));

vi.mock("@/lib/random-uuid", () => ({
	// Fallback is a real RFC-4122 v4 UUID so `QueuedReviewSchema.idempotencyKey:
	// z.string().uuid()` accepts it. A short string like "fallback-uuid" silently
	// fails Zod, `readQueue()` returns [], and every assertion that depends on
	// state surviving a round-trip through Zod breaks downstream.
	randomUUID: vi.fn(() => uuidQueue.shift() ?? "00000000-0000-4000-8000-00000000fff0"),
}));

const KEY = "fsrs_offline_review_queue";
const BATCH_KEY_STORAGE = "fsrs_offline_review_batch_key";
const ATTEMPTS_STORAGE = "fsrs_offline_review_attempts";

// Real RFC-4122 v4 UUIDs (version=4 at digit 13, variant=8/9/a/b at digit 17).
// `11111111-1111-1111-1111-111111111111` looks UUID-shaped but fails Zod's
// `z.string().uuid()` on the variant nibble, causing `QueuedReviewSchema` to
// reject every entry and `readQueue()` to return `[]` — silent and miserable.
const VALID_CARD_ID = "11111111-1111-4111-8111-111111111111";
const SECOND_CARD_ID = "22222222-2222-4222-8222-222222222222";

// Synthetic but RFC-4122-valid v4 UUIDs for deterministic id assertions.
// The schema validates `idempotencyKey: z.string().uuid()` so plain strings
// like IDEM_1 would be rejected and the queue would behave as if empty.
const IDEM_1 = "00000000-0000-4000-8000-000000000001";
const IDEM_2 = "00000000-0000-4000-8000-000000000002";
const BATCH_1 = "00000000-0000-4000-8000-0000000000b1";
const BATCH_X = "00000000-0000-4000-8000-0000000000bf";

beforeEach(() => {
	localStorage.clear();
	uuidQueue.length = 0;
});

afterEach(() => {
	localStorage.clear();
});

describe("offlineQueue", () => {
	describe("add", () => {
		it("appends an entry with stamped queuedAt + idempotencyKey", () => {
			uuidQueue.push(IDEM_1);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good", reviewTimeMs: 4000 });

			const raw = localStorage.getItem(KEY);
			expect(raw).not.toBeNull();
			const parsed = JSON.parse(raw as string);
			expect(parsed).toHaveLength(1);
			expect(parsed[0].cardId).toBe(VALID_CARD_ID);
			expect(parsed[0].rating).toBe("good");
			expect(parsed[0].idempotencyKey).toBe(IDEM_1);
			expect(typeof parsed[0].queuedAt).toBe("number");
		});

		it("preserves order across multiple adds", () => {
			uuidQueue.push(IDEM_1, IDEM_2);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "again" });
			offlineQueue.add({ cardId: SECOND_CARD_ID, rating: "hard" });
			expect(offlineQueue.size()).toBe(2);
			const parsed = JSON.parse(localStorage.getItem(KEY) as string);
			expect(parsed[0].rating).toBe("again");
			expect(parsed[1].rating).toBe("hard");
		});
	});

	describe("drainBatch", () => {
		it("returns the queued reviews and a fresh batch key, then empties the queue", () => {
			uuidQueue.push(IDEM_1, BATCH_1);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });

			const { reviews, batchKey } = offlineQueue.drainBatch();

			expect(reviews).toHaveLength(1);
			expect(batchKey).toBe(BATCH_1);
			expect(localStorage.getItem(KEY)).toBeNull();
			expect(localStorage.getItem(BATCH_KEY_STORAGE)).toBe(BATCH_1);
		});

		it("returns empty + empty batch key when queue is empty (does not allocate)", () => {
			const result = offlineQueue.drainBatch();
			expect(result.reviews).toEqual([]);
			expect(result.batchKey).toBe("");
			expect(localStorage.getItem(BATCH_KEY_STORAGE)).toBeNull();
		});

		it("reuses a previously-held batch key on subsequent drains", () => {
			uuidQueue.push(IDEM_1, BATCH_1, IDEM_2);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });
			const { batchKey: firstKey, reviews: firstReviews } = offlineQueue.drainBatch();

			// Simulate failure: re-queue the same reviews, then drain again.
			offlineQueue.replayBatch(firstReviews);
			const { batchKey: secondKey } = offlineQueue.drainBatch();

			expect(secondKey).toBe(firstKey);
			// The mocked randomUUID should NOT have been consumed for a second batch.
			expect(uuidQueue).toHaveLength(1); // idem-2 still unused
		});
	});

	describe("confirmBatch", () => {
		it("clears the held batch key and attempts counter", () => {
			localStorage.setItem(BATCH_KEY_STORAGE, BATCH_1);
			localStorage.setItem(ATTEMPTS_STORAGE, "3");
			offlineQueue.confirmBatch();
			expect(localStorage.getItem(BATCH_KEY_STORAGE)).toBeNull();
			expect(localStorage.getItem(ATTEMPTS_STORAGE)).toBeNull();
		});
	});

	describe("replayBatch / recordFailure / resetAttempts", () => {
		it("replayBatch restores the queue contents without changing the batch key", () => {
			uuidQueue.push(IDEM_1, BATCH_1);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });
			const { reviews } = offlineQueue.drainBatch();

			expect(localStorage.getItem(KEY)).toBeNull();
			offlineQueue.replayBatch(reviews);
			const parsed = JSON.parse(localStorage.getItem(KEY) as string);
			expect(parsed).toHaveLength(1);
			expect(parsed[0].idempotencyKey).toBe(IDEM_1);
			// batch key is preserved across replay
			expect(localStorage.getItem(BATCH_KEY_STORAGE)).toBe(BATCH_1);
		});

		it("recordFailure increments and returns the new attempt count", () => {
			expect(offlineQueue.recordFailure()).toBe(1);
			expect(offlineQueue.recordFailure()).toBe(2);
			expect(offlineQueue.attempts()).toBe(2);
		});

		it("resetAttempts wipes the counter without touching queue / batch key", () => {
			uuidQueue.push(IDEM_1);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });
			offlineQueue.recordFailure();
			offlineQueue.recordFailure();
			expect(offlineQueue.attempts()).toBe(2);

			offlineQueue.resetAttempts();
			expect(offlineQueue.attempts()).toBe(0);
			expect(offlineQueue.size()).toBe(1);
		});
	});

	describe("isStuck / MAX_ATTEMPTS boundary", () => {
		it("returns false below MAX_ATTEMPTS and true at the threshold", () => {
			for (let i = 0; i < MAX_ATTEMPTS - 1; i += 1) {
				offlineQueue.recordFailure();
			}
			expect(offlineQueue.isStuck()).toBe(false);
			offlineQueue.recordFailure(); // hit the threshold
			expect(offlineQueue.attempts()).toBe(MAX_ATTEMPTS);
			expect(offlineQueue.isStuck()).toBe(true);
		});
	});

	describe("clear", () => {
		it("wipes queue, batch key, and attempts", () => {
			uuidQueue.push(IDEM_1);
			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });
			localStorage.setItem(BATCH_KEY_STORAGE, BATCH_X);
			localStorage.setItem(ATTEMPTS_STORAGE, "2");
			offlineQueue.clear();
			expect(offlineQueue.size()).toBe(0);
			expect(localStorage.getItem(BATCH_KEY_STORAGE)).toBeNull();
			expect(localStorage.getItem(ATTEMPTS_STORAGE)).toBeNull();
		});
	});

	describe("malformed localStorage tolerance", () => {
		it("readQueue returns [] when stored JSON is not an array of valid entries", () => {
			localStorage.setItem(KEY, "not-json");
			expect(offlineQueue.size()).toBe(0);

			localStorage.setItem(KEY, JSON.stringify({ foo: "bar" }));
			expect(offlineQueue.size()).toBe(0);

			// Array of partial entries (missing idempotencyKey, queuedAt) is rejected.
			localStorage.setItem(KEY, JSON.stringify([{ cardId: VALID_CARD_ID, rating: "good" }]));
			expect(offlineQueue.size()).toBe(0);
		});

		it("readAttempts returns 0 when the stored value is non-numeric or negative", () => {
			localStorage.setItem(ATTEMPTS_STORAGE, "not-a-number");
			expect(offlineQueue.attempts()).toBe(0);
			localStorage.setItem(ATTEMPTS_STORAGE, "-1");
			expect(offlineQueue.attempts()).toBe(0);
		});
	});

	describe("subscribe", () => {
		it("notifies subscribers on same-tab writes and unsubscribe stops further fires", () => {
			uuidQueue.push(IDEM_1, IDEM_2);
			const listener = vi.fn();
			const unsubscribe = offlineQueue.subscribe(listener);

			offlineQueue.add({ cardId: VALID_CARD_ID, rating: "good" });
			expect(listener).toHaveBeenCalledTimes(1);

			unsubscribe();
			offlineQueue.add({ cardId: SECOND_CARD_ID, rating: "again" });
			expect(listener).toHaveBeenCalledTimes(1);
		});

		it("fires on cross-tab storage events for the queue's keys, ignores unrelated keys", () => {
			const listener = vi.fn();
			const unsubscribe = offlineQueue.subscribe(listener);

			try {
				window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
				window.dispatchEvent(new StorageEvent("storage", { key: BATCH_KEY_STORAGE }));
				window.dispatchEvent(new StorageEvent("storage", { key: ATTEMPTS_STORAGE }));
				expect(listener).toHaveBeenCalledTimes(3);

				window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
				expect(listener).toHaveBeenCalledTimes(3);
			} finally {
				unsubscribe();
			}
		});
	});
});
