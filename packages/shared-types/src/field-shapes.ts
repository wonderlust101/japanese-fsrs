/**
 * Content shapes for `ApiCard.fieldsData` (the JSONB column on `cards`).
 * These cross the wire — the frontend may discriminate on layout type and
 * read the specific fields. Shapes are derived from Zod schemas in
 * `schemas/field-shapes.schema.ts` so the validator and the type cannot drift.
 */

import type { z } from "zod";

import type { LayoutType } from "./card.types.ts";
import type {
	FieldsDataSchema,
	GrammarFieldsDataSchema,
	SentenceFieldsDataSchema,
	VocabularyFieldsDataSchema,
	WordFieldsSchema,
} from "./schemas/field-shapes.schema.ts";

/** Common base for vocabulary and grammar layouts. */
export type WordFields = z.infer<typeof WordFieldsSchema>;

/** fields_data shape for layout_type = 'vocabulary'. */
export type VocabularyFieldsData = z.infer<typeof VocabularyFieldsDataSchema>;

/** fields_data shape for layout_type = 'grammar'. */
export type GrammarFieldsData = z.infer<typeof GrammarFieldsDataSchema>;

/** fields_data shape for layout_type = 'sentence' (reserved for future use). */
export type SentenceFieldsData = z.infer<typeof SentenceFieldsDataSchema>;

/**
 * Discriminated union of all `fields_data` shapes by layout_type.
 * Use `getWordFields` / `getVocabularyFields` to narrow at the consumer site
 * instead of widening to `Record<string, unknown>`.
 */
export type FieldsData = z.infer<typeof FieldsDataSchema>;

/** Narrow input — anything carrying both layoutType and fieldsData. */
interface FieldsCarrier { layoutType: LayoutType; fieldsData: FieldsData }

/**
 * Returns the shared word/reading/meaning fields when the card is vocabulary
 * or grammar; null for sentence-layout cards. The DB CHECK constraint
 * (cards_fields_data_shape) enforces presence of these keys, so the cast
 * inside this helper is safe at runtime.
 */
export function getWordFields(card: FieldsCarrier): WordFields | null {
	if (card.layoutType === "vocabulary" || card.layoutType === "grammar") {
		return card.fieldsData as WordFields;
	}
	return null;
}

/** Returns vocabulary-only fields (example sentences, kanji breakdown, etc.) or null. */
export function getVocabularyFields(card: FieldsCarrier): VocabularyFieldsData | null {
	return card.layoutType === "vocabulary" ? (card.fieldsData as VocabularyFieldsData) : null;
}

/**
 * Returns the full typed `SentenceFieldsData` payload for sentence-layout
 * cards, or null otherwise. Use this when a consumer needs `furigana`,
 * `audio`, `breakdown`, or `nuance` in addition to the `{ja, en}` pair —
 * it avoids the `Record<string, unknown>` cast pattern at the call site.
 *
 * The DB CHECK constraint `cards_fields_data_shape` enforces `ja`, `en`,
 * and `furigana` presence at the JSONB layer for sentence-layout cards,
 * so the cast inside this helper is safe at runtime (mirrors the same
 * pattern as `getWordFields`).
 */
export function getSentenceFields(card: FieldsCarrier): SentenceFieldsData | null {
	return card.layoutType === "sentence" ? (card.fieldsData as SentenceFieldsData) : null;
}

/**
 * Returns the typed front/back text for sentence-layout cards. After
 * Backend Completion Plan Stage 12, the canonical sentence shape carries
 * `ja` (front) and `en` (back) — both enforced as required keys by the
 * `cards_fields_data_shape` DB CHECK constraint and by
 * `SentenceFieldsDataSchema`. Returns null for non-sentence layouts.
 *
 * Convenience wrapper over `getSentenceFields` preserved for the
 * `{ front, back }` consumer contract that predates the open-shape
 * narrowing.
 */
export function getSentenceFrontBack(card: FieldsCarrier): { front: string; back: string } | null {
	const fd = getSentenceFields(card);
	return fd === null ? null : { front: fd.ja, back: fd.en };
}
