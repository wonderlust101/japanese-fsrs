/**
 * Content shapes for `ApiCard.fieldsData` (the JSONB column on `cards`).
 * These cross the wire — the frontend may discriminate on layout type and
 * read the specific fields. Keep narrow: only the keys the UI actually
 * needs to render.
 */

import type { ExampleSentence, KanjiBreakdown, Mnemonic } from './card.types.ts'

/** Common base for vocabulary and grammar layouts. */
export interface WordFields {
  word: string
  reading: string
  meaning: string
  partOfSpeech?: string | null
  frequencyRank?: number | null
}

/** fields_data shape for layout_type = 'vocabulary'. */
export interface VocabularyFieldsData extends WordFields {
  exampleSentences?: ExampleSentence[]
  kanjiBreakdown?: KanjiBreakdown[]
  pitchAccent?: string | null
  mnemonics?: Mnemonic[]
  collocations?: string[]
  homophones?: string[]
}

/** fields_data shape for layout_type = 'grammar'. */
export interface GrammarFieldsData extends WordFields {
  exampleSentences?: ExampleSentence[]
}

/** fields_data shape for layout_type = 'sentence' (reserved for future use). */
export type SentenceFieldsData = Record<string, unknown>

/**
 * Discriminated union of all `fields_data` shapes by layout_type.
 * Use `getWordFields` / `getVocabularyFields` to narrow at the consumer site
 * instead of widening to `Record<string, unknown>`.
 */
export type FieldsData = VocabularyFieldsData | GrammarFieldsData | SentenceFieldsData

import type { LayoutType } from './card.types.ts'

/** Narrow input — anything carrying both layoutType and fieldsData. */
type FieldsCarrier = { layoutType: LayoutType; fieldsData: FieldsData }

/**
 * Returns the shared word/reading/meaning fields when the card is vocabulary
 * or grammar; null for sentence-layout cards. The DB CHECK constraint
 * (cards_fields_data_shape) enforces presence of these keys, so the cast
 * inside this helper is safe at runtime.
 */
export function getWordFields(card: FieldsCarrier): WordFields | null {
  if (card.layoutType === 'vocabulary' || card.layoutType === 'grammar') {
    return card.fieldsData as WordFields
  }
  return null
}

/** Returns vocabulary-only fields (example sentences, kanji breakdown, etc.) or null. */
export function getVocabularyFields(card: FieldsCarrier): VocabularyFieldsData | null {
  return card.layoutType === 'vocabulary' ? (card.fieldsData as VocabularyFieldsData) : null
}
