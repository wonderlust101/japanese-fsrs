import { createHash } from 'node:crypto'
import type { ZodType } from 'zod'

import { redis } from '../db/redis.ts'
import { env }   from '../lib/env.ts'
import { openai } from '../lib/openai.ts'
import {
  GeneratedCardDataSchema,
  GeneratedSentencesSchema,
  GeneratedMnemonicSchema,
  GeneratedLeechDiagnosisSchema,
  sanitizeForPrompt,
  type GeneratedCardData,
  type GeneratedSentences,
  type GeneratedMnemonic,
  type GeneratedLeechDiagnosis,
} from '@fsrs-japanese/shared-types'
import { componentLogger } from '../lib/logger.ts'
import { withBreaker } from '../lib/circuit-breaker.ts'
import { openaiSemaphore } from '../lib/openai.ts'
import { scrubKeyish } from '../lib/scrub.ts'
import { AppError } from '../middleware/errorHandler.ts'

/** Shared breaker namespace for chat-completion calls (card / sentences / mnemonic
 *  all hit the same OpenAI completions backend, so one shared breaker is correct). */
const CHAT_BREAKER = 'openai-chat'

/** Single user-facing 503 message for all AI degradation paths (open breaker
 *  or inline failure). Per-failure-mode messages don't help the end user — they
 *  just need "retry shortly." Diagnostic specifics live in server logs. */
const CHAT_UNAVAILABLE_MSG = 'AI service temporarily unavailable; please retry shortly'

const log = componentLogger('ai.service')

// `scrubKeyish` lives in lib/scrub.ts so the global error handler can apply
// the same redaction at its log boundaries (defense-in-depth: the inline
// log here scrubs SDK 401 messages locally; lib/scrub.ts catches anything
// that slips past as `cause` on a wrapped error).

// `openai` is the shared OpenAI client from lib/openai.ts — same instance
// used by card.service.ts for embeddings. Null when OPENAI_API_KEY is unset.

const CHAT_MODEL = env.OPENAI_CHAT_MODEL

// ─── Cache ────────────────────────────────────────────────────────────────────

const CARD_CACHE_TTL      = 60 * 60 * 24 * 7    // 7 days — per TDD §10.1
const SENTENCES_CACHE_TTL = 60 * 60 * 24 * 7    // 7 days
const MNEMONIC_CACHE_TTL  = 60 * 60 * 24 * 30   // 30 days — per TDD §10.1
// Diagnosis is leech-specific (driven by lapse pattern) and stays valid only
// while the underlying card and review history are stable. 30 days is the
// same TTL as mnemonics — both are advisory text that doesn't need to be
// re-derived on every retry.
const DIAGNOSIS_CACHE_TTL = 60 * 60 * 24 * 30

// Bump when the diagnosis prompt's system or user message changes in a way
// that should produce different output. The version becomes part of the
// cache key, so entries written under the old prompt are not served against
// the new prompt — they simply don't match the new key, the next call
// regenerates and caches under the versioned key, and the old entries TTL
// out naturally. Forward-only cache invalidation, zero downtime.
const DIAGNOSIS_PROMPT_VERSION = 'v1'

// Hard cap on the joined interests fragment when it lands in a prompt — even
// 20 individually-bounded interests can produce a 1KB+ string that crowds out
// the actual instruction text.
const PROMPT_INTERESTS_MAX = 500

// ─── Internal helpers ─────────────────────────────────────────────────────────

function joinInterests(interests: string[]): string {
  return interests.join(', ').slice(0, PROMPT_INTERESTS_MAX)
}

function hashInterests(interests: string[]): string {
  return createHash('sha256')
    .update(JSON.stringify([...interests].sort()))
    .digest('hex')
    .slice(0, 16)
}

/**
 * Read + validate a cached AI payload. Returns null on miss OR on a corrupt
 * cache entry — a parse / Zod failure logs WARN, deletes the bad key, and
 * falls through to a fresh OpenAI call. Without this guard a single bad
 * write (write-truncation, schema drift) would surface as a 500 to every
 * subsequent request that hashes to the same key until TTL.
 */
