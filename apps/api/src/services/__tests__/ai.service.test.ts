import { beforeEach, describe, expect, it, mock } from "bun:test";

import { createOpenAIHarness } from "../../../tests/support";

// Both ai.service module-load and redis client need a way to function without
// real env vars. Set a dummy OpenAI key so the SDK constructor doesn't reject.
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "sk-test-dummy";

interface MockState {
	redisStore: Map<string, string>;
}
const state: MockState = { redisStore: new Map() };

const fakeRedis = {
	get: mock(async (key: string) => {
		const v = state.redisStore.get(key);
		return v === undefined ? null : v;
	}),
	set: mock(async (key: string, value: string) => {
		state.redisStore.set(key, value);
		return "OK";
	}),
	del: mock(async (key: string) => {
		state.redisStore.delete(key);
		return 1;
	}),
	// Methods used by the circuit breaker (rawRedis path) — see Phase D in
	// db/redis.ts for why two exports exist. Without these, withBreaker calls
	// fail with "x is not a function".
	incr: mock(async (key: string) => {
		const v = Number(state.redisStore.get(key) ?? 0) + 1;
		state.redisStore.set(key, String(v));
		return v;
	}),
	ttl: mock(async (_key: string) => -2),
	// recordSuccess() on the circuit-breaker happy path uses GETDEL; without it a
	// successful (mocked) OpenAI call would throw 'getdel is not a function'.
	getdel: mock(async (key: string) => {
		const v = state.redisStore.get(key);
		state.redisStore.delete(key);
		return v === undefined ? null : v;
	}),
};

mock.module("../../db/redis.ts", () => ({
	redis: fakeRedis,
	rawRedis: fakeRedis,
}));

// Mock the OpenAI seam so cache-miss paths are deterministic and offline. The
// previous suite let the real SDK make a live 401 call on every miss — both a
// flake/latency risk and a reason the success pipeline was never tested. Queue
// a response per-test with ai.queueChat()/ai.queueChatError().
const ai = createOpenAIHarness();
mock.module("../../lib/openai.ts", () => ai.module);

const {
	generateCard,
	generateSentences,
	generateMnemonic,
	generateTomoNote,
	generateSentenceCard,
} = await import("../ai.service.ts");

beforeEach(() => {
	state.redisStore.clear();
	ai.reset();
});

describe("ai.service — cache hit short-circuits OpenAI", () => {
	it("generateCard returns the cached payload directly when present", async () => {
		const word = "水";
		const level = "N5";
		const cached = JSON.stringify({ word: "水", reading: "みず", meaning: "water" });
		// Compute the cache key shape so we can preload redis directly. The
		// `v4` segment is `CARD_PROMPT_VERSION` (bumped to v4 when collocations /
		// homophones / all audio fields were removed from the prompt) — bump in
		// lockstep with the service constant.
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		const key = `card:v6:${word}:${level}:${hash}`;
		state.redisStore.set(key, cached);

		const result = await generateCard(word, level, []);
		expect(result.word).toBe("水");
		expect(result.reading).toBe("みず");
		expect(result.meaning).toBe("water");
	});

	it("generateSentences cache key includes count", async () => {
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);

		const cachedFor2 = JSON.stringify({
			sentences: [
				{ ja: "a", en: "a", furigana: "" },
				{ ja: "b", en: "b", furigana: "" },
			],
		});
		state.redisStore.set(`sentences:v1:水:N5:${hash}:2`, cachedFor2);

		const out = await generateSentences("水", "N5", [], 2);
		expect(out.sentences).toHaveLength(2);
	});

	it("generateSentences namespaces the cache key by the avoid list", async () => {
		// A non-empty `avoid` appends a hash segment so "generate more" with a
		// different existing-set is a distinct key (fresh output) rather than a
		// replay of a prior cached batch. Empty avoid keeps the legacy key shape.
		const { createHash } = await import("node:crypto");
		const interestsHash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		const avoid = ["古い本を読む。"];
		const avoidHash = createHash("sha256").update(JSON.stringify(avoid)).digest("hex").slice(0, 16);

		const cached = JSON.stringify({ sentences: [{ ja: "新しい本。", en: "A new book.", furigana: "あたらしいほん。" }] });
		state.redisStore.set(`sentences:v1:水:N5:${interestsHash}:1:${avoidHash}`, cached);

		const out = await generateSentences("水", "N5", [], 1, avoid);
		expect(out.sentences[0]?.ja).toBe("新しい本。");
	});

	it("generateMnemonic cache key is user-scoped", async () => {
		state.redisStore.set("mnemonic:v1:水:user-1", JSON.stringify({ mnemonic: "flowing strokes" }));
		const out = await generateMnemonic("水", "user-1", "N5", "en", []);
		expect(out.mnemonic).toBe("flowing strokes");
	});
});

