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
  expressionAudio: string | null
  picture:         string | null
  collocations:    string[]
  homophones:      string[]
  kanjiBreakdown:  Array<{ kanji: string; radical: string; meaning?: string; reading?: string }>
  exampleSentence: {
    ja:        string
    en:        string
    furigana:  string
    audio:     string | null
  } | null
  jlptLevel:       string | null
}

export function resolveCardFields(card: ApiDueCard): ResolvedCardFields {
  const word     = getWordFields(card)
  const vocab    = getVocabularyFields(card)
  const sentence = getSentenceFields(card)

  // Prefer the first example sentence on a vocabulary card; fall back to the
  // sentence-layout shape (different shape entirely — top-level ja/en/furigana
  // rather than a nested exampleSentences[] array).
  const example = vocab?.exampleSentences?.[0]
  const exampleSentence = example !== undefined
    ? {
        ja:       example.ja,
        en:       example.en,
        furigana: example.furigana,
        // ExampleSentenceSchema's audio key is `sentenceAudio`. The previous
        // implementation read `.audio` here (the sentence-layout's key name)
        // and silently returned null; see the audit trail in the kanban Done
        // entry for Stage 3.
        audio:    example.sentenceAudio ?? null,
      }
    : sentence !== null
    ? {
        ja:       sentence.ja,
        en:       sentence.en,
        furigana: sentence.furigana,
        // SentenceFieldsDataSchema uses `audio` (not `sentenceAudio`) — the
        // two shapes are intentionally distinct: example-sentences are
        // nested inside vocabulary cards, sentence-layout is the card.
        audio:    sentence.audio ?? null,
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
    expressionAudio: word?.expressionAudio ?? null,
    picture:         word?.picture         ?? null,
    collocations:    vocab?.collocations   ?? [],
    homophones:      vocab?.homophones     ?? [],
    kanjiBreakdown:  vocab?.kanjiBreakdown ?? [],
    exampleSentence,
    jlptLevel:       card.jlptLevel,
  }
}
