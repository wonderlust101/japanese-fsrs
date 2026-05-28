// Card-editor field model shared by the edit-card flow: the editor row types
// (KanjiEntry / SentenceEntry / CardFields), the deck option type, select
// option lists, and the fieldsFromCard / fieldsData / preview-card builders.
// Lifted out of edit-card-client.tsx.

import type { ApiCard, ApiDueCard, JLPTLevel } from "@fsrs-japanese/shared-types";
import type { KanjiEntry, SentenceEntry } from "@/components/card-editor/types";

import type { TomoSelectOption } from "@/components/ui/TomoSelect";

import { getVocabularyFields, getWordFields, partOfSpeechEnum, pitchPatternEnum } from "@fsrs-japanese/shared-types";
// Sentence row type + list-key helpers are shared between add/edit flows.
// Import locally for use inside this module AND re-export so the twin's
// existing `./card-editor-fields` import sites keep resolving these names.
import { MAX_SENTENCES, nextRowKey, SENTENCE_BATCH } from "@/components/card-editor/types";

export { MAX_SENTENCES, nextRowKey, SENTENCE_BATCH };
export type { KanjiEntry, SentenceEntry };

export interface CardFields {
	deckId: string;
	word: string;
	reading: string;
	meaning: string;
	partOfSpeech: string;
	nuance: string;
	mnemonic: string;
	pitchAccent: string;
	pitchPosition: string; // input as string; parsed to number on save
	frequencyRank: string;
	jlptLevel: JLPTLevel | "";
	sentences: SentenceEntry[];
	kanjiBreakdown: KanjiEntry[];
	picture: string | null;
}

// Hydrate the editable field set from a persisted card. The inverse of
// `buildFieldsData` below — numeric fields collapse to strings for the text
// inputs, and the JLPT null sentinel becomes the empty-string select value.
export function fieldsFromCard(card: ApiCard): CardFields {
	const wf = getWordFields(card);
	const vf = getVocabularyFields(card);
	return {
		// Non-null in practice — the page redirects when deckId is null.
		deckId: card.deckId ?? "",
		word: wf?.word ?? "",
		reading: wf?.reading ?? "",
		meaning: wf?.meaning ?? "",
		partOfSpeech: wf?.partOfSpeech ?? "",
		nuance: wf?.nuance ?? "",
		mnemonic: wf?.mnemonic ?? "",
		pitchAccent: vf?.pitchAccent ?? "",
		pitchPosition: wf?.pitchPosition != null ? String(wf.pitchPosition) : "",
		frequencyRank: wf?.frequencyRank != null ? String(wf.frequencyRank) : "",
		jlptLevel: card.jlptLevel ?? "",
		sentences: (vf?.exampleSentences ?? []).map(s => ({ id: nextRowKey(), ja: s.ja, en: s.en, furigana: s.furigana })),
		kanjiBreakdown: (vf?.kanjiBreakdown ?? []).map(k => ({ id: nextRowKey(), kanji: k.kanji, radical: k.radical ?? "", meaning: k.meaning, reading: k.reading })),
		picture: wf?.picture ?? null,
	};
}

export const JLPT_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
	{ value: "", label: "No level set" },
	{ value: "N5", label: "N5" },
	{ value: "N4", label: "N4" },
	{ value: "N3", label: "N3" },
	{ value: "N2", label: "N2" },
	{ value: "N1", label: "N1" },
	{ value: "beyond_jlpt", label: "Beyond JLPT" },
];

// Sourced from the shared enums so the selector, the AI prompt, and the
// structured-output validation stay in lockstep.
export const POS_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
	{ value: "", label: "Not set" },
	...partOfSpeechEnum.options.map(v => ({ value: v, label: v })),
];

const PITCH_LABELS: Record<string, string> = {
	heiban: "Heiban (平板)",
	atamadaka: "Atamadaka (頭高)",
	nakadaka: "Nakadaka (中高)",
	odaka: "Odaka (尾高)",
};
export const PITCH_OPTIONS: ReadonlyArray<TomoSelectOption<string>> = [
	{ value: "", label: "Not set" },
	...pitchPatternEnum.options.map(v => ({ value: v, label: PITCH_LABELS[v] ?? v })),
];

// ── Synthetic preview card ────────────────────────────────────────────────────

// Shared by the synthetic preview card and the update payload — keeps
// "what we send to the backend" and "what the preview renders" in lockstep.
export function buildFieldsData(fields: CardFields): Record<string, unknown> {
	// Each authored sentence with a non-empty Japanese line becomes an
	// exampleSentences entry; furigana falls back to the plain sentence.
	const examples = fields.sentences
		.filter(s => s.ja.trim().length > 0)
		.map(s => ({ ja: s.ja, en: s.en, furigana: s.furigana || s.ja }));

	const fieldsData: Record<string, unknown> = {
		word: fields.word,
		reading: fields.reading,
		meaning: fields.meaning,
		partOfSpeech: fields.partOfSpeech,
		mnemonic: fields.mnemonic,
		nuance: fields.nuance,
		pitchAccent: fields.pitchAccent,
	};
	if (examples.length > 0)
		fieldsData.exampleSentences = examples;
	if (fields.picture !== null)
		fieldsData.picture = fields.picture;
	if (fields.kanjiBreakdown.length > 0)
		fieldsData.kanjiBreakdown = fields.kanjiBreakdown.filter(k => k.kanji.trim().length > 0).map(k => ({ kanji: k.kanji, radical: k.radical, meaning: k.meaning, reading: k.reading }));
	const freq = Number(fields.frequencyRank); if (Number.isFinite(freq) && freq > 0)
		fieldsData.frequencyRank = freq;
	const pos = Number(fields.pitchPosition); if (Number.isFinite(pos))
		fieldsData.pitchPosition = pos;

	return fieldsData;
}

export function buildPreviewCard(fields: CardFields, layoutType: ApiCard["layoutType"]): ApiDueCard {
	// The `ApiDueCard.fieldsData` type is the tight `FieldsData` union; the
	// unknown-cast is safe because `buildFieldsData` always populates
	// word/reading/meaning — the runtime shape matches the WordFields arm of
	// the union for both vocabulary and grammar layouts.
	return {
		id: "preview-card",
		deckId: "preview-deck",
		jlptLevel: fields.jlptLevel === "" ? null : fields.jlptLevel,
		state: 0,
		due: new Date().toISOString(),
		layoutType,
		fieldsData: buildFieldsData(fields) as unknown as ApiDueCard["fieldsData"],
	};
}

export interface DeckOption { id: string; name: string }