// ─── generate-sentences input contract (word OR cardId, + avoid) ────────────
describe("generateSentencesInputSchema — word-or-cardId", () => {
	const VALID_UUID = "00000000-0000-0000-0000-000000000000";

	it("accepts a cardId", async () => {
		const { generateSentencesInputSchema } = await import("@fsrs-japanese/shared-types");
		expect(generateSentencesInputSchema.safeParse({ cardId: VALID_UUID }).success).toBe(true);
	});

	it("accepts a word with optional count + avoid", async () => {
		const { generateSentencesInputSchema } = await import("@fsrs-japanese/shared-types");
		expect(generateSentencesInputSchema.safeParse({ word: "水", count: 3, avoid: ["古い本。"] }).success).toBe(true);
	});

	it("rejects a request with neither cardId nor word", async () => {
		const { generateSentencesInputSchema } = await import("@fsrs-japanese/shared-types");
		expect(generateSentencesInputSchema.safeParse({ count: 2 }).success).toBe(false);
	});

	it("rejects a request with both cardId and word", async () => {
		const { generateSentencesInputSchema } = await import("@fsrs-japanese/shared-types");
		expect(generateSentencesInputSchema.safeParse({ cardId: VALID_UUID, word: "水" }).success).toBe(false);
	});
});

// ─── Backend Completion Plan Stage 2 ────────────────────────────────────────
//
// The generateCard prompt now asks the model for `pitchPosition` (integer ≥ 0)
// and `nuance` (short prose). These tests pin three contracts:
//   1. The structured-output Zod schema admits the new fields, so a model
//      response carrying them round-trips through `.parse()` instead of being
//      stripped.
//   2. The cache key embeds `CARD_PROMPT_VERSION` (currently 'v5'), so
//      entries cached under any prior key shape are bypassed by the new
//      key. Without this contract, a deploy that changes the prompt body
//      would serve stale outputs from the prior prompt until the 7-day
//      TTL.
//   3. `picture` is admitted by the schema (so a future prompt-version bump
//      can populate it) but the current prompt does not request it — the
//      schema's optionality is the contract that lets both states coexist.
describe("ai.service — Stage 2 Lapis fields on the cached payload", () => {
	it("generateCard returns cached pitchPosition + nuance when present (round-trip through GeneratedCardDataSchema)", async () => {
		const word = "空";
		const level = "N5";
		const cached = JSON.stringify({
			word: "空",
			reading: "そら",
			meaning: "sky",
			pitchPosition: 1,
			nuance: "Refers to the visible sky; for \"outer space\" use 宇宙.",
		});
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		// Cache key includes the prompt version so this fixture lives at the v5 key.
		const key = `card:v6:${word}:${level}:${hash}`;
		state.redisStore.set(key, cached);

		const result = await generateCard(word, level, []);
		expect(result.word).toBe("空");
		expect(result.pitchPosition).toBe(1);
		expect(result.nuance).toBe("Refers to the visible sky; for \"outer space\" use 宇宙.");
	});

	it("generateCard bypasses pre-version-bump cache entries (v6 key shape differs from prior keys)", async () => {
		const word = "川";
		const level = "N5";
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);

		// Seed an entry under a stale (pre-v6) key shape. After deploy, lookups
		// now happen at the v6 key, so this entry is dead weight until it TTLs
		// out. The new lookup must miss and fall through.
		const oldKey = `card:v5:${word}:${level}:${hash}`;
		state.redisStore.set(oldKey, JSON.stringify({ word: "stale", reading: "stale", meaning: "stale" }));

		const result = await generateCard(word, level, []).catch(err => err);
		// The OpenAI fall-through is not mocked here — either it resolves with a
		// fresh payload or it errors. The contract we assert is that the OLD key
		// is never read: the result is not the stale payload above.
		if (!(result instanceof Error)) {
			expect(result.word).not.toBe("stale");
		}
		// The old key itself is left untouched (no migration / cleanup). Its
		// TTL will reclaim it; the new code path simply doesn't read it.
		expect(state.redisStore.get(oldKey)).toBe(
			JSON.stringify({ word: "stale", reading: "stale", meaning: "stale" }),
		);
	});

	it("GeneratedCardDataSchema drops a removed sentenceAudio key on example sentences", async () => {
		// sentenceAudio was removed from the card model; the schema strips
		// unknown keys, so a model response carrying it parses to the canonical
		// three-key example sentence without the audio key.
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const parsed = GeneratedCardDataSchema.parse({
			word: "猫",
			reading: "ねこ",
			meaning: "cat",
			exampleSentences: [
				{
					ja: "猫が好きです。",
					en: "I like cats.",
					furigana: "ねこがすきです。",
					sentenceAudio: "https://cdn.example.test/sentence-001.mp3",
				},
			],
		});
		const first = parsed.exampleSentences?.[0];
		expect(first?.ja).toBe("猫が好きです。");
		expect(first !== undefined && "sentenceAudio" in first).toBe(false);
	});

	it("GeneratedCardDataSchema rejects a negative pitchPosition (defends against bad model output)", async () => {
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const result = GeneratedCardDataSchema.safeParse({
			word: "雨",
			reading: "あめ",
			meaning: "rain",
			pitchPosition: -1,
		});
		expect(result.success).toBe(false);
	});

	it("GeneratedCardDataSchema rejects a non-integer pitchPosition", async () => {
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const result = GeneratedCardDataSchema.safeParse({
			word: "雪",
			reading: "ゆき",
			meaning: "snow",
			pitchPosition: 1.5,
		});
		expect(result.success).toBe(false);
	});

	// ─── Backend Completion Plan Stage 3 ─────────────────────────────────────
	// The prompt requests the widened `kanjiBreakdown { kanji, radical,
	// meaning, reading }` shape. The schema changes alongside; without these
	// tests a future cache-key bump that forgets the structured-output update
	// would silently truncate fields.

	it("GeneratedCardDataSchema drops removed collocations + homophones keys", async () => {
		// collocations / homophones were removed from the card model; the schema
		// strips unknown keys, so a model response carrying them parses without.
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const parsed = GeneratedCardDataSchema.parse({
			word: "言葉",
			reading: "ことば",
			meaning: "word; language",
			collocations: ["言葉を交わす", "言葉に詰まる", "優しい言葉"],
			homophones: ["異葉 (different leaf — rare)"],
		});
		expect("collocations" in parsed).toBe(false);
		expect("homophones" in parsed).toBe(false);
	});

	it("GeneratedCardDataSchema accepts kanjiBreakdown entries with radical + reading", async () => {
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const parsed = GeneratedCardDataSchema.parse({
			word: "食べる",
			reading: "たべる",
			meaning: "to eat",
			kanjiBreakdown: [
				{
					kanji: "食",
					radical: "eat",
					meaning: "eat, food",
					reading: "しょく / た（べる）",
				},
			],
		});
		expect(parsed.kanjiBreakdown?.[0]?.radical).toBe("eat");
		expect(parsed.kanjiBreakdown?.[0]?.reading).toBe("しょく / た（べる）");
	});

	it("GeneratedCardDataSchema accepts kanjiBreakdown entries with radical / reading omitted (per-character opt-out)", async () => {
		// The Stage 3 prompt instructs the model to omit radical / reading per
		// character when unsure. The schema must therefore admit a minimal
		// `{kanji, meaning}` entry alongside the full shape, including mixed
		// entries in the same array.
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const parsed = GeneratedCardDataSchema.parse({
			word: "紅葉",
			reading: "もみじ",
			meaning: "autumn leaves",
			kanjiBreakdown: [
				{ kanji: "紅", radical: "thread", meaning: "crimson", reading: "こう" },
				{ kanji: "葉", meaning: "leaf" }, // radical + reading omitted
			],
		});
		expect(parsed.kanjiBreakdown).toHaveLength(2);
		expect(parsed.kanjiBreakdown?.[1]?.radical).toBeUndefined();
		expect(parsed.kanjiBreakdown?.[1]?.reading).toBeUndefined();
	});

	it("GeneratedCardDataSchema admits the picture field even though the prompt does not request it", async () => {
		// The schema is forward-compatible so a future prompt-version bump can
		// wire up picture without a second schema change. Today's prompt
		// explicitly tells the model NOT to invent a value for it, but if a
		// model does produce one it must round-trip cleanly.
		const { GeneratedCardDataSchema } = await import("@fsrs-japanese/shared-types");
		const parsed = GeneratedCardDataSchema.parse({
			word: "光",
			reading: "ひかり",
			meaning: "light",
			picture: "https://cdn.example.test/hikari.jpg",
		});
		expect(parsed.picture).toBe("https://cdn.example.test/hikari.jpg");
	});
});

