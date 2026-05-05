/**
 * Zod schemas for the `fields_data` JSONB column on `cards` and the small
 * content shapes nested inside it. These cross the API → web wire so they
 * need runtime validation; the TS types live alongside as `z.infer` aliases
 * (see field-shapes.ts).
 */

import { z } from 'zod'

export const ExampleSentenceSchema = z.object({
  ja:       z.string(),
  en:       z.string(),
  furigana: z.string(),
})

export const KanjiBreakdownSchema = z.object({
  kanji:   z.string(),
  radical: z.string(),
  meaning: z.string(),
  reading: z.string(),
})

/** Common base for vocabulary and grammar layouts. */
export const WordFieldsSchema = z.object({
  word:           z.string(),
  reading:        z.string(),
  meaning:        z.string(),
  partOfSpeech:   z.string().nullable().optional(),
  frequencyRank:  z.number().nullable().optional(),
})

export const VocabularyFieldsDataSchema = WordFieldsSchema.extend({
  exampleSentences: z.array(ExampleSentenceSchema).optional(),
  kanjiBreakdown:   z.array(KanjiBreakdownSchema).optional(),
  pitchAccent:      z.string().nullable().optional(),
  collocations:     z.array(z.string()).optional(),
  homophones:       z.array(z.string()).optional(),
})

export const GrammarFieldsDataSchema = WordFieldsSchema.extend({
  exampleSentences: z.array(ExampleSentenceSchema).optional(),
})

/** Sentence-layout cards have an open shape (reserved for future use). */
export const SentenceFieldsDataSchema = z.record(z.string(), z.unknown())

/**
 * Wire-format `fields_data` — a union by layout_type. The DB CHECK constraint
 * `cards_fields_data_shape` enforces vocabulary/grammar carry the WordFields
 * keys, so the union is non-discriminated at the JSON level (the discriminator
 * lives on the parent card's `layoutType`).
 */
export const FieldsDataSchema = z.union([
  VocabularyFieldsDataSchema,
  GrammarFieldsDataSchema,
  SentenceFieldsDataSchema,
])
