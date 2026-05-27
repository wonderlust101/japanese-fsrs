import { describe, expect, it } from "bun:test";

import {
	ExampleSentenceSchema,
	FieldsDataSchema,
	GrammarFieldsDataSchema,
	SentenceFieldsDataSchema,
	VocabularyFieldsDataSchema,
	WordFieldsSchema,
} from "../field-shapes.schema.ts";

// Lapis-style schema admission (Backend Completion Plan, Stage 1). These
// tests pin the wire shape so a future PR cannot strip the Lapis keys via
// `.parse()` without surfacing here. Round-trip parsing is what proves the
// keys survive — the schema's default behaviour is to drop unknown keys, so
// a missing field on the schema would silently disappear on every API
// response. See packages/shared-types/src/schemas/field-shapes.schema.ts.

describe("WordFieldsSchema — Lapis-style fields", () => {
	it("admits and round-trips picture, pitchPosition, nuance", () => {
		const input = {
			word: "猫",
			reading: "ねこ",
			meaning: "cat",
			picture: "https://cdn.example.test/neko.jpg",
			pitchPosition: 0,
			nuance: "Casual register; covers domestic and stray cats alike.",
		};
		const parsed = WordFieldsSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("accepts the new fields as null (explicit \"no signal\")", () => {
		const parsed = WordFieldsSchema.parse({
			word: "犬",
			reading: "いぬ",
			meaning: "dog",
			picture: null,
			pitchPosition: null,
			nuance: null,
		});
		expect(parsed.picture).toBeNull();
		expect(parsed.pitchPosition).toBeNull();
		expect(parsed.nuance).toBeNull();
	});

	it("accepts the new fields as omitted (legacy shape)", () => {
		const parsed = WordFieldsSchema.parse({
			word: "鳥",
			reading: "とり",
			meaning: "bird",
		});
		// Omitted optional fields stay omitted — not coerced to null/undefined keys.
		expect("picture" in parsed).toBe(false);
		expect("pitchPosition" in parsed).toBe(false);
		expect("nuance" in parsed).toBe(false);
	});

	it("drops a removed expressionAudio key rather than retaining it", () => {
		// expressionAudio was removed from the card model; the schema strips
		// unknown keys, so an old payload carrying it parses without the key.
		const parsed = WordFieldsSchema.parse({
			word: "猫",
			reading: "ねこ",
			meaning: "cat",
			expressionAudio: "https://cdn.example.test/neko.mp3",
		});
		expect("expressionAudio" in parsed).toBe(false);
	});

	it("rejects a negative pitchPosition", () => {
		const result = WordFieldsSchema.safeParse({
			word: "雨",
			reading: "あめ",
			meaning: "rain",
			pitchPosition: -1,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-integer pitchPosition", () => {
		const result = WordFieldsSchema.safeParse({
			word: "雪",
			reading: "ゆき",
			meaning: "snow",
			pitchPosition: 1.5,
		});
		expect(result.success).toBe(false);
	});
});

describe("ExampleSentenceSchema — canonical ja/en/furigana shape", () => {
	it("round-trips the three-key shape", () => {
		const input = {
			ja: "猫が好きです。",
			en: "I like cats.",
			furigana: "ねこがすきです。",
		};
		const parsed = ExampleSentenceSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("drops a removed sentenceAudio key rather than retaining it", () => {
		// sentenceAudio was removed from the card model; the schema strips
		// unknown keys, so an old payload carrying it parses without the key.
		const parsed = ExampleSentenceSchema.parse({
			ja: "これは本です。",
			en: "This is a book.",
			furigana: "これはほんです。",
			sentenceAudio: "https://cdn.example.test/sentence-001.mp3",
		});
		expect("sentenceAudio" in parsed).toBe(false);
	});
});

describe("VocabularyFieldsDataSchema — composition with Lapis fields", () => {
	it("round-trips a fully populated vocabulary card", () => {
		const input = {
			word: "空",
			reading: "そら",
			meaning: "sky",
			pitchPosition: 1,
			nuance: "The visible sky; for \"outer space\" use 宇宙.",
			picture: "https://cdn.example.test/sora.jpg",
			exampleSentences: [
				{
					ja: "空が青いです。",
					en: "The sky is blue.",
					furigana: "そらがあおいです。",
				},
			],
			pitchAccent: "[1]",
		};
		const parsed = VocabularyFieldsDataSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("parses cleanly through the FieldsDataSchema union", () => {
		const parsed = FieldsDataSchema.parse({
			word: "鏡",
			reading: "かがみ",
			meaning: "mirror",
			pitchPosition: 3,
			nuance: "Refers to a physical mirror; the metaphorical \"reflection\" uses 反映.",
		});
		// Discriminator lives on the parent card's layoutType, not in the JSON
		// itself — the union narrows structurally.
		expect((parsed as { pitchPosition?: number }).pitchPosition).toBe(3);
	});
});

describe("GrammarFieldsDataSchema — inherits Lapis fields from WordFieldsSchema", () => {
	it("admits picture and nuance on a grammar pattern", () => {
		const input = {
			word: "〜てしまう",
			reading: "てしまう",
			meaning: "do completely / regrettably",
			nuance: "Carries a sense of regret or finality; the casual contraction is 〜ちゃう.",
			picture: "https://cdn.example.test/teshimau.svg",
		};
		const parsed = GrammarFieldsDataSchema.parse(input);
		expect(parsed).toEqual(input);
	});
});

// ─── Backend Completion Plan Stage 12 — sentence-layout schema contract ──────
describe("SentenceFieldsDataSchema — canonical ja/en/furigana shape", () => {
	it("accepts the minimum required shape (ja + en + furigana only)", () => {
		const parsed = SentenceFieldsDataSchema.parse({
			ja: "猫が好きです。",
			en: "I like cats.",
			furigana: "ねこがすきです。",
		});
		expect(parsed.ja).toBe("猫が好きです。");
		expect(parsed.en).toBe("I like cats.");
		expect(parsed.furigana).toBe("ねこがすきです。");
	});

	it("admits and round-trips optional breakdown / nuance", () => {
		const input = {
			ja: "猫が好きです。",
			en: "I like cats.",
			furigana: "ねこがすきです。",
			breakdown: [
				{ token: "猫", reading: "ねこ", meaning: "cat" },
				{ token: "が" },
				{ token: "好き", reading: "すき", meaning: "liked / favored" },
				{ token: "です" },
				{ token: "。" },
			],
			nuance: "Casual but polite — the です keeps it appropriate for most contexts.",
		};
		const parsed = SentenceFieldsDataSchema.parse(input);
		expect(parsed).toEqual(input);
	});

	it("rejects a sentence card missing `ja`", () => {
		const result = SentenceFieldsDataSchema.safeParse({
			en: "I like cats.",
			furigana: "ねこがすきです。",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a sentence card missing `en`", () => {
		const result = SentenceFieldsDataSchema.safeParse({
			ja: "猫が好きです。",
			furigana: "ねこがすきです。",
		});
		expect(result.success).toBe(false);
	});

	it("rejects a sentence card missing `furigana`", () => {
		const result = SentenceFieldsDataSchema.safeParse({
			ja: "猫が好きです。",
			en: "I like cats.",
		});
		expect(result.success).toBe(false);
	});

	it("rejects the legacy open-shape sentence card (only `sentence` + `translation`)", () => {
		// The pre-Stage-12 open shape (`z.record(z.string(), z.unknown())`)
		// admitted anything. The tightened schema rejects it — proves the
		// schema change is enforced at parse time, not just at the DB layer.
		const result = SentenceFieldsDataSchema.safeParse({
			sentence: "これは文です。",
			translation: "This is a sentence.",
		});
		expect(result.success).toBe(false);
	});

	it("admits a breakdown row with token only (reading + meaning optional for particles)", () => {
		const parsed = SentenceFieldsDataSchema.parse({
			ja: "猫が好き。",
			en: "I like cats.",
			furigana: "ねこがすき。",
			breakdown: [{ token: "が" }],
		});
		expect(parsed.breakdown?.[0]?.token).toBe("が");
		expect(parsed.breakdown?.[0]?.reading).toBeUndefined();
		expect(parsed.breakdown?.[0]?.meaning).toBeUndefined();
	});
});

describe("FieldsDataSchema union — sentence arm narrowing", () => {
	it("parses a sentence card via the union and preserves the canonical fields", () => {
		const parsed = FieldsDataSchema.parse({
			ja: "これは本です。",
			en: "This is a book.",
			furigana: "これはほんです。",
		});
		expect((parsed as { ja: string }).ja).toBe("これは本です。");
	});

	it("rejects an arbitrary shape that fits no arm of the union", () => {
		// Pre-Stage-12 this would have parsed as the open sentence arm.
		// Post-Stage-12 the union rejects it.
		const result = FieldsDataSchema.safeParse({
			sentence: "これは文です。",
		});
		expect(result.success).toBe(false);
	});
});