// ─── Backend Completion Plan Stage 6 ────────────────────────────────────────
// generateTomoNote caches one entry per (userId, dateKey, prompt-version).
// The version segment isolates cache busts on prompt edits — same pattern
// as CARD_PROMPT_VERSION + DIAGNOSIS_PROMPT_VERSION.
describe("ai.service — generateTomoNote cache", () => {
	it("returns the cached payload directly when present at the v1 key shape", async () => {
		const userId = "user-tomo-1";
		const dateKey = "2026-05-17";
		const cached = JSON.stringify({
			body: "猫が好きです (neko ga suki desu) — your N3 verb conjugation has been steady this week.",
		});
		const key = `tomo:note:v2:${userId}:${dateKey}`;
		state.redisStore.set(key, cached);

		const result = await generateTomoNote(userId, dateKey, "N3", "en", [], null, null, null, []);
		expect(result.body).toMatch(/N3 verb conjugation/);
	});

	it("does not read from a key missing the version segment (forward-only invalidation)", async () => {
		const userId = "user-tomo-2";
		const dateKey = "2026-05-17";
		// Pre-version key shape — should NOT be served by the current code.
		state.redisStore.set(`tomo:note:${userId}:${dateKey}`, JSON.stringify({ body: "stale" }));

		// OpenAI is unmocked here, so the call will reject. We only assert that
		// the stale `body: 'stale'` payload was never read — the result either
		// throws or returns a fresh value, but it never equals the stale body.
		const result = await generateTomoNote(userId, dateKey, "N3", "en", [], null, null, null, [])
			.catch(err => err);

		if (!(result instanceof Error)) {
			expect(result.body).not.toBe("stale");
		}
	});
});

