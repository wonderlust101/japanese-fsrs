import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createSupabaseHarness } from "../../../tests/support";
import { AppError } from "../../middleware/errorHandler.ts";

// getDayReflection loads a profile + the day-aggregate RPC, then asks the AI
// generator for prose with a rule-based fallback. The profile now comes from
// profile.service.getProfileCached (mocked here so the unit test is decoupled
// from the profile-fetch internals + Redis); Supabase backs the aggregate RPC,
// and ai.service is mocked so every outcome — profile 404, session 404,
// aggregate 500, AI success, AI-failure fallback — is deterministic.
const sb = createSupabaseHarness();
mock.module("../../db/supabase.ts", () => ({ supabaseAdmin: sb.supabaseAdmin }));

const aiState: { result: { body: string }; error: Error | null; calls: number } = { result: { body: "ai prose" }, error: null, calls: 0 };
mock.module("../ai.service.ts", () => ({
	generateDayReflection: async () => {
		aiState.calls += 1;
		if (aiState.error !== null)
			throw aiState.error;
		return aiState.result;
	},
}));

// Full camelCase Profile the (mocked) cached read returns. Mutable so a test can
// swap in a throwing impl for the missing-profile case without re-mocking.
const PROFILE = {
	id: "user-1",
	nativeLanguage: "en",
	jlptTarget: "N3" as const,
	studyGoal: null,
	interests: [] as string[],
	dailyNewCardsLimit: 20,
	dailyReviewLimit: 200,
	retentionTarget: 0.9,
	timezone: "Asia/Tokyo",
	version: 1,
	createdAt: "2026-01-01T00:00:00Z",
	updatedAt: "2026-01-01T00:00:00Z",
};
let getProfileCachedImpl: (userId: string) => Promise<typeof PROFILE>;
mock.module("../profile.service.ts", () => ({
	getProfileCached: (userId: string) => getProfileCachedImpl(userId),
}));

const { getDayReflection } = await import("../day-reflection.service.ts");

function aggregate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		date_key: "2026-05-29",
		session_ids: ["s1", "s2"],
		session_count: 2,
		total_cards: 20,
		total_time_ms: 120_000,
		breakdown: { again: 2, hard: 3, good: 10, easy: 5 },
		weak_spot_words: ["水", "火"],
		...overrides,
	};
}

beforeEach(() => {
	sb.reset();
	aiState.result = { body: "ai prose" };
	aiState.error = null;
	aiState.calls = 0;
	getProfileCachedImpl = async () => PROFILE;
});

describe("getDayReflection", () => {
	it("throws 404 when the profile is missing", async () => {
		getProfileCachedImpl = async () => {
			throw new AppError(404, "Profile not found", { code: "PROFILE_NOT_FOUND" });
		};

		await expect(getDayReflection("s1", "u1")).rejects.toThrow("Profile not found");
	});

	it("throws 404 when the session is not found", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: null, error: { code: "P0002", message: "session_not_found" } }];

		await expect(getDayReflection("missing", "u1")).rejects.toThrow("Session not found");
	});

	it("throws 500 on an unexpected aggregate error", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: null, error: { code: "XX000", message: "boom" } }];

		await expect(getDayReflection("s1", "u1")).rejects.toThrow("Failed to load day aggregate");
	});

	it("returns AI prose with source 'ai'", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		aiState.result = { body: "You stayed steady today." };

		const out = await getDayReflection("s1", "u1");

		expect(out).toEqual({ body: "You stayed steady today.", source: "ai", dateKey: "2026-05-29", sessionCount: 2 });
	});

	it("falls back to rule-based prose when the AI generator throws", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		aiState.error = new Error("openai down");

		const out = await getDayReflection("s1", "u1");

		expect(out.source).toBe("fallback");
		expect(typeof out.body).toBe("string");
		expect(out.body.length).toBeGreaterThan(0);
		expect(out.dateKey).toBe("2026-05-29");
	});

	it("serves the stored reflection (no AI) when the persisted fingerprint matches the day", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		// Mirror fingerprintSessions: sha256 of the sorted, '|'-joined session ids.
		const fingerprint = createHash("sha256").update(["s1", "s2"].slice().sort().join("|")).digest("hex").slice(0, 12);
		sb.state.responses.day_reflections = [{ data: { body: "stored prose", source: "ai", fingerprint }, error: null }];

		const out = await getDayReflection("s1", "u1");

		expect(out).toEqual({ body: "stored prose", source: "ai", dateKey: "2026-05-29", sessionCount: 2 });
		expect(aiState.calls).toBe(0);
	});

	it("regenerates (and re-persists) when the stored fingerprint is stale", async () => {
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		sb.state.responses.day_reflections = [{ data: { body: "old prose", source: "ai", fingerprint: "stale-fingerprint" }, error: null }];
		aiState.result = { body: "fresh prose" };

		const out = await getDayReflection("s1", "u1");

		expect(out.body).toBe("fresh prose");
		expect(out.source).toBe("ai");
		expect(aiState.calls).toBe(1);
	});
});