async function readCache<T>(cacheKey: string, schema: ZodType<T>): Promise<T | null> {
  // Cache is OPTIONAL — Upstash failures must not break the AI request path.
  // A `redis.get` throw (e.g., breaker open from sustained Upstash issues)
  // surfaces here; we log warn and return null so the caller falls through
  // to the fresh OpenAI fetch.
  let cached: unknown
  try {
    cached = await redis.get<unknown>(cacheKey)
  } catch (err) {
    log.warn({
      cacheKey,
      err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
    }, 'AI cache read failed; treating as miss')
    return null
  }
  if (cached === null) return null
  try {
    const payload = typeof cached === 'string' ? JSON.parse(cached) : cached
    return schema.parse(payload)
  } catch (err) {
    log.warn({
      cacheKey,
      err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
    }, 'corrupt AI cache entry; treating as miss')
    // Best-effort delete; if the del also fails (e.g. same Upstash issue),
    // the corrupt entry will eventually TTL out — don't fail the request.
    await redis.del(cacheKey).catch(() => undefined)
    return null
  }
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
  opts?: { signal?: AbortSignal },
): Promise<GeneratedCardData> {
  if (openai === null) throw new AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })
  // Capture the narrowed (non-null) reference into a local. The inner closure
  // below sees `openai` widened back to `OpenAI | null` — the local survives
  // the closure boundary as a non-null without needing a `!` assertion.
  const client = openai

  const safeWord      = sanitizeForPrompt(word)
  const safeLevel     = sanitizeForPrompt(userLevel)
  const safeInterests = interests.map((s) => sanitizeForPrompt(s))

  const cacheKey = `card:${safeWord}:${safeLevel}:${hashInterests(safeInterests)}`

  const fromCache = await readCache(cacheKey, GeneratedCardDataSchema)
  if (fromCache !== null) return fromCache

  // Breaker integration runs only on a cache miss. A network exception, an
  // empty response, or a Zod parse failure inside the inner fn all become
  // 503 via withBreaker's catch path; specific diagnostic info goes to the
  // log line below. The outer try/catch around the OpenAI call is kept
  // solely to scrub `sk-…` tokens from `err.message` (the SDK leaks them
  // in 401 messages).
  const result = await openaiSemaphore.run({ signal: opts?.signal }, () => withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, async () => {
    let response
    try {
      response = await client.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language expert generating SRS card data.
Always respond with valid JSON.
User level: ${safeLevel}. User interests: ${joinInterests(safeInterests)}.
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
      }, { signal: opts?.signal })
    } catch (err) {
      log.error({
        err: {
          name:    err instanceof Error ? err.name : 'Unknown',
          message: scrubKeyish(err),
        },
      }, 'generateCard OpenAI request failed')
      throw err
    }

    const raw = response.choices[0]?.message.content
    if (raw === null || raw === undefined) {
      // 502 Bad Gateway is the right status here: OpenAI returned an HTTP
      // 200 with malformed content. Using AppError (vs plain Error) prevents
      // withBreaker from counting this against the chat breaker — see the
      // skip-AppError branch in lib/circuit-breaker.ts.
      throw new AppError(502, 'OpenAI returned an empty response', { code: 'OPENAI_EMPTY_RESPONSE' })
    }
    return GeneratedCardDataSchema.parse(JSON.parse(raw))
  }))

  // Cache write outside the breaker — a Redis blip should not trip the
  // OpenAI breaker. If the write fails, the work already succeeded; we just
  // miss caching this entry and the next equivalent request hits OpenAI.
  // Cache write is best-effort — see the comment above the breaker call.
  // Without this swallow a Redis blip after a successful OpenAI generation
  // would surface to the user, who'd retry and re-bill the OpenAI call.
  await redis.set(cacheKey, JSON.stringify(result), { ex: CARD_CACHE_TTL })
    .catch((err: unknown) => {
      log.warn({
        cacheKey,
        err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
      }, 'AI cache write failed; result still returned')
    })
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
  opts?:      { signal?: AbortSignal },
): Promise<GeneratedSentences> {
  if (openai === null) throw new AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })
  const client = openai  // see generateCard for the narrowing rationale.

  const safeWord      = sanitizeForPrompt(word)
  const safeLevel     = sanitizeForPrompt(userLevel)
  const safeInterests = interests.map((s) => sanitizeForPrompt(s))
  const safeCount     = Math.max(1, Math.min(5, Math.trunc(count)))

  const cacheKey = `sentences:${safeWord}:${safeLevel}:${hashInterests(safeInterests)}:${safeCount}`

  const fromCache = await readCache(cacheKey, GeneratedSentencesSchema)
  if (fromCache !== null) return fromCache

  const result = await openaiSemaphore.run({ signal: opts?.signal }, () => withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, async () => {
    let response
    try {
      response = await client.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language expert generating natural example sentences for SRS flash cards.
Always respond with valid JSON.
User level: ${safeLevel}. User interests: ${joinInterests(safeInterests)}.
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
      }, { signal: opts?.signal })
    } catch (err) {
      log.error({
        err: {
          name:    err instanceof Error ? err.name : 'Unknown',
          message: scrubKeyish(err),
        },
      }, 'generateSentences OpenAI request failed')
      throw err
    }

    const raw = response.choices[0]?.message.content
    if (raw === null || raw === undefined) {
      // 502 Bad Gateway is the right status here: OpenAI returned an HTTP
      // 200 with malformed content. Using AppError (vs plain Error) prevents
      // withBreaker from counting this against the chat breaker — see the
      // skip-AppError branch in lib/circuit-breaker.ts.
      throw new AppError(502, 'OpenAI returned an empty response', { code: 'OPENAI_EMPTY_RESPONSE' })
    }
    return GeneratedSentencesSchema.parse(JSON.parse(raw))
  }))

  await redis.set(cacheKey, JSON.stringify(result), { ex: SENTENCES_CACHE_TTL })
    .catch((err: unknown) => {
      log.warn({
        cacheKey,
        err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
      }, 'AI cache write failed; result still returned')
    })
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
  opts?:          { signal?: AbortSignal },
): Promise<GeneratedMnemonic> {
  if (openai === null) throw new AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })
  const client = openai  // see generateCard for the narrowing rationale.

  const safeWord       = sanitizeForPrompt(word)
  const safeLevel      = sanitizeForPrompt(userLevel)
  const safeNative     = sanitizeForPrompt(nativeLanguage)
  const safeInterests  = interests.map((s) => sanitizeForPrompt(s))

  const cacheKey = `mnemonic:${safeWord}:${userId}`

  const fromCache = await readCache(cacheKey, GeneratedMnemonicSchema)
  if (fromCache !== null) return fromCache

  const result = await openaiSemaphore.run({ signal: opts?.signal }, () => withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, async () => {
    let response
    try {
      response = await client.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a Japanese language tutor crafting memorable mnemonics.
Always respond with valid JSON.
User level: ${safeLevel}. Native language: ${safeNative}. Interests: ${joinInterests(safeInterests)}.
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
      }, { signal: opts?.signal })
    } catch (err) {
      log.error({
        err: {
          name:    err instanceof Error ? err.name : 'Unknown',
          message: scrubKeyish(err),
        },
      }, 'generateMnemonic OpenAI request failed')
      throw err
    }

    const raw = response.choices[0]?.message.content
    if (raw === null || raw === undefined) {
      // 502 Bad Gateway is the right status here: OpenAI returned an HTTP
      // 200 with malformed content. Using AppError (vs plain Error) prevents
      // withBreaker from counting this against the chat breaker — see the
      // skip-AppError branch in lib/circuit-breaker.ts.
      throw new AppError(502, 'OpenAI returned an empty response', { code: 'OPENAI_EMPTY_RESPONSE' })
    }
    return GeneratedMnemonicSchema.parse(JSON.parse(raw))
  }))

  await redis.set(cacheKey, JSON.stringify(result), { ex: MNEMONIC_CACHE_TTL })
    .catch((err: unknown) => {
      log.warn({
        cacheKey,
        err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
      }, 'AI cache write failed; result still returned')
    })
  return result
}