describe("ai.service — corrupt cached payload is treated as miss", () => {
	// Previous behavior: bad cache → ZodError surfaced as 500 to every caller
	// that hashed to the corrupt key until TTL. New behavior: log + delete +
	// fall through to a fresh OpenAI call. The OpenAI fetch isn't mocked here,
	// so it may resolve (writing a fresh value at the same key) or reject;
	// either way, the original corrupt entry must no longer be present.

	it("generateCard removes the corrupt cache entry (does not surface ZodError)", async () => {
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		// Key includes `v4` for CARD_PROMPT_VERSION — see the Stage 2/3 block above.
		const key = `card:v6:水:N5:${hash}`;
		const corrupt = JSON.stringify({ word: "水" /* missing reading + meaning */ });
		state.redisStore.set(key, corrupt);

		const result = await generateCard("水", "N5", []).catch(err => err);
		// Whether OpenAI fell through successfully or errored, the corrupt
		// entry must no longer be there — otherwise the next caller hits the
		// same bad cache.
		expect(state.redisStore.get(key)).not.toBe(corrupt);
		// And specifically: any thrown error must NOT be a ZodError surfacing
		// the corrupt-shape complaint to callers.
		if (result instanceof Error) {
			expect(result.name).not.toBe("ZodError");
		}
	});

	it("generateSentences removes the corrupt cache entry (does not surface ZodError)", async () => {
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		const key = `sentences:v1:水:N5:${hash}:3`;
		const corrupt = JSON.stringify({ wrong: "shape" });
		state.redisStore.set(key, corrupt);

		const result = await generateSentences("水", "N5", [], 3).catch(err => err);
		expect(state.redisStore.get(key)).not.toBe(corrupt);
		if (result instanceof Error) {
			expect(result.name).not.toBe("ZodError");
		}
	});
});

