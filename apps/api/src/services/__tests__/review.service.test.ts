import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createOpenAIHarness, createRedisHarness, createSupabaseHarness } from "../../../tests/support";

// review.service is mostly thin RPC wrappers, but two carry real logic worth
// pinning: getReviewForecast (BIGINT-as-string coercion + the explicit-split
// branch) and getSessionSummary (accuracy math + weak-spot camelCase mapping +
// the 404 path). Before this suite the file sat at ~24% line coverage (audit M2).
const sb = createSupabaseHarness();
const r = createRedisHarness();
const ai = createOpenAIHarness();

mock.module("../../db/supabase.ts", () => ({ supabaseAdmin: sb.supabaseAdmin }));
mock.module("../../db/redis.ts", () => r.module);
mock.module("../../lib/openai.ts", () => ai.module);

// Mock the due-card cache seam so getDueCards' short-circuit is controllable
// without reaching for the internal Redis key shape.
const dueCacheState: { cached: { items: unknown[]; hasMore: boolean } | null } = { cached: null };
mock.module("../../lib/due-cache.ts", () => ({
	readDueCache: async () => dueCacheState.cached,
	writeDueCache: async () => {},
	// card.service (loaded transitively for DueCardRpcRowSchema/toApiDueCard)
	// imports this from the same module; the whole module is replaced, so every
	// export must be present or its import graph fails to load.
	invalidateDueCache: async () => {},
}));

const { getDueCards, getReviewForecast, getSessionSummary } = await import("../review.service.ts");

type Profile = Parameters<typeof getDueCards>[1];
const profile = { timezone: "Asia/Tokyo", dailyReviewLimit: 200, dailyNewCardsLimit: 20 } as unknown as Profile;

beforeEach(() => {
	sb.reset();
	r.reset();
	ai.reset();
	dueCacheState.cached = null;
});

describe("getReviewForecast", () => {
	it("maps an explicit backlog/review/new split", async () => {
		sb.state.rpcResponses.get_review_forecast = [{
			data: [{ date: "2026-05-30", count: 5, backlog_count: 2, review_count: 2, new_count: 1 }],
			error: null,
		}];

		const out = await getReviewForecast("user-1", profile);

		expect(out.items).toEqual([
			{ date: "2026-05-30", count: 5, backlogCount: 2, reviewCount: 2, newCount: 1 },
		]);
		expect(out.hasMore).toBe(false);
	});

	it("coerces BIGINT-as-string counts and defaults the split to all-review", async () => {
		sb.state.rpcResponses.get_review_forecast = [{
			data: [{ date: "2026-05-31", count: "7" }],
			error: null,
		}];

		const out = await getReviewForecast("user-1", profile);

		expect(out.items[0]).toEqual({ date: "2026-05-31", count: 7, backlogCount: 0, reviewCount: 7, newCount: 0 });
	});

	it("throws when the RPC errors", async () => {
		sb.state.rpcResponses.get_review_forecast = [{ data: null, error: { message: "boom" } }];

		await expect(getReviewForecast("user-1", profile)).rejects.toThrow();
	});
});

describe("getSessionSummary", () => {
	function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
		return {
			total: 10,
			breakdown: { again: 1, hard: 2, good: 5, easy: 2 },
			total_time_ms: 60_000,
			next_due_at: "2026-05-30T00:00:00Z",
			weak_spots: [{
				weak_spot_id: "w1",
				card_id: "c1",
				deck_id: "d1",
				word: "水",
				reading: "みず",
				lapses: 3,
				diagnosis: null,
				prescription: null,
				resolved: false,
				created_at: "2026-05-29T00:00:00Z",
			}],
			user_total_sessions: 2,
			sessions_today: 1,
			...overrides,
		};
	}

	it("computes accuracy and maps weak spots to camelCase", async () => {
		sb.state.rpcResponses.get_session_summary = [{ data: envelope(), error: null }];

		const out = await getSessionSummary("session-1", "user-1", profile);

		expect(out.totalCards).toBe(10);
		expect(out.accuracyPct).toBe(70); // (good 5 + easy 2) / 10
		expect(out.totalTimeMs).toBe(60_000);
		expect(out.weakSpots[0]).toMatchObject({
			weakSpotId: "w1",
			cardId: "c1",
			deckId: "d1",
			word: "水",
			reading: "みず",
			lapses: 3,
			resolved: false,
		});
	});

	it("returns 0 accuracy for an empty session (no divide-by-zero)", async () => {
		sb.state.rpcResponses.get_session_summary = [{
			data: envelope({ total: 0, breakdown: { again: 0, hard: 0, good: 0, easy: 0 }, weak_spots: [] }),
			error: null,
		}];

		const out = await getSessionSummary("session-1", "user-1", profile);

		expect(out.accuracyPct).toBe(0);
		expect(out.weakSpots).toEqual([]);
	});

	it("maps the PL/pgSQL no_data_found code to a 404", async () => {
		sb.state.rpcResponses.get_session_summary = [{ data: null, error: { code: "P0002", message: "session_not_found" } }];

		await expect(getSessionSummary("missing", "user-1", profile)).rejects.toThrow("Session not found");
	});

	it("rethrows non-not-found RPC errors", async () => {
		sb.state.rpcResponses.get_session_summary = [{ data: null, error: { code: "XX000", message: "boom" } }];

		await expect(getSessionSummary("session-1", "user-1", profile)).rejects.toThrow();
	});
});

describe("getDueCards", () => {
	it("short-circuits on a cache hit without hitting the RPC", async () => {
		dueCacheState.cached = { items: [{ id: "c1" }], hasMore: true };

		const out = await getDueCards("user-1", profile);

		// Cast to a loose shape: the cached items are a test stub, not full
		// ApiDueCard rows, so `toEqual` against the typed result would not compile.
		expect(out.items as unknown[]).toEqual([{ id: "c1" }]);
		expect(out.nextCursor).toBeNull();
		expect(out.hasMore).toBe(true);
		expect(sb.state.rpcCalls).toHaveLength(0);
	});

	it("calls get_due_cards on a cache miss with the normalized payload", async () => {
		sb.state.rpcResponses.get_due_cards = [{ data: [], error: null }];

		const out = await getDueCards("user-1", profile);

		expect(out).toEqual({ items: [], nextCursor: null, hasMore: false });
		expect(sb.state.rpcCalls[0]?.name).toBe("get_due_cards");
		expect((sb.state.rpcCalls[0]?.payload as { p_user_id: string }).p_user_id).toBe("user-1");
	});

	it("throws when the RPC errors", async () => {
		sb.state.rpcResponses.get_due_cards = [{ data: null, error: { message: "boom" } }];

		await expect(getDueCards("user-1", profile)).rejects.toThrow();
	});
});
