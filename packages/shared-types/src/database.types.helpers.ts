/**
 * Type helpers for Supabase-generated database.types.ts
 *
 * The `supabase gen types typescript` command generates types from the live
 * schema, but loses type specificity for:
 * - JSONB columns (cards.fields_data, cards.tokens, grammar_patterns.example_sentences)
 * - pgvector columns (cards.embedding) — generated as string or missing
 *
 * This file provides TypeScript helpers to override generated types with more
 * specific ones, enabling full type safety when working with the Supabase client.
 *
 * Usage in your services:
 *
 *   import type { Database } from './database.types';
 *   import type { TypedCard, TypedCardRow } from './database.types.helpers';
 *
 *   // For RPC returns or direct table queries:
 *   const card = await supabase
 *     .from('cards')
 *     .select()
 *     .eq('id', cardId)
 *     .single();
 *
 *   // Cast to typed version:
 *   const typed = card.data as TypedCardRow;
 */

import type { ExampleSentence, KanjiBreakdown, Mnemonic } from './card.types.ts'
import type { Database } from './database.types.ts'

// ============================================================
// JSONB Column Shapes
// ============================================================

/**
 * cards.fields_data JSONB shape for vocabulary and grammar layouts.
 * Used by layout_type = 'vocabulary' and 'grammar'.
 */
export interface WordFields {
  word: string
  reading: string
  meaning: string
  partOfSpeech?: string | null
  frequencyRank?: number | null
}

/**
 * Comprehensive fields_data for vocabulary (all optional nested structures).
 * Includes AI-generated content and user-provided enhancements.
 */
export interface VocabularyFieldsData extends WordFields {
  exampleSentences?: ExampleSentence[]
  kanjiBreakdown?: KanjiBreakdown[]
  pitchAccent?: string | null
  mnemonics?: Mnemonic[]
  collocations?: string[]
  homophones?: string[]
}

/**
 * Grammar pattern fields_data shape (uses same word/reading/meaning structure).
 */
export interface GrammarFieldsData extends WordFields {
  exampleSentences?: ExampleSentence[]
}

/**
 * Sentence layout fields_data (reserved for future use).
 * Not yet in production; accept any shape.
 */
export type SentenceFieldsData = Record<string, unknown>

/**
 * Union of all possible fields_data shapes by layout_type.
 * Discriminate by layout_type field on the parent card:
 *
 *   if (card.layout_type === 'vocabulary') {
 *     const fields = card.fields_data as VocabularyFieldsData;
 *   }
 */
export type FieldsData = VocabularyFieldsData | GrammarFieldsData | SentenceFieldsData

/**
 * cards.tokens JSONB shape — morphological analysis output from MeCab/UniDic.
 * Array of token objects, each with linguistic metadata.
 */
export interface MorphToken {
  surface: string          // Original surface form
  pos: string             // Part-of-speech (e.g. "名詞", "動詞")
  pos1?: string           // POS subcategory
  base: string            // Lemma / dictionary form
  reading?: string        // Hiragana reading
  pronunciation?: string  // Actual pronunciation
}

export type TokensData = MorphToken[]

/**
 * grammar_patterns.example_sentences JSONB shape.
 * Same as cards.example_sentences.
 */
export type ExampleSentencesData = ExampleSentence[]

// ============================================================
// Typed Row Overrides
// ============================================================

/**
 * cards table row with properly typed JSONB and vector columns.
 *
 * Use this in place of Database['public']['Tables']['cards']['Row']
 * when you need full type safety for JSONB and vector fields.
 *
 * Example:
 *   const card = (await supabase.from('cards').select().single()).data as TypedCardRow;
 *   const fields = card.fields_data as VocabularyFieldsData;
 *   const embedding = card.embedding; // number[] | null (not string)
 */
export type TypedCardRow = Omit<
  Database['public']['Tables']['cards']['Row'],
  'fields_data' | 'tokens' | 'embedding'
> & {
  fields_data: FieldsData
  tokens: TokensData
  embedding: number[] | null // pgvector(1536) → number array, not string
}