// ─── Backend Completion Plan Stage 13 — sentence-card generator ──────────────
// Mirrors the Stage 2 pattern: version-keyed cache, separate namespace from
// the vocabulary generator. The schema enforces the Stage 12 shape.
describe("ai.service — generateSentenceCard cache", () => {
	it("returns the cached payload when present at the v2 sentence-card key shape", async () => {
		const topic = "ordering coffee";
		const level = "N3";
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		const cached = JSON.stringify({
			ja: "コーヒーをください。",
			en: "Coffee, please.",
			furigana: "コーヒーをください。",
			nuance: "Polite enough for a café — neutral register.",
		});
		const key = `sentence-card:v3:${topic}:${level}:${hash}`;
		state.redisStore.set(key, cached);

		const result = await generateSentenceCard(topic, level, []);
		expect(result.ja).toBe("コーヒーをください。");
		expect(result.en).toBe("Coffee, please.");
		expect(result.furigana).toBe("コーヒーをください。");
		expect(result.nuance).toBe("Polite enough for a café — neutral register.");
	});

	it("does not read entries under the vocabulary card namespace (separate caches)", async () => {
		const topic = "ordering tea";
		const level = "N3";
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);

		// Seed an entry under the vocabulary card key shape — wrong namespace
		// for the sentence generator; it must not be served.
		const wrongNamespaceKey = `card:v6:${topic}:${level}:${hash}`;
		state.redisStore.set(wrongNamespaceKey, JSON.stringify({
			word: "お茶",
			reading: "おちゃ",
			meaning: "tea",
		}));

		// OpenAI is unmocked here — call resolves with a fresh payload or rejects.
		// The contract: the wrong-namespace entry is never used.
		const result = await generateSentenceCard(topic, level, []).catch(err => err);

		if (!(result instanceof Error)) {
			// If the call somehow succeeded, the result must be a sentence shape,
			// not the vocabulary one we seeded.
			expect(result.word).toBeUndefined();
			expect("ja" in result).toBe(true);
		}
		// The vocabulary entry stays in place — different generator's namespace,
		// nothing reads it from this code path.
		expect(state.redisStore.get(wrongNamespaceKey)).toBe(JSON.stringify({
			word: "お茶",
			reading: "おちゃ",
			meaning: "tea",
		}));
	});

	it("GeneratedSentenceCardSchema rejects a card missing `ja`", async () => {
		const { GeneratedSentenceCardSchema } = await import("@fsrs-japanese/shared-types");
		const result = GeneratedSentenceCardSchema.safeParse({
			en: "I like cats.",
			furigana: "ねこがすきです。",
		});
		expect(result.success).toBe(false);
	});

	it("GeneratedSentenceCardSchema rejects a card missing `en`", async () => {
		const { GeneratedSentenceCardSchema } = await import("@fsrs-japanese/shared-types");
		const result = GeneratedSentenceCardSchema.safeParse({
			ja: "猫が好きです。",
			furigana: "ねこがすきです。",
		});
		expect(result.success).toBe(false);
	});

	it("GeneratedSentenceCardSchema rejects a card missing `furigana`", async () => {
		const { GeneratedSentenceCardSchema } = await import("@fsrs-japanese/shared-types");
		const result = GeneratedSentenceCardSchema.safeParse({
			ja: "猫が好きです。",
			en: "I like cats.",
		});
		expect(result.success).toBe(false);
	});

	it("GeneratedSentenceCardSchema admits a full payload with breakdown + nuance round-trip", async () => {
		const { GeneratedSentenceCardSchema } = await import("@fsrs-japanese/shared-types");
		const input = {
			ja: "猫が好きです。",
			en: "I like cats.",
			furigana: "ねこがすきです。",
			breakdown: [
				{ token: "猫", reading: "ねこ", meaning: "cat" },
				{ token: "が" },
				{ token: "好き", reading: "すき", meaning: "liked" },
				{ token: "です" },
				{ token: "。" },
			],
			nuance: "Polite but warm register.",
		};
		const parsed = GeneratedSentenceCardSchema.parse(input);
		expect(parsed.ja).toBe("猫が好きです。");
		expect(parsed.breakdown).toHaveLength(5);
		expect(parsed.breakdown?.[0]?.reading).toBe("ねこ");
	});
});

