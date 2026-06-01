import { beforeEach, describe, expect, it, mock } from "bun:test";

// Hand-rolled redis stub (same seam review.service.test.ts mocks). Replacing
// the whole module means profile-cache never loads the real Upstash client or
// the circuit breaker — the cache logic is exercised in isolation.
const store = new Map<string, string>();
let getImpl: (key: string) => Promise<unknown>;
let delCalls: string[];

mock.module("../../db/redis.ts", () => ({
	redis: {
		get: (key: string) => getImpl(key),
		set: async (key: string, value: string) => {
			store.set(key, value);
		},
		del: async (key: string) => {
			delCalls.push(key);
			store.delete(key);
		},
	},
}));

const { readProfileCache, writeProfileCache, invalidateProfileCache } = await import("../profile-cache.ts");

// Minimal valid Profile (shape required by the cache's `id` invariant; the rest
// rides through the loose schema untouched). Cast via the write signature so we
// don't need to import the shared type here.
const PROFILE = {
	id: "u1",
	nativeLanguage: "en",
	jlptTarget: "N3",
	studyGoal: null,
	interests: [],
	dailyNewCardsLimit: 20,
	dailyReviewLimit: 200,
	retentionTarget: 0.9,
	timezone: "Asia/Tokyo",
	version: 1,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
} as unknown as Parameters<typeof writeProfileCache>[1];

beforeEach(() => {
	store.clear();
	delCalls = [];
	getImpl = async (key: string) => store.get(key) ?? null;
});

describe("profile-cache", () => {
	it("round-trips a written profile", async () => {
		await writeProfileCache("u1", PROFILE);
		expect(await readProfileCache("u1")).toEqual(PROFILE);
	});

	it("returns null on a miss", async () => {
		expect(await readProfileCache("nobody")).toBeNull();
	});

	it("treats a corrupt entry as a miss and best-effort deletes it", async () => {
		// No `id` → fails the cache's minimal shape invariant.
		store.set("profile:v1:u1", JSON.stringify({ notId: true }));

		expect(await readProfileCache("u1")).toBeNull();
		expect(delCalls).toContain("profile:v1:u1");
	});

	it("fails open (returns null) when redis.get throws", async () => {
		getImpl = async () => {
			throw new Error("redis down");
		};

		expect(await readProfileCache("u1")).toBeNull();
	});

	it("invalidate removes the entry", async () => {
		await writeProfileCache("u1", PROFILE);
		await invalidateProfileCache("u1");

		expect(await readProfileCache("u1")).toBeNull();
	});
});
