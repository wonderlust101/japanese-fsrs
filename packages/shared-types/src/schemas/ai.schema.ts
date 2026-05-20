import { z } from 'zod'

import { stripMarkupTransform } from '../sanitize.ts'

// Strip markup from any LLM-produced string before it's persisted or returned.
// Defence-in-depth: the prompts are JSON-mode and shouldn't yield HTML, but a
// poisoned prompt could try.
const safeStr = z.string().transform(stripMarkupTransform)

export const generateCardInputSchema = z.object({
  word: z.string().trim().min(1, 'Word is required').max(50, 'Word must be at most 50 characters'),
}).strict()

export const GeneratedCardDataSchema = z.object({
  word:             safeStr,
  reading:          safeStr,
  meaning:          safeStr,
  partOfSpeech:     safeStr.optional(),
  exampleSentences: z.array(
    z.object({
      ja:            safeStr,
      en:            safeStr,
      furigana:      safeStr,
      // Mirrors the additive key on `ExampleSentenceSchema` admitted in
      // Stage 1. Not requested by the current prompt — see the Lapis-fields
      // block below for the asset-hosting rationale.
      sentenceAudio: safeStr.optional(),
    }),
  ).optional(),
  // Widened in Backend Completion Plan Stage 3 (CARD_PROMPT_VERSION='v3') to
  // mirror `KanjiBreakdownSchema` on the wire — the storage layer's
  // `cards_fields_data_shape` CHECK expects `{kanji, radical, meaning, reading}`
  // and the v4 review surface renders all four. `radical` + `reading` are
  // marked optional so a model that omits them per-character still parses
  // (the prompt allows opting out per-character).
  kanjiBreakdown:   z.array(
    z.object({
      kanji:   safeStr,
      meaning: safeStr,
      radical: safeStr.optional(),
      reading: safeStr.optional(),
    }),
  ).optional(),
  pitchAccent:      safeStr.optional(),
  mnemonic:         safeStr.optional(),
  // Stage 3 (CARD_PROMPT_VERSION='v3'): admit the two vocabulary-only
  // discrimination fields the review surface renders as standalone tabs.
  // Empty arrays are allowed; the prompt instructs the model to omit
  // entirely when nothing distinctive is available rather than fabricate.
  collocations:     z.array(safeStr).optional(),
  homophones:       z.array(safeStr).optional(),
  // ─── Lapis-style fields (Backend Completion Plan, Stage 2) ──────────────
  // These mirror the additive keys admitted on `WordFieldsSchema` in Stage 1.
  // The schema admits them so the structured-output validation passes when
  // the model populates them; the `generateCard` prompt only requests
  // `pitchPosition` + `nuance` for now. `picture` / `expressionAudio` /
  // `sentenceAudio` stay unmapped at the prompt layer until an asset-hosting
  // story exists — asking the model for a URL it can't fulfill produces
  // hallucinated 404s, which is worse than no field. The schema admits them
  // anyway so a future prompt-version bump or out-of-band populator can land
  // without a second schema change.
  pitchPosition:    z.number().int().nonnegative().optional(),
  nuance:           safeStr.optional(),
  picture:          safeStr.optional(),
  expressionAudio:  safeStr.optional(),
})

export const generateSentencesInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  count:  z.number().int().min(1).max(5).optional(),
}).strict()

export const GeneratedSentencesSchema = z.object({
  sentences: z.array(
    z.object({
      ja:            safeStr,
      en:            safeStr,
      furigana:      safeStr,
      // Optional Lapis-style asset URL; see GeneratedCardDataSchema's
      // exampleSentences entry for the asset-hosting rationale. Admitted
      // so a future prompt-version bump doesn't fail validation.
      sentenceAudio: safeStr.optional(),
    }),
  ),
})

export const generateMnemonicInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
}).strict()

export const GeneratedMnemonicSchema = z.object({
  mnemonic: safeStr,
})

// Diagnosis + prescription output for a weakSpot. The diagnosis identifies *why*
// the card keeps lapsing (ambiguous reading, weak mnemonic, similar-kanji
// confusion, context-thin sentence). The prescription gives the learner one
// concrete next-step fix. Both strings are stripMarkup-transformed defensively
// even though the prompt is JSON-mode.
export const GeneratedWeakSpotDiagnosisSchema = z.object({
  diagnosis:    safeStr,
  prescription: safeStr,
})

/**
 * Structured-output shape for the daily Tomo note (Backend Completion Plan
 * Stage 6). The model returns only the prose body; `kind` and `dateKey` are
 * set by the service layer so the breaker-open fallback path can substitute
 * a curated idiom while keeping the wire envelope identical.
 *
 * `body` is stripMarkup-transformed defensively even though the prompt is
 * JSON-mode — defence in depth against a poisoned prompt that tries to
 * inject HTML / script-like content into a free-form prose field.
 */
export const GeneratedTomoNoteSchema = z.object({
  body: safeStr,
})

/**
 * Structured-output shape for the sentence-layout AI generator (Backend
 * Completion Plan Stage 13). Mirrors `SentenceFieldsDataSchema` admitted
 * by Stage 12 — the model returns ja/en/furigana plus optional breakdown
 * and nuance. The `audio` field stays unmapped at the prompt layer for the
 * same asset-hosting reason that keeps `picture` / `expressionAudio` out
 * of the vocabulary prompt — asking the model for a URL it cannot host
 * yields hallucinated 404s.
 */
export const GeneratedSentenceCardSchema = z.object({
  ja:        safeStr,
  en:        safeStr,
  furigana:  safeStr,
  breakdown: z.array(z.object({
    token:   safeStr,
    reading: safeStr.optional(),
    meaning: safeStr.optional(),
  })).optional(),
  nuance:    safeStr.optional(),
  // Schema admits `audio` for forward compatibility with a future
  // sentence-audio asset story; the current prompt does not request it.
  audio:     safeStr.optional(),
})

export type GenerateCardInput        = z.infer<typeof generateCardInputSchema>
export type GeneratedCardData        = z.infer<typeof GeneratedCardDataSchema>
export type GenerateSentencesInput   = z.infer<typeof generateSentencesInputSchema>
export type GeneratedSentences       = z.infer<typeof GeneratedSentencesSchema>
export type GenerateMnemonicInput    = z.infer<typeof generateMnemonicInputSchema>
export type GeneratedMnemonic        = z.infer<typeof GeneratedMnemonicSchema>
export type GeneratedWeakSpotDiagnosis  = z.infer<typeof GeneratedWeakSpotDiagnosisSchema>
export type GeneratedTomoNote        = z.infer<typeof GeneratedTomoNoteSchema>
export type GeneratedSentenceCard    = z.infer<typeof GeneratedSentenceCardSchema>