/**
 * Generates a diagnosis + prescription for a leech: an explanation of *why*
 * the card keeps lapsing and one concrete next-step fix the learner can
 * apply. The leech-management UI surfaces these alongside the card content.
 *
 * Cache key includes the card's word + the lapse count, so a card that gets
 * worse over time can regenerate; a card whose lapse pattern is stable
 * returns the cached diagnosis cheaply.
 *
 * @param word          Card front (vocabulary word, grammar pattern, or
 *                      sentence front) — used for prompt context.
 * @param reading       Optional reading (kana). When null, the model is told
 *                      to infer or skip.
 * @param meaning       Card back (English meaning / translation).
 * @param lapseCount    Current `cards.lapses` — the only quantitative signal
 *                      we pass to the model.
 * @param recentRatings Last N ratings from `review_logs.rating`, oldest →
 *                      newest. Empty array is acceptable.
 * @param userLevel     Learner's JLPT target (e.g. 'N3').
 * @param nativeLanguage Learner's L1, for the prescription's voice.
 *
 * Throws `OPENAI_KEY_MISSING` if env unset, `OPENAI_EMPTY_RESPONSE` on
 * malformed model output, or a `ServiceUnavailableError` (503) when the
 * chat breaker is open. ZodError if structured-output validation fails.
 */
