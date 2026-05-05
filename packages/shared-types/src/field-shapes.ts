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
 * Discriminate by the parent card's layout_type field:
 *
 *   if (card.layoutType === 'vocabulary') {
 *     const fields = card.fieldsData as VocabularyFieldsData
 *   }
 */
export type FieldsData = VocabularyFieldsData | GrammarFieldsData | SentenceFieldsData