/**
 * grammar_patterns table row with typed example_sentences JSONB.
 */
export type TypedGrammarPatternRow = Omit<
  Database['public']['Tables']['grammar_patterns']['Row'],
  'example_sentences'
> & {
  example_sentences: ExampleSentencesData
}

/**
 * review_logs table row with properly typed before-snapshot fields.
 * All before-snapshot columns are nullable (logs from pre-migration records).
 */
export type TypedReviewLogRow = Omit<
  Database['public']['Tables']['review_logs']['Row'],
  'state_before' | 'stability_before' | 'difficulty_before' | 'due_before' |
  'scheduled_days_before' | 'learning_steps_before' | 'elapsed_days_before' |
  'last_review_before' | 'reps_before' | 'lapses_before'
> & {
  state_before: number | null
  stability_before: number | null
  difficulty_before: number | null
  due_before: string | null // TIMESTAMPTZ → ISO 8601 string
  scheduled_days_before: number | null
  learning_steps_before: number | null
  elapsed_days_before: number | null
  last_review_before: string | null
  reps_before: number | null
  lapses_before: number | null
}

// ============================================================
// RPC Return Type Helpers
// ============================================================

/**
 * Return type from get_milestone_forecast(p_user_id) RPC.
 * Note: daily_pace is now FLOAT8 (not NUMERIC) as of migration 20260505000000.
 */
export interface MilestoneForecastRow {
  jlpt_level: string
  total: number // BIGINT → number
  learned: number
  daily_pace: number // FLOAT8 → number (was NUMERIC → string)
  days_remaining: number | null
  projected_completion_date: string | null // DATE → ISO 8601 string
}

/**
 * Return type from get_heatmap_data(p_user_id) RPC.
 */
export interface HeatmapDataRow {
  date: string
  retention: number
  count: number
}

/**
 * Return type from get_accuracy_by_layout(p_user_id) RPC.
 */
export interface AccuracyByLayoutRow {
  layout: string // card_type cast to TEXT
  total: number
  successful: number
}

/**
 * Return type from get_streak(p_user_id) RPC.
 */
export interface StreakRow {
  current_streak: number
  longest_streak: number
  last_review_date: string | null // DATE → ISO 8601 string
}

/**
 * Return type from get_jlpt_gap(p_user_id) RPC.
 */
export interface JlptGapRow {
  jlpt_level: string
  total: number
  learned: number
  due: number
}

/**
 * Return type from find_similar_cards(p_card_id, p_user_id, p_limit) RPC.
 */
export interface SimilarCardRow {
  id: string
  deck_id: string
  layout_type: string
  card_type: string
  fields_data: FieldsData // Typed JSONB
  tags: string[] | null
  jlpt_level: string | null
  similarity: number // Cosine distance
}

// ============================================================
// Type Assertion Helpers
// ============================================================

/**
 * Safely cast a card row to a typed row, validating critical fields exist.
 *
 * Usage:
 *   const row = (await supabase.from('cards').select().single()).data;
 *   const typed = assertCardRow(row);
 */
export function assertCardRow(row: unknown): TypedCardRow {
  if (!row || typeof row !== 'object') {
    throw new Error('Expected a row object')
  }
  const r = row as Record<string, unknown>
  if (!r.id || !r.fields_data) {
    throw new Error('Row missing required fields (id, fields_data)')
  }
  return row as TypedCardRow
}

/**
 * Safely cast review_logs row, ensuring before-snapshot fields are nullable.
 */
export function assertReviewLogRow(row: unknown): TypedReviewLogRow {
  if (!row || typeof row !== 'object') {
    throw new Error('Expected a row object')
  }
  const r = row as Record<string, unknown>
  // card_id is nullable since migration 20260504000004 (ON DELETE SET NULL).
  if (!r.id || !r.rating) {
    throw new Error('Row missing required review_log fields')
  }
  return row as TypedReviewLogRow
}

// Note: All types are exported from index.ts for convenient access.