export async function generateLeechDiagnosis(
  word:           string,
  reading:        string | null,
  meaning:        string,
  lapseCount:     number,
  recentRatings:  string[],
  userLevel:      string,
  nativeLanguage: string,
  opts?:          { signal?: AbortSignal },
): Promise<GeneratedLeechDiagnosis> {
  if (openai === null) throw new AppError(500, 'OPENAI_API_KEY not configured', { code: 'OPENAI_KEY_MISSING' })
  const client = openai  // see generateCard for the narrowing rationale.

  const safeWord    = sanitizeForPrompt(word)
  const safeReading = reading !== null ? sanitizeForPrompt(reading) : ''
  const safeMeaning = sanitizeForPrompt(meaning)
  const safeLevel   = sanitizeForPrompt(userLevel)
  const safeNative  = sanitizeForPrompt(nativeLanguage)
  // Ratings are well-known enum values from review_logs.rating; sanitize
  // defensively in case future ratings include user text.
  const safeRatings = recentRatings.map((r) => sanitizeForPrompt(r))

  // Cache key encodes every dimension that affects the diagnosis output:
  // prompt-template version (bumped when the prompt body changes), word,
  // reading, lapse count, recent rating pattern, learner level, and native
  // language. Same inputs → same diagnosis — shared across users by design
  // since the output depends on the card + the lapse pattern, not on user
  // identity. Per `CODING_STANDARDS_BACKEND.md` §Performance: "cache keys
  // include every dimension that affects the result."
  const cacheKey = `diagnosis:${DIAGNOSIS_PROMPT_VERSION}:${safeWord}:${safeReading}:${lapseCount}:${safeLevel}:${safeNative}:${safeRatings.join(',')}`

  const fromCache = await readCache(cacheKey, GeneratedLeechDiagnosisSchema)
  if (fromCache !== null) return fromCache

  const result = await openaiSemaphore.run({ signal: opts?.signal }, () => withBreaker(CHAT_BREAKER, CHAT_UNAVAILABLE_MSG, async () => {
    let response
    try {
      response = await client.chat.completions.create({
        model: CHAT_MODEL,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are a Japanese-language SRS coach. The learner has lapsed on a card multiple times; you must diagnose why and prescribe one concrete next-step fix.
Always respond with valid JSON.
Learner level: ${safeLevel}. Native language: ${safeNative}.

Common reasons a Japanese-learning card lapses:
- Ambiguous reading (e.g. 生 has many on'yomi/kun'yomi)
- Similar-kanji visual confusion (e.g. 持/侍, 王/玉)
- Okurigana inconsistency (e.g. 行う vs 行なう)
- Weak mnemonic linking sound to meaning
- Context-thin sentence — the meaning only makes sense in a specific register
- Pitch-accent confusion (heteronyms with different accents)
- Polysemy — one word, several distinct senses

Your diagnosis must name the most likely reason in plain learner language (not jargon). Your prescription must propose one concrete action: a specific mnemonic image, a kanji disambiguation tip, an example-sentence pattern to learn, or a similar-cards study set to drill.`,
          },
          {
            role: 'user',
            content: `Card front: ${safeWord}
Reading: ${safeReading !== '' ? safeReading : '(unknown)'}
Meaning: ${safeMeaning}
Current lapse count: ${lapseCount}
Recent ratings (oldest → newest): ${safeRatings.length > 0 ? safeRatings.join(', ') : '(none recorded)'}

Return JSON with this exact shape:
{ "diagnosis": string, "prescription": string }

Constraints:
- diagnosis: under 200 characters, plain language, names the likely cause.
- prescription: under 240 characters, names ONE concrete next step.
- Use the user's native language for both fields.
- Do not mention "AI" or apologize for being a model.`,
          },
        ],
      }, { signal: opts?.signal })
    } catch (err) {
      log.error({
        err: {
          name:    err instanceof Error ? err.name : 'Unknown',
          message: scrubKeyish(err),
        },
      }, 'generateLeechDiagnosis OpenAI request failed')
      throw err
    }

    const raw = response.choices[0]?.message.content
    if (raw === null || raw === undefined) {
      throw new AppError(502, 'OpenAI returned an empty response', { code: 'OPENAI_EMPTY_RESPONSE' })
    }
    return GeneratedLeechDiagnosisSchema.parse(JSON.parse(raw))
  }))

  await redis.set(cacheKey, JSON.stringify(result), { ex: DIAGNOSIS_CACHE_TTL })
    .catch((err: unknown) => {
      log.warn({
        cacheKey,
        err: err instanceof Error ? { name: err.name, message: err.message } : { detail: String(err) },
      }, 'AI cache write failed; result still returned')
    })
  return result
}
