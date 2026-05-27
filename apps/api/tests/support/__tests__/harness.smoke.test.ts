import type { QueryResult } from "..";

import { afterEach, describe, expect, it } from "bun:test";
import {
	createOpenAIHarness,
	createRedisHarness,
	createSupabaseHarness,
	freezeClock,
	restoreClock,
	restoreRandom,
	seedRandom,

} from "..";

// These tests guard the harness itself: if a helper stops behaving as the
// Phase-1 suites assume (clock not frozen, RNG not deterministic, mock shape
// drifts from the real module), one of these fails before it can silently
// weaken a downstream test.

describe("test harness — freezeClock", () => {
	afterEach(() => { restoreClock(); });

	it("pins Date.now() and new Date() to the frozen instant", () => {
		freezeClock("2026-05-17T03:00:00.000Z");
		expect(new Date().toISOString()).toBe("2026-05-17T03:00:00.000Z");
		expect(Date.now()).toBe(Date.parse("2026-05-17T03:00:00.000Z"));
	});

	it("places one instant on different calendar days per timezone", () => {
		// 03:00Z on the 17th is already the 17th in Tokyo (+9) but still the 16th
		// in Los Angeles (−7) — the boundary the tomo-note day-key tests need.
		freezeClock("2026-05-17T03:00:00.000Z");
		const fmt = (tz: string): string =>
			new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
		expect(fmt("Asia/Tokyo")).toBe("2026-05-17");
		expect(fmt("America/Los_Angeles")).toBe("2026-05-16");
	});
});

describe("test harness — seedRandom", () => {
	afterEach(() => { restoreRandom(); });

	it("makes Math.random return a constant", () => {
		seedRandom(0.42);
		expect(Math.random()).toBe(0.42);
		expect(Math.random()).toBe(0.42);
	});

	it("cycles through a sequence", () => {
		seedRandom([0.1, 0.2, 0.3]);
		expect(Math.random()).toBe(0.1);
		expect(Math.random()).toBe(0.2);
		expect(Math.random()).toBe(0.3);
		expect(Math.random()).toBe(0.1);
	});

	it("restores the real Math.random", () => {
		seedRandom(0.5);
		restoreRandom();
		// The real RNG returning exactly 0.5 twice in a row is effectively impossible.
		expect(Math.random() === 0.5 && Math.random() === 0.5).toBe(false);
	});
});

interface ChatCompletion { choices: Array<{ message: { content: string } }> }
interface ChatClient { chat: { completions: { create: (params: unknown) => Promise<ChatCompletion> } } }
interface Semaphoreish { run: <T>(opts: unknown, fn: () => Promise<T>) => Promise<T> }

describe("test harness — createOpenAIHarness", () => {
	it("returns a queued chat payload as an OpenAI-shaped JSON message and records params", async () => {
		const ai = createOpenAIHarness();
		ai.queueChat({ word: "水", reading: "みず", meaning: "water" });

		const client = ai.module.openai as ChatClient;
		const res = await client.chat.completions.create({ model: "gpt-5.4-nano" });

		const choice = res.choices[0];
		if (choice === undefined)
			throw new Error("expected a choice");
		expect(JSON.parse(choice.message.content)).toEqual({ word: "水", reading: "みず", meaning: "water" });

		expect(ai.chatCalls).toHaveLength(1);
		expect((ai.chatCalls[0] as { model?: string }).model).toBe("gpt-5.4-nano");
	});

	it("throws the queued error (deterministic failure path)", async () => {
		const ai = createOpenAIHarness();
		ai.queueChatError(new Error("429 rate limited"));
		const client = ai.module.openai as ChatClient;
		await expect(client.chat.completions.create({})).rejects.toThrow("429 rate limited");
	});

	it("throws a clear message when no chat response is queued", async () => {
		const ai = createOpenAIHarness();
		const client = ai.module.openai as ChatClient;
		await expect(client.chat.completions.create({})).rejects.toThrow(/no chat response queued/);
	});

	it("runs work through the passthrough semaphore", async () => {
		const ai = createOpenAIHarness();
		const sem = ai.module.openaiSemaphore as Semaphoreish;
		expect(await sem.run({ signal: undefined }, async () => "ran")).toBe("ran");
	});
});

