import type { ApiDueCard } from '@fsrs-japanese/shared-types'
import {
  getWordFields,
  getVocabularyFields,
  getSentenceFields,
} from '@fsrs-japanese/shared-types'

// Layout-normalization adapter for the review surface.
//
// `ApiDueCard.fieldsData` is a discriminated union over `layoutType`
// (vocabulary / grammar / sentence). The session card renderer
// (ReviewCard / CardFront / CardBack) consumes a single flattened
// `ResolvedCardFields` shape regardless of layout — this helper does
// the narrowing once and provides safe fallbacks for the
// vocabulary-vs-sentence asymmetry (e.g. `word ?? sentence.front`).
//
// All reads go through the typed shared-types helpers
// (`getWordFields` / `getVocabularyFields` / `getSentenceFields`); no
// `Record<string, unknown>` widening at the consumer site. The fields
// returned here mirror the schemas in
// `packages/shared-types/src/schemas/field-shapes.schema.ts`.

export interface ResolvedCardFields {
  word:            string
  reading:         string | null
  meaning:         string
  partOfSpeech:    string | null
  mnemonic:        string | null
  /**
   * AI-authored prose explaining usage register, connotation, and synonym
   * distinctions. Renders as the first tab on the back of the card.
   * Sourced from `WordFieldsSchema.nuance` (vocabulary / grammar) or
   * `SentenceFieldsDataSchema.nuance` (sentence layout).
   */
  nuance:          string | null
  frequencyRank:   number | null
  pitchPosition:   number | null
  pitchAccent:     string | null
  picture:         string | null
  kanjiBreakdown:  Array<{ kanji: string; radical: string; meaning?: string; reading?: string }>
  exampleSentence: {
    ja:        string
    en:        string
    furigana:  string
  } | null
  jlptLevel:       string | null
}

// FNV-1a string hash → unsigned 32-bit. Deterministic and dependency-free.
// Drives example-sentence rotation: seeding from `card.id + card.due` gives a
// stable pick within a single review (id + due don't change mid-review) that
// varies across reviews (FSRS rewrites `due` after each rating), with no
// server round-trip and identical results across devices.
function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/**
 * @param sentenceIndex Optional explicit example-sentence index. When
 *   provided (e.g. the /add/review preview pager), it overrides rotation and
 *   shows exactly that sentence. When omitted, the back rotates: one sentence
 *   per review, picked stable-randomly from `card.id + card.due`.
 */
export function resolveCardFields(card: ApiDueCard, sentenceIndex?: number): ResolvedCardFields {
  const word     = getWordFields(card)
  const vocab    = getVocabularyFields(card)
  const sentence = getSentenceFields(card)

  // Rotate across the vocabulary card's example sentences (fall back to the
  // sentence-layout shape, which is a single top-level ja/en/furigana rather
  // than a nested array). With N sentences the back shows one per review;
  // an explicit `sentenceIndex` overrides the rotation for preview surfaces.
  const sentences = vocab?.exampleSentences ?? []
  const rotated   = sentences.length === 0
    ? undefined
    : sentences[
        sentenceIndex !== undefined
          ? Math.min(Math.max(sentenceIndex, 0), sentences.length - 1)
          : hashString(`${card.id}|${card.due}`) % sentences.length
      ]
  const example = rotated
  const exampleSentence = example !== undefined
    ? {
        ja:       example.ja,
        en:       example.en,
        furigana: example.furigana,
      }
    : sentence !== null
    ? {
        ja:       sentence.ja,
        en:       sentence.en,
        furigana: sentence.furigana,
      }
    : null

  return {
    word:            word?.word            ?? sentence?.ja ?? '',
    reading:         word?.reading         ?? null,
    meaning:         word?.meaning         ?? sentence?.en ?? '',
    partOfSpeech:    word?.partOfSpeech    ?? null,
    mnemonic:        word?.mnemonic        ?? null,
    nuance:          word?.nuance          ?? sentence?.nuance ?? null,
    frequencyRank:   word?.frequencyRank   ?? null,
    pitchPosition:   word?.pitchPosition   ?? null,
    pitchAccent:     vocab?.pitchAccent    ?? null,
    picture:         word?.picture         ?? null,
    kanjiBreakdown:  vocab?.kanjiBreakdown ?? [],
    exampleSentence,
    jlptLevel:       card.jlptLevel,
  }
}
