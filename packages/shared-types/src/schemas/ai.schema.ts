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
  kanjiBreakdown:   z.array(
    z.object({ kanji: safeStr, meaning: safeStr }),
  ).optional(),
  pitchAccent:      safeStr.optional(),
  mnemonic:         safeStr.optional(),
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

// Diagnosis + prescription output for a leech. The diagnosis identifies *why*
// the card keeps lapsing (ambiguous reading, weak mnemonic, similar-kanji
// confusion, context-thin sentence). The prescription gives the learner one
// concrete next-step fix. Both strings are stripMarkup-transformed defensively
// even though the prompt is JSON-mode.
export const GeneratedLeechDiagnosisSchema = z.object({
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

export type GenerateCardInput        = z.infer<typeof generateCardInputSchema>
export type GeneratedCardData        = z.infer<typeof GeneratedCardDataSchema>
export type GenerateSentencesInput   = z.infer<typeof generateSentencesInputSchema>
export type GeneratedSentences       = z.infer<typeof GeneratedSentencesSchema>
export type GenerateMnemonicInput    = z.infer<typeof generateMnemonicInputSchema>
export type GeneratedMnemonic        = z.infer<typeof GeneratedMnemonicSchema>
export type GeneratedLeechDiagnosis  = z.infer<typeof GeneratedLeechDiagnosisSchema>
export type GeneratedTomoNote        = z.infer<typeof GeneratedTomoNoteSchema>
