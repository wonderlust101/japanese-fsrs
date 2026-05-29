import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createOpenAIHarness, createRedisHarness, createSupabaseHarness } from "../../../tests/support";
import { env } from "../../lib/env.ts";

// card.embeddings sits on three external seams — Supabase (cards row r/w + the
// bulk_update_card_embeddings RPC), Redis (the by-text-hash embedding cache,
// also the circuit-breaker store via rawRedis), and OpenAI (embeddings.create).
// All three are mocked so the file runs offline and deterministically. Before
// this suite the module had ZERO test coverage — nothing imported it (audit M2).
const sb = createSupabaseHarness();
const r = createRedisHarness();
const ai = createOpenAIHarness();

mock.module("../../db/supabase.ts", () => ({ supabaseAdmin: sb.supabaseAdmin }));
mock.module("../../db/redis.ts", () => r.module);
mock.module("../../lib/openai.ts", () => ai.module);

const {
	regenerateEmbedding,
	backfillEmbedding,
	backfillPremadeEmbeddings,
	generateEmbedding,
	generateEmbeddingsBatch,
} = await import("../card.embeddings.ts");

/** Full-length vector so readEmbeddingCache's 1536-dim shape check passes. */
function vec1536(fill = 0.1): number[] {
	return Array.from({ length: 1536 }, () => fill);
}

/** Mirrors the module's cache-key construction so cache-hit tests can pre-seed. */
function embeddingCacheKey(text: string): string {
	const hash = createHash("sha256").update(text).digest("hex");
	return `embed:v1:${env.OPENAI_EMBEDDING_MODEL}:${hash}`;
}

function findCall(method: string): { method: string; args: readonly unknown[] } | undefined {
	return sb.state.calls.find(c => c.method === method);
}

beforeEach(() => {
	sb.reset();
	r.reset();
	ai.reset();
});

describe("generateEmbedding", () => {
	it("returns the OpenAI vector and forwards model + input", async () => {
		ai.queueEmbedding([0.1, 0.2, 0.3]);

		const out = await generateEmbedding("hello world");

		expect(out).toEqual([0.1, 0.2, 0.3]);
		expect(ai.embeddingCalls).toHaveLength(1);
		expect(ai.embeddingCalls[0]?.input).toBe("hello world");
		expect(typeof ai.embeddingCalls[0]?.model).toBe("string");
	});
});

describe("generateEmbeddingsBatch", () => {
	it("embeds an array in one request, preserving order by index", async () => {
		ai.queueEmbedding([0.1]);
		ai.queueEmbedding([0.2]);

		const out = await generateEmbeddingsBatch(["alpha", "beta"]);

		expect(out).toEqual([[0.1], [0.2]]);
		expect(ai.embeddingCalls).toHaveLength(1);
		expect(ai.embeddingCalls[0]?.input).toEqual(["alpha", "beta"]);
	});

	it("short-circuits empty input without calling OpenAI", async () => {
		const out = await generateEmbeddingsBatch([]);

		expect(out).toEqual([]);
		expect(ai.embeddingCalls).toHaveLength(0);
	});
});

describe("backfillEmbedding", () => {
	it("no-ops when the card has no embeddable fields (no OpenAI, no DB write)", async () => {
		await backfillEmbedding("card-1", "user-1", { exampleSentences: [] });

		expect(ai.embeddingCalls).toHaveLength(0);
		expect(sb.state.calls).toHaveLength(0);
	});

	it("cache miss → calls OpenAI once and writes embedding + timestamp to the row", async () => {
		sb.state.responses.cards = [{ data: null, error: null }];
		const vector = vec1536(0.5);
		ai.queueEmbedding(vector);

		await backfillEmbedding("card-1", "user-1", { word: "水", reading: "みず", meaning: "water" });

		expect(ai.embeddingCalls).toHaveLength(1);
		expect(ai.embeddingCalls[0]?.input).toBe("word: 水 | reading: みず | meaning: water");

		const update = findCall("update");
		expect(update).toBeDefined();
		const payload = update?.args[0] as { embedding: unknown; embedding_updated_at: unknown };
		expect(payload.embedding).toEqual(vector);
		expect(typeof payload.embedding_updated_at).toBe("string");
	});

	it("cache hit → skips OpenAI and writes the cached vector", async () => {
		const text = "word: 猫 | reading: ねこ | meaning: cat";
		const cached = vec1536(0.25);
		r.store.set(embeddingCacheKey(text), { value: JSON.stringify(cached), ttlSeconds: 100 });
		sb.state.responses.cards = [{ data: null, error: null }];

		await backfillEmbedding("card-2", "user-1", { word: "猫", reading: "ねこ", meaning: "cat" });

		expect(ai.embeddingCalls).toHaveLength(0);
		const update = findCall("update");
		expect((update?.args[0] as { embedding: unknown }).embedding).toEqual(cached);
	});

	it("throws when the DB update fails", async () => {
		sb.state.responses.cards = [{ data: null, error: { message: "write failed" } }];
		ai.queueEmbedding(vec1536());

		await expect(
			backfillEmbedding("card-1", "user-1", { word: "犬", reading: "いぬ", meaning: "dog" }),
		).rejects.toThrow();
	});
});

describe("regenerateEmbedding", () => {
	it("throws 404 when the card is not found / not owned", async () => {
		sb.state.responses.cards = [{ data: null, error: { message: "no rows", code: "PGRST116" } }];

		await expect(regenerateEmbedding("missing", "user-1")).rejects.toThrow("Card not found");
		expect(ai.embeddingCalls).toHaveLength(0);
	});

	it("loads the owned card then writes a fresh embedding", async () => {
		sb.state.responses.cards = [
			{ data: { id: "card-1", user_id: "user-1", fields_data: { word: "山", reading: "やま", meaning: "mountain" } }, error: null },
			{ data: null, error: null },
		];
		ai.queueEmbedding(vec1536(0.9));

		await regenerateEmbedding("card-1", "user-1");

		expect(ai.embeddingCalls).toHaveLength(1);
		expect(findCall("update")).toBeDefined();
	});
});

describe("backfillPremadeEmbeddings", () => {
	it("batches embeddable rows, calls the bulk RPC, and counts the rest as failed", async () => {
		sb.state.responses.cards = [{
			data: [
				{ id: "c1", fields_data: { word: "a", reading: "b", meaning: "c" } },
				{ id: "c2", fields_data: { word: "d", reading: "e", meaning: "f" } },
				{ id: "c3", fields_data: {} }, // no embeddable text → counted as failed
			],
			error: null,
		}];
		sb.state.rpcResponses.bulk_update_card_embeddings = [{ data: 2, error: null }];
		ai.queueEmbedding(vec1536());
		ai.queueEmbedding(vec1536());

		const result = await backfillPremadeEmbeddings();

		expect(result).toEqual({ attempted: 3, succeeded: 2, failed: 1 });
		expect(ai.embeddingCalls).toHaveLength(1); // one batch call, not one per card
		expect(sb.state.rpcCalls[0]?.name).toBe("bulk_update_card_embeddings");
	});
});
