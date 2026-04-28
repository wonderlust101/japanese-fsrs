import OpenAI from 'openai'
import { createHash } from 'node:crypto'

import { redis } from '../db/redis.ts'
import { GeneratedCardDataSchema } from '../schemas/ai.schema.ts'
import { AppError } from '../middleware/errorHandler.ts'
import type { GeneratedCardData } from '../schemas/ai.schema.ts'

// ─── OpenAI client ────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env['OPENAI_API_KEY'] })

// ─── Cache ────────────────────────────────────────────────────────────────────

const CARD_CACHE_TTL = 60 * 60 * 24 * 7  // 7 days — per TDD §10.1

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
