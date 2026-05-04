import OpenAI from 'openai'
import { createHash } from 'node:crypto'

import { redis } from '../db/redis.ts'
import {
  GeneratedCardDataSchema,
  GeneratedSentencesSchema,
  GeneratedMnemonicSchema,
} from '../schemas/ai.schema.ts'
import { AppError } from '../middleware/errorHandler.ts'
import type {
  GeneratedCardData,
  GeneratedSentences,
  GeneratedMnemonic,
} from '../schemas/ai.schema.ts'

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })

// ─── Cache ────────────────────────────────────────────────────────────────────

const CARD_CACHE_TTL      = 60 * 60 * 24 * 7    // 7 days — per TDD §10.1
const SENTENCES_CACHE_TTL = 60 * 60 * 24 * 7    // 7 days
const MNEMONIC_CACHE_TTL  = 60 * 60 * 24 * 30   // 30 days — per TDD §10.1

// ─── Internal helpers ─────────────────────────────────────────────────────────

function sanitize(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}

function hashInterests(interests: string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...interests].sort()))
    .digest('hex')
    .slice(0, 16)
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Generates structured card data for a Japanese word.
 *
 * Cache key: `card:{word}:{userLevel}:{interestsHash}` — shared across all
 * users with the same level and interest profile to maximise cache hits.
 * TTL: 7 days.
 *
 * Throws AppError(502) if OpenAI returns an empty response.
 * Throws ZodError if the response shape does not match `GeneratedCardDataSchema`.
 */
export async function generateCard(
  word: string,
  userLevel: string,
  interests: string[],
): Promise<GeneratedCardData> {
  const safeWord      = sanitize(word)
  const safeLevel     = sanitize(userLevel)
  const safeInterests = interests.map(sanitize)

  const cacheKey = `card:${safeWord}:${safeLevel}:${hashInterests(safeInterests)}`

  const cached = await redis.get<unknown>(cacheKey)
  if (cached !== null) {
    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached
    return GeneratedCardDataSchema.parse(payload)
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a Japanese language expert generating SRS card data.
Always respond with valid JSON.
User level: ${safeLevel}. User interests: ${safeInterests.join(', ')}.
Generate content appropriate for the user's level and interests.`,
      },
      {
        role: 'user',
        content: `Generate complete card data for the Japanese word: ${safeWord}

Return JSON with these keys:
{
  "word": string,
  "reading": string (hiragana/katakana reading),
  "meaning": string (English meaning),
  "partOfSpeech": string,
  "exampleSentences": [{ "ja": string, "en": string, "furigana": string }],
  "kanjiBreakdown": [{ "kanji": string, "meaning": string }],
  "pitchAccent": string,
  "mnemonic": string (memorable association for ${safeLevel} learner)
}`,
      },
    ],
  })

  const raw = response.choices[0]?.message.content
  if (raw === null || raw === undefined) {
    throw new AppError(502, 'OpenAI returned an empty response')
  }

  const result = GeneratedCardDataSchema.parse(JSON.parse(raw))
  await redis.set(cacheKey, JSON.stringify(result), { ex: CARD_CACHE_TTL })
  return result
}

/**
 * Generates fresh example sentences for a Japanese word.
 *
 * Cache key: `sentences:{word}:{userLevel}:{interestsHash}:{count}` — shared
 * across users with the same level/interests profile to maximise cache hits.
 * TTL: 7 days.
 */
export async function generateSentences(
  word:       string,
  userLevel:  string,
  interests:  string[],
  count:      number,
): Promise<GeneratedSentences> {
  const safeWord      = sanitize(word)
  const safeLevel     = sanitize(userLevel)
  const safeInterests = interests.map(sanitize)
  const safeCount     = Math.max(1, Math.min(5, Math.trunc(count)))

  const cacheKey = `sentences:${safeWord}:${safeLevel}:${hashInterests(safeInterests)}:${safeCount}`

  const cached = await redis.get<unknown>(cacheKey)
  if (cached !== null) {
    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached
    return GeneratedSentencesSchema.parse(payload)
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a Japanese language expert generating natural example sentences for SRS flash cards.
Always respond with valid JSON.
User level: ${safeLevel}. User interests: ${safeInterests.join(', ')}.
Sentences must be natural, level-appropriate, and tied to the user's interests when possible.`,
      },
      {
        role: 'user',
        content: `Generate ${safeCount} fresh example sentences for the Japanese word: ${safeWord}

Return JSON with this exact shape:
{
  "sentences": [{ "ja": string, "en": string, "furigana": string }]
}

Constraints:
- Provide exactly ${safeCount} sentences.
- Each "ja" must contain the target word.
- "furigana" should give hiragana readings for kanji compounds in the sentence.
- Vary the grammar pattern across sentences.`,
      },
    ],
  })

  const raw = response.choices[0]?.message.content
  if (raw === null || raw === undefined) {
    throw new AppError(502, 'OpenAI returned an empty response')
  }

  const result = GeneratedSentencesSchema.parse(JSON.parse(raw))
  await redis.set(cacheKey, JSON.stringify(result), { ex: SENTENCES_CACHE_TTL })
  return result
}

/**
 * Generates a fresh mnemonic for a Japanese word, tailored to the user's
 * native language and interests.
 *
 * Cache key: `mnemonic:{word}:{userId}` — user-scoped because mnemonics
 * incorporate personal interests and L1. TTL: 30 days.
 */
export async function generateMnemonic(
  word:           string,
  userId:         string,
  userLevel:      string,
  nativeLanguage: string,
  interests:      string[],
): Promise<GeneratedMnemonic> {
  const safeWord       = sanitize(word)
  const safeLevel      = sanitize(userLevel)
  const safeNative     = sanitize(nativeLanguage)
  const safeInterests  = interests.map(sanitize)

  const cacheKey = `mnemonic:${safeWord}:${userId}`

  const cached = await redis.get<unknown>(cacheKey)
  if (cached !== null) {
    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached
    return GeneratedMnemonicSchema.parse(payload)
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5.4-nano',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a Japanese language tutor crafting memorable mnemonics.
Always respond with valid JSON.
User level: ${safeLevel}. Native language: ${safeNative}. Interests: ${safeInterests.join(', ')}.
Mnemonics must be vivid, link sound + meaning, and reference the user's interests when possible.`,
      },
      {
        role: 'user',
        content: `Generate one memorable mnemonic for the Japanese word: ${safeWord}

Return JSON with this exact shape:
{ "mnemonic": string }

Constraints:
- Keep it under 200 characters.
- Connect the reading to the meaning through a vivid image.
- Use the user's native language for the mnemonic text.`,
      },
    ],
  })

  const raw = response.choices[0]?.message.content
  if (raw === null || raw === undefined) {
    throw new AppError(502, 'OpenAI returned an empty response')
  }

  const result = GeneratedMnemonicSchema.parse(JSON.parse(raw))
  await redis.set(cacheKey, JSON.stringify(result), { ex: MNEMONIC_CACHE_TTL })
  return result
}
