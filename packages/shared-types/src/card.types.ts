import type { z } from 'zod'

import type { CardType } from './fsrs.types.ts'
import type { ExampleSentenceSchema, KanjiBreakdownSchema } from './schemas/field-shapes.schema.ts'

export const JLPTLevel = {
  N5: 'N5',
  N4: 'N4',
  N3: 'N3',
  N2: 'N2',
  N1: 'N1',
  BeyondJLPT: 'beyond_jlpt',
} as const
export type JLPTLevel = typeof JLPTLevel[keyof typeof JLPTLevel]

const JLPT_LEVEL_VALUES = Object.values(JLPTLevel) as readonly string[]
export const isJlptLevel = (v: unknown): v is JLPTLevel =>
  typeof v === 'string' && JLPT_LEVEL_VALUES.includes(v)

/** Discriminator for cards.fields_data shape. Mirrors the layout_type enum on
 *  the cards table (introduced in migration 20260502000004_align_card_schema). */
export const LayoutType = {
  Vocabulary: 'vocabulary',
  Grammar:    'grammar',
  Sentence:   'sentence',
} as const
export type LayoutType = typeof LayoutType[keyof typeof LayoutType]

/** Single example sentence — kana/kanji form, English gloss, and furigana annotations. */
export type ExampleSentence = z.infer<typeof ExampleSentenceSchema>

/** Per-kanji breakdown of a vocabulary item. */
export type KanjiBreakdown = z.infer<typeof KanjiBreakdownSchema>

export type { CardType }
