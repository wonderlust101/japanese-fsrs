import type { ApiDueCard } from '@fsrs-japanese/shared-types'
import {
  getWordFields,
  getVocabularyFields,
  getSentenceFrontBack,
} from '@fsrs-japanese/shared-types'

// Optional Lapis-style fields the review surface knows how to render but the
// API schema does not yet expose. Sourced from card `fieldsData` when present
// (e.g. via dev fixtures, or once the backend ships them per the kanban
// follow-up). Production cards typically have these as undefined; consumers
// must handle absence gracefully.
//
// Keeping the optional read in one helper makes it easy to delete this file
// the day the schema is widened: the rest of the UI just consumes the
// returned shape.

export interface ResolvedCardFields {
  word:            string
  reading:         string | null
  meaning:         string
  partOfSpeech:    string | null
  mnemonic:        string | null
  /**
   * AI-authored prose explaining usage register, connotation, and synonym
   * distinctions. Renders as the first tab on the back of the card.
   * Currently sourced from `fieldsData.nuance` via a runtime read; the
   * schema follow-up will land this on WordFieldsSchema properly.
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

function asString(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null
}

function asNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function resolveCardFields(card: ApiDueCard): ResolvedCardFields {
  const word     = getWordFields(card)
  const vocab    = getVocabularyFields(card)
  const sentence = getSentenceFrontBack(card)
  const raw      = card.fieldsData as Record<string, unknown>

  const example  = vocab?.exampleSentences?.[0]
  const sentenceAudio = example !== undefined
    ? asString((example as unknown as { audio?: unknown }).audio)
    : null

  const exampleSentence = example !== undefined
    ? {
        ja:       example.ja,
        en:       example.en,
        furigana: example.furigana,
        audio:    sentenceAudio,
      }
    : sentence !== null
    ? {
        ja:       sentence.front,
        en:       sentence.back,
        furigana: asString(raw.furigana) ?? sentence.front,
        audio:    asString(raw.sentenceAudio),
      }
    : null

  return {
    word:            word?.word    ?? sentence?.front ?? '',
    reading:         word?.reading ?? null,
    meaning:         word?.meaning ?? sentence?.back ?? '',
    partOfSpeech:    word?.partOfSpeech ?? null,
    mnemonic:        word?.mnemonic    ?? null,
    nuance:          asString(raw.nuance),
    frequencyRank:   word?.frequencyRank ?? null,
    pitchPosition:   asNumber(raw.pitchPosition),
    pitchAccent:     asString(raw.pitchAccent),
    expressionAudio: asString(raw.expressionAudio),
    picture:         asString(raw.picture),
    collocations:    vocab?.collocations ?? [],
    homophones:      vocab?.homophones   ?? [],
    kanjiBreakdown:  vocab?.kanjiBreakdown ?? [],
    exampleSentence,
    jlptLevel:       card.jlptLevel,
  }
}
