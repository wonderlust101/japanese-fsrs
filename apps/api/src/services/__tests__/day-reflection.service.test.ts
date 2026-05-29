import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createSupabaseHarness } from "../../../tests/support";

// getDayReflection loads a profile + the day-aggregate RPC, then asks the AI
// generator for prose with a rule-based fallback. Mock Supabase (both seams)
// and the ai.service generator so all four outcomes — profile 404, session
// 404, aggregate 500, AI success, AI-failure fallback — are deterministic.
// Was ~20% line coverage before (audit M2).
const sb = createSupabaseHarness();
mock.module("../../db/supabase.ts", () => ({ supabaseAdmin: sb.supabaseAdmin }));

const aiState: { result: { body: string }; error: Error | null } = { result: { body: "ai prose" }, error: null };
mock.module("../ai.service.ts", () => ({
	generateDayReflection: async () => {
		if (aiState.error !== null)
			throw aiState.error;
		return aiState.result;
	},
}));

const { getDayReflection } = await import("../day-reflection.service.ts");

const PROFILE = { timezone: "Asia/Tokyo", jlpt_target: "N3", native_language: "en" };

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
});

describe("getDayReflection", () => {
	it("throws 404 when the profile is missing", async () => {
		sb.state.responses.profiles = [{ data: null, error: { message: "no rows" } }];

		await expect(getDayReflection("s1", "u1")).rejects.toThrow("Profile not found");
	});

	it("throws 404 when the session is not found", async () => {
		sb.state.responses.profiles = [{ data: PROFILE, error: null }];
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: null, error: { code: "P0002", message: "session_not_found" } }];

		await expect(getDayReflection("missing", "u1")).rejects.toThrow("Session not found");
	});

	it("throws 500 on an unexpected aggregate error", async () => {
		sb.state.responses.profiles = [{ data: PROFILE, error: null }];
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: null, error: { code: "XX000", message: "boom" } }];

		await expect(getDayReflection("s1", "u1")).rejects.toThrow("Failed to load day aggregate");
	});

	it("returns AI prose with source 'ai'", async () => {
		sb.state.responses.profiles = [{ data: PROFILE, error: null }];
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		aiState.result = { body: "You stayed steady today." };

		const out = await getDayReflection("s1", "u1");

		expect(out).toEqual({ body: "You stayed steady today.", source: "ai", dateKey: "2026-05-29", sessionCount: 2 });
	});

	it("falls back to rule-based prose when the AI generator throws", async () => {
		sb.state.responses.profiles = [{ data: PROFILE, error: null }];
		sb.state.rpcResponses.get_day_review_aggregate = [{ data: aggregate(), error: null }];
		aiState.error = new Error("openai down");

		const out = await getDayReflection("s1", "u1");

		expect(out.source).toBe("fallback");
		expect(typeof out.body).toBe("string");
		expect(out.body.length).toBeGreaterThan(0);
		expect(out.dateKey).toBe("2026-05-29");
	});
});
