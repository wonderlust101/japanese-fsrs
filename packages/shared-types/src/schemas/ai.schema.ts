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
    z.object({ ja: safeStr, en: safeStr, furigana: safeStr }),
  ).optional(),
  kanjiBreakdown:   z.array(
    z.object({ kanji: safeStr, meaning: safeStr }),
  ).optional(),
  pitchAccent:      safeStr.optional(),
  mnemonic:         safeStr.optional(),
})

export const generateSentencesInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  count:  z.number().int().min(1).max(5).optional(),
}).strict()

export const GeneratedSentencesSchema = z.object({
  sentences: z.array(
    z.object({ ja: safeStr, en: safeStr, furigana: safeStr }),
  ),
})

export const generateMnemonicInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
}).strict()

export const GeneratedMnemonicSchema = z.object({
  mnemonic: safeStr,
})

export type GenerateCardInput        = z.infer<typeof generateCardInputSchema>
export type GeneratedCardData        = z.infer<typeof GeneratedCardDataSchema>
export type GenerateSentencesInput   = z.infer<typeof generateSentencesInputSchema>
export type GeneratedSentences       = z.infer<typeof GeneratedSentencesSchema>
export type GenerateMnemonicInput    = z.infer<typeof generateMnemonicInputSchema>
export type GeneratedMnemonic        = z.infer<typeof GeneratedMnemonicSchema>
