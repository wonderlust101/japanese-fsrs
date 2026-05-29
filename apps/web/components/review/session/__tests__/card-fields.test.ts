import type { ApiDueCard, FieldsData } from "@fsrs-japanese/shared-types";

import { describe, expect, it } from "vitest";

import { makeDueCard } from "@/test/factories";
import { resolveCardFields } from "../card-fields";

// ── Helpers ─────────────────────────────────────────────────────────────────

function vocabularyWithSentences(count: number): FieldsData {
	return {
		word: "猫",
		reading: "ねこ",
		meaning: "cat",
		exampleSentences: Array.from({ length: count }, (_, i) => ({
			ja: `JA-${i}`,
			en: `EN-${i}`,
			furigana: `FURI-${i}`,
		})),
	};
}

describe("resolveCardFields — vocabulary", () => {
	it("rotates the example sentence deterministically based on id + due", () => {
		const card = makeDueCard({
			id: "card-stable",
			due: "2026-05-27T00:00:00.000Z",
			fieldsData: vocabularyWithSentences(5),
		});
		const first = resolveCardFields(card);
		const again = resolveCardFields(card);
		expect(first.exampleSentence).not.toBeNull();
		expect(again.exampleSentence).toEqual(first.exampleSentence);
	});

	it("changes the picked sentence across distinct due dates (deterministic per due)", () => {
		const picks: Array<string> = [];
		for (let i = 0; i < 30; i += 1) {
			const due = `2026-06-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`;
			const c = makeDueCard({ id: "card-stable", due, fieldsData: vocabularyWithSentences(10) });
			picks.push(resolveCardFields(c).exampleSentence?.ja ?? "");
		}
		// 30 distinct due dates over 10 sentences — expect multiple distinct picks.
		expect(new Set(picks).size).toBeGreaterThan(1);
	});

	it("clamps explicit sentenceIndex into [0, length-1]", () => {
		const card = makeDueCard({
			id: "card",
			due: "2026-05-27T00:00:00.000Z",
			fieldsData: vocabularyWithSentences(3),
		});
		const tooLow = resolveCardFields(card, -10);
		const tooHigh = resolveCardFields(card, 99);
		expect(tooLow.exampleSentence?.ja).toBe("JA-0");
		expect(tooHigh.exampleSentence?.ja).toBe("JA-2");
	});

	it("respects an in-range explicit sentenceIndex", () => {
		const card = makeDueCard({
			id: "card",
			due: "2026-05-27T00:00:00.000Z",
			fieldsData: vocabularyWithSentences(4),
		});
		expect(resolveCardFields(card, 2).exampleSentence?.ja).toBe("JA-2");
	});

	it("empty exampleSentences array → exampleSentence null (and not throw)", () => {
		const card = makeDueCard({
			id: "card",
			fieldsData: {
				word: "猫",
				reading: "ねこ",
				meaning: "cat",
				exampleSentences: [],
			},
		});
		expect(resolveCardFields(card).exampleSentence).toBeNull();
	});

	it("propagates word/reading/meaning from WordFields", () => {
		const card = makeDueCard({
			fieldsData: vocabularyWithSentences(1),
		});
		const r = resolveCardFields(card);
		expect(r.word).toBe("猫");
		expect(r.reading).toBe("ねこ");
		expect(r.meaning).toBe("cat");
	});

	it("returns empty strings (not throw) when WordFields is absent on a sentence-layout card with no fields", () => {
		const card = makeDueCard({
			layoutType: "sentence",
			fieldsData: { ja: "", en: "", furigana: "" } as unknown as FieldsData,
		});
		const r = resolveCardFields(card);
		expect(r.word).toBe("");
		expect(r.reading).toBeNull();
		expect(r.meaning).toBe("");
	});
});

describe("resolveCardFields — sentence layout fallback", () => {
	it("falls back to top-level ja/en/furigana when layoutType is 'sentence' and no example array", () => {
		const card: ApiDueCard = makeDueCard({
			layoutType: "sentence",
			fieldsData: {
				ja: "今日は晴れです。",
				en: "It is sunny today.",
				furigana: "きょうははれです。",
			} as unknown as FieldsData,
		});
		const r = resolveCardFields(card);
		expect(r.exampleSentence).toEqual({
			ja: "今日は晴れです。",
			en: "It is sunny today.",
			furigana: "きょうははれです。",
		});
		expect(r.word).toBe("今日は晴れです。");
		expect(r.meaning).toBe("It is sunny today.");
	});
});

describe("resolveCardFields — optional fields default to null/empty", () => {
	it("returns nullable defaults when optional vocabulary fields are absent", () => {
		const card = makeDueCard({
			fieldsData: {
				word: "水",
				reading: "みず",
				meaning: "water",
			},
		});
		const r = resolveCardFields(card);
		expect(r.partOfSpeech).toBeNull();
		expect(r.mnemonic).toBeNull();
		expect(r.nuance).toBeNull();
		expect(r.frequencyRank).toBeNull();
		expect(r.pitchPosition).toBeNull();
		expect(r.pitchAccent).toBeNull();
		expect(r.picture).toBeNull();
		expect(r.kanjiBreakdown).toEqual([]);
	});

	it("forwards jlptLevel from the parent card", () => {
		const card = makeDueCard({ jlptLevel: "N3" });
		expect(resolveCardFields(card).jlptLevel).toBe("N3");
	});
});

describe("resolveCardFields — hash stability across calls (rotation indirectly)", () => {
	it("two calls with identical id+due always pick the same sentence", () => {
		const card = makeDueCard({
			id: "stable-id",
			due: "2026-05-27T00:00:00.000Z",
			fieldsData: vocabularyWithSentences(7),
		});
		const a = resolveCardFields(card).exampleSentence?.ja;
		const b = resolveCardFields(card).exampleSentence?.ja;
		const c = resolveCardFields(card).exampleSentence?.ja;
		expect(a).toBe(b);
		expect(b).toBe(c);
	});
});
