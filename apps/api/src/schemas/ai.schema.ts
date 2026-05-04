import { z } from 'zod'

export const generateCardInputSchema = z.object({
  word: z.string().trim().min(1, 'Word is required').max(50, 'Word must be at most 50 characters'),
}).strict()

export const GeneratedCardDataSchema = z.object({
  word:             z.string(),
  reading:          z.string(),
  meaning:          z.string(),
  partOfSpeech:     z.string().optional(),
  exampleSentences: z.array(
    z.object({ ja: z.string(), en: z.string(), furigana: z.string() }),
  ).optional(),
  kanjiBreakdown:   z.array(
    z.object({ kanji: z.string(), meaning: z.string() }),
  ).optional(),
  pitchAccent:      z.string().optional(),
  mnemonic:         z.string().optional(),
})

export const generateSentencesInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  count:  z.number().int().min(1).max(5).optional(),
}).strict()

export const GeneratedSentencesSchema = z.object({
  sentences: z.array(
    z.object({ ja: z.string(), en: z.string(), furigana: z.string() }),
  ),
})

export const generateMnemonicInputSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
}).strict()

export const GeneratedMnemonicSchema = z.object({
  mnemonic: z.string(),
})

export type GenerateCardInput        = z.infer<typeof generateCardInputSchema>
export type GeneratedCardData        = z.infer<typeof GeneratedCardDataSchema>
export type GenerateSentencesInput   = z.infer<typeof generateSentencesInputSchema>
export type GeneratedSentences       = z.infer<typeof GeneratedSentencesSchema>
export type GenerateMnemonicInput    = z.infer<typeof generateMnemonicInputSchema>
export type GeneratedMnemonic        = z.infer<typeof GeneratedMnemonicSchema>