// ─── WP-E — generator success path + sanitization (mocked OpenAI) ─────────────
// The cache-HIT tests above never reach OpenAI. These pin the miss → call →
// parse → map → cache-write pipeline deterministically, plus the sanitization
// that must run before both the prompt and the cache key.
describe("ai.service — generateCard cache miss (mocked OpenAI)", () => {
	it("calls OpenAI, returns the parsed card, and writes it to the version-keyed cache", async () => {
		ai.queueChat({ word: "水", reading: "みず", meaning: "water", mnemonic: "flowing strokes" });
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);
		const cacheKey = `card:v6:水:N5:${hash}`;
		expect(state.redisStore.has(cacheKey)).toBe(false);

		const result = await generateCard("水", "N5", []);

		expect(result.word).toBe("水");
		expect(result.reading).toBe("みず");
		expect(result.meaning).toBe("water");
		expect(ai.chatCalls).toHaveLength(1);
		// Cache populated so the next equivalent request short-circuits OpenAI.
		expect(state.redisStore.get(cacheKey)).toBe(JSON.stringify(result));
	});

	it("strips HTML from the word before it reaches the prompt and the cache key", async () => {
		ai.queueChat({ word: "水", reading: "みず", meaning: "water" });
		const { createHash } = await import("node:crypto");
		const sanitizedKey = `card:v6:水:N5:${createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16)}`;

		await generateCard("<script>水</script>", "N5", []);

		// The model never sees the tag; the cache key is keyed off the sanitized
		// word — defence-in-depth against prompt injection.
		const sentToModel = JSON.stringify(ai.chatCalls[0]);
		expect(sentToModel).toContain("水");
		expect(sentToModel).not.toContain("<script>");
		expect(state.redisStore.has(sanitizedKey)).toBe(true);
	});

	it("surfaces a 503 (not a raw 500) when the OpenAI call fails, via the circuit breaker", async () => {
		ai.queueChatError(new Error("ECONNRESET"));

		let caught: unknown;
		try { await generateCard("火", "N5", []); } catch (e) { caught = e; }
		expect((caught as { statusCode?: number }).statusCode).toBe(503);
	});
});

// ─── WP-E follow-up — remaining generators' success paths (mocked OpenAI) ─────
// Same miss → call → parse → cache pattern as generateCard, one per generator,
// so a regression in any generator's parse/return/cache-key fails here — and so
// none of them silently fall back to a live network call.
describe("ai.service — other generators cache miss (mocked OpenAI)", () => {
	it("generateSentences returns parsed sentences and caches under the count-keyed namespace", async () => {
		ai.queueChat({ sentences: [
			{ ja: "水を飲む。", en: "Drink water.", furigana: "みずをのむ。" },
			{ ja: "水は冷たい。", en: "The water is cold.", furigana: "みずはつめたい。" },
		] });
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);

		const out = await generateSentences("水", "N5", [], 2);

		expect(out.sentences).toHaveLength(2);
		expect(ai.chatCalls).toHaveLength(1);
		expect(state.redisStore.has(`sentences:v1:水:N5:${hash}:2`)).toBe(true);
	});

	it("generateMnemonic returns the parsed mnemonic and caches under a user-scoped key", async () => {
		ai.queueChat({ mnemonic: "water flows in three strokes" });

		const out = await generateMnemonic("水", "user-1", "N5", "en", []);

		expect(out.mnemonic).toBe("water flows in three strokes");
		expect(state.redisStore.has("mnemonic:v1:水:user-1")).toBe(true);
	});

	it("generateTomoNote returns the parsed note and caches under the version+day key", async () => {
		ai.queueChat({ body: "Your N3 verb conjugation has been steady this week." });

		const out = await generateTomoNote("user-tomo-9", "2026-05-17", "N3", "en", [], null, null, null, []);

		expect(out.body).toMatch(/N3 verb conjugation/);
		expect(state.redisStore.has("tomo:note:v2:user-tomo-9:2026-05-17")).toBe(true);
	});

	it("generateSentenceCard returns the parsed card and caches under its own namespace", async () => {
		ai.queueChat({ ja: "コーヒーをください。", en: "Coffee, please.", furigana: "コーヒーをください。" });
		const { createHash } = await import("node:crypto");
		const hash = createHash("sha256").update(JSON.stringify([])).digest("hex").slice(0, 16);

		const out = await generateSentenceCard("ordering coffee", "N3", []);

		expect(out.ja).toBe("コーヒーをください。");
		expect(state.redisStore.has(`sentence-card:v3:ordering coffee:N3:${hash}`)).toBe(true);
	});
});

