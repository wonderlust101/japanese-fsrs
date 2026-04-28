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

export type GenerateCardInput = z.infer<typeof generateCardInputSchema>
export type GeneratedCardData = z.infer<typeof GeneratedCardDataSchema>