interface Redisish {
	set: (k: string, v: string | number, o?: { ex?: number; nx?: boolean }) => Promise<string | null>;
	get: (k: string) => Promise<string | null>;
	incr: (k: string) => Promise<number>;
	ttl: (k: string) => Promise<number>;
	getdel: (k: string) => Promise<string | null>;
}

describe("test harness — createRedisHarness", () => {
	it("honors SET EX, SET NX, GET, INCR, TTL, and GETDEL semantics", async () => {
		const r = createRedisHarness();
		const c = r.module.redis as Redisish;

		expect(await c.set("k", "v", { ex: 30 })).toBe("OK");
		expect(await c.get("k")).toBe("v");
		expect(await c.ttl("k")).toBe(30);
		expect(await c.set("k", "other", { nx: true })).toBeNull(); // NX: key exists ⇒ no write
		expect(await c.get("k")).toBe("v");
		expect(await c.incr("n")).toBe(1);
		expect(await c.incr("n")).toBe(2);
		expect(await c.getdel("k")).toBe("v");
		expect(await c.get("k")).toBeNull(); // consumed by GETDEL
	});

	it("exposes redis and rawRedis backed by the same store", async () => {
		const r = createRedisHarness();
		const redis = r.module.redis as Redisish;
		const raw = r.module.rawRedis as Redisish;
		await redis.set("shared", "yes");
		expect(await raw.get("shared")).toBe("yes");
	});
});

interface Chainable {
	select: (cols?: string) => Chainable;
	eq: (col: string, val: unknown) => Chainable;
	maybeSingle: () => Promise<QueryResult>;
}

describe("test harness — createSupabaseHarness", () => {
	it("resolves a queued from() chain and records the builder calls", async () => {
		const sb = createSupabaseHarness();
		sb.state.responses.cards = [{ data: { id: "card-1" }, error: null }];

		const builder = sb.supabaseAdmin.from("cards") as unknown as Chainable;
		const row = await builder.select("*").eq("id", "card-1").maybeSingle();

		expect((row.data as { id: string }).id).toBe("card-1");
		expect(sb.state.lastTable).toBe("cards");
		expect(sb.state.calls).toContainEqual({ method: "eq", args: ["id", "card-1"] });
	});

	it("finds a camelCase-aliased response queue for a snake_case table", async () => {
		const sb = createSupabaseHarness();
		sb.state.responses.weakSpots = [{ data: [{ id: "w1" }], error: null, count: 1 }];

		// A list query awaits the builder directly (no .maybeSingle()); type the
		// terminal `.eq()` as the awaitable so the cast stays honest.
		const listBuilder = sb.supabaseAdmin.from("weak_spots") as unknown as {
			select: (cols?: string) => { eq: (col: string, val: unknown) => Promise<QueryResult> };
		};
		const result = await listBuilder.select("*").eq("user_id", "user-1");

		expect(result.count).toBe(1);
	});

	it("pops per-name rpc responses and records the payload", async () => {
		const sb = createSupabaseHarness();
		sb.state.rpcResponses.move_card = [{ data: "card-1", error: null }];

		const out = await sb.supabaseAdmin.rpc("move_card", { p_target_deck_id: "deck-9" });

		expect(out.data).toBe("card-1");
		expect(sb.state.rpcCalls).toContainEqual({ name: "move_card", payload: { p_target_deck_id: "deck-9" } });
	});

	it("reset() clears recorded calls and queued responses", async () => {
		const sb = createSupabaseHarness();
		sb.state.rpcResponses.x = [{ data: 1, error: null }];
		await sb.supabaseAdmin.rpc("x");
		sb.reset();
		expect(sb.state.rpcCalls).toEqual([]);
		expect(sb.state.lastTable).toBeNull();
	});
});