// ─── Determinism policy: temperature + seed per generator type ───────────────
// Structured/factual generators run cold (low temp + fixed seed) for run-to-run
// consistency; creative generators run warm (high temp, no seed) for variety.
describe("ai.service — temperature + seed policy", () => {
	it("generateCard (structured) sends a low temperature and a fixed seed", async () => {
		ai.queueChat({ word: "水", reading: "みず", meaning: "water" });
		await generateCard("水", "N5", []);
		const params = ai.chatCalls[0] as { temperature?: number; seed?: number };
		expect(params.temperature).toBe(0.3);
		expect(typeof params.seed).toBe("number");
	});

	it("generateSentences (creative) sends a high temperature and no seed", async () => {
		ai.queueChat({ sentences: [{ ja: "水を飲む。", en: "Drink water.", furigana: "みずをのむ。" }] });
		await generateSentences("水", "N5", [], 1);
		const params = ai.chatCalls[0] as { temperature?: number; seed?: number };
		expect(params.temperature).toBe(0.8);
		expect(params.seed).toBeUndefined();
	});
});

// ─── Structured-output repair retry ──────────────────────────────────────────
// A first response that fails schema validation triggers exactly one repair
// turn; a valid second response is returned, and the failure is never surfaced
// as a ZodError. Structured generators only.
describe("ai.service — structured repair retry", () => {
	it("generateCard retries once on a malformed first response, then succeeds", async () => {
		// First response is missing required `reading` + `meaning` → ZodError.
		ai.queueChat({ word: "水" });
		// Repaired response is valid.
		ai.queueChat({ word: "水", reading: "みず", meaning: "water" });

		const result = await generateCard("水", "N5", []);

		expect(result.reading).toBe("みず");
		expect(result.meaning).toBe("water");
		// Exactly two OpenAI calls: original + one repair.
		expect(ai.chatCalls).toHaveLength(2);
	});

	it("generateCard surfaces a 502 (not a ZodError) when the repair also fails", async () => {
		ai.queueChat({ word: "水" }); // malformed
		ai.queueChat({ word: "水" }); // still malformed after repair

		let caught: unknown;
		try { await generateCard("水", "N5", []); } catch (e) { caught = e; }
		expect((caught as { statusCode?: number }).statusCode).toBe(502);
		expect((caught as { name?: string }).name).not.toBe("ZodError");
		expect(ai.chatCalls).toHaveLength(2);
	});
});

// ─── Sentence word-presence guard (conjugation-aware) ────────────────────────
describe("ai.service — generateSentences word-presence guard", () => {
	it("drops sentences that do not contain the target word", async () => {
		ai.queueChat({ sentences: [
			{ ja: "毎日水を飲む。", en: "I drink water every day.", furigana: "まいにちみずをのむ。" },
			{ ja: "今日は暑い。", en: "It's hot today.", furigana: "きょうはあつい。" }, // no 水
		] });

		const out = await generateSentences("水", "N5", [], 2);

		expect(out.sentences).toHaveLength(1);
		expect(out.sentences[0]?.ja).toContain("水");
	});

	it("keeps a conjugated form of the target word (kanji stem match)", async () => {
		// 食べる appears conjugated as 食べなかった — a literal includes('食べる')
		// would reject it, but the kanji-core (食) match keeps it.
		ai.queueChat({ sentences: [
			{ ja: "昨日は何も食べなかった。", en: "I didn't eat anything yesterday.", furigana: "きのうはなにもたべなかった。" },
		] });

		const out = await generateSentences("食べる", "N5", [], 1);

		expect(out.sentences).toHaveLength(1);
	});

	it("returns 502 when the model produced sentences but none are on target", async () => {
		ai.queueChat({ sentences: [
			{ ja: "今日は暑い。", en: "It's hot today.", furigana: "きょうはあつい。" },
		] });

		let caught: unknown;
		try { await generateSentences("水", "N5", [], 1); } catch (e) { caught = e; }
		expect((caught as { statusCode?: number }).statusCode).toBe(502);
	});
});
