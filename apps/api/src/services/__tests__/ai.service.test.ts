import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Both ai.service module-load and redis client need a way to function without
// real env vars. Set a dummy OpenAI key so the SDK constructor doesn't reject.
process.env['OPENAI_API_KEY'] = process.env['OPENAI_API_KEY'] ?? 'sk-test-dummy'

interface MockState {
  redisStore: Map<string, string>
}
const state: MockState = { redisStore: new Map() }

const fakeRedis = {
  get: mock(async (key: string) => {
    const v = state.redisStore.get(key)
    return v === undefined ? null : v
  }),
  set: mock(async (key: string, value: string) => {
    state.redisStore.set(key, value)
    return 'OK'
  }),
  del: mock(async (key: string) => {
    state.redisStore.delete(key)
    return 1
  }),
  // Methods used by the circuit breaker (rawRedis path) — see Phase D in
  // db/redis.ts for why two exports exist. Without these, withBreaker calls
  // fail with "x is not a function".
  incr: mock(async (key: string) => {
    const v = Number(state.redisStore.get(key) ?? 0) + 1
    state.redisStore.set(key, String(v))
    return v
  }),
  ttl: mock(async (_key: string) => -2),
}

mock.module('../../db/redis.ts', () => ({
  redis: fakeRedis,
  rawRedis: fakeRedis,
}))

const {
  generateCard,
  generateSentences,
  generateMnemonic,
} = await import('../ai.service.ts')

beforeEach(() => {
  state.redisStore.clear()
})

describe('ai.service — cache hit short-circuits OpenAI', () => {
  it('generateCard returns the cached payload directly when present', async () => {
    const word     = '水'
    const level    = 'N5'
    const cached   = JSON.stringify({ word: '水', reading: 'みず', meaning: 'water' })
    // Compute the cache key shape so we can preload redis directly. The
    // `v2` segment is `CARD_PROMPT_VERSION` (Backend Completion Plan Stage 2)
    // — bump in lockstep with the service constant.
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    const key  = `card:v2:${word}:${level}:${hash}`
    state.redisStore.set(key, cached)

    const result = await generateCard(word, level, [])
    expect(result.word).toBe('水')
    expect(result.reading).toBe('みず')
    expect(result.meaning).toBe('water')
  })

  it('generateSentences cache key includes count', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)

    const cachedFor2 = JSON.stringify({
      sentences: [
        { ja: 'a', en: 'a', furigana: '' },
        { ja: 'b', en: 'b', furigana: '' },
      ],
    })
    state.redisStore.set(`sentences:水:N5:${hash}:2`, cachedFor2)

    const out = await generateSentences('水', 'N5', [], 2)
    expect(out.sentences).toHaveLength(2)
  })

  it('generateMnemonic cache key is user-scoped', async () => {
    state.redisStore.set('mnemonic:水:user-1', JSON.stringify({ mnemonic: 'flowing strokes' }))
    const out = await generateMnemonic('水', 'user-1', 'N5', 'en', [])
    expect(out.mnemonic).toBe('flowing strokes')
  })
})

// ─── Backend Completion Plan Stage 2 ────────────────────────────────────────
//
// The generateCard prompt now asks the model for `pitchPosition` (integer ≥ 0)
// and `nuance` (short prose). These tests pin three contracts:
//   1. The structured-output Zod schema admits the new fields, so a model
//      response carrying them round-trips through `.parse()` instead of being
//      stripped.
//   2. The cache key embeds `CARD_PROMPT_VERSION = 'v2'`, so entries cached
//      under the v1 (unversioned) key shape are bypassed by the new key.
//      Without this contract, a deploy that changes the prompt body would
//      serve stale outputs from the prior prompt until the 7-day TTL.
//   3. `picture` / `expressionAudio` / `sentenceAudio` are admitted by the
//      schema (so a future prompt-version bump can populate them) but the
//      current prompt does not request them — the schema's optionality is
//      the contract that lets both states coexist.
describe('ai.service — Stage 2 Lapis fields on the cached payload', () => {
  it('generateCard returns cached pitchPosition + nuance when present (round-trip through GeneratedCardDataSchema)', async () => {
    const word     = '空'
    const level    = 'N5'
    const cached   = JSON.stringify({
      word:          '空',
      reading:       'そら',
      meaning:       'sky',
      pitchPosition: 1,
      nuance:        'Refers to the visible sky; for "outer space" use 宇宙.',
    })
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    // Cache key includes the prompt version so this fixture lives at the v2 key.
    const key = `card:v2:${word}:${level}:${hash}`
    state.redisStore.set(key, cached)

    const result = await generateCard(word, level, [])
    expect(result.word).toBe('空')
    expect(result.pitchPosition).toBe(1)
    expect(result.nuance).toBe('Refers to the visible sky; for "outer space" use 宇宙.')
  })

  it('generateCard bypasses pre-Stage-2 cache entries (v2 key shape differs from v1)', async () => {
    const word    = '川'
    const level   = 'N5'
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)

    // Seed an entry under the OLD (pre-Stage-2) key shape — no version prefix.
    // After deploy, lookups now happen at the v2 key, so this entry is dead
    // weight until it TTLs out. The new lookup must miss and fall through.
    const oldKey  = `card:${word}:${level}:${hash}`
    state.redisStore.set(oldKey, JSON.stringify({ word: 'stale', reading: 'stale', meaning: 'stale' }))

    const result = await generateCard(word, level, []).catch((err) => err)
    // The OpenAI fall-through is not mocked here — either it resolves with a
    // fresh payload or it errors. The contract we assert is that the OLD key
    // is never read: the result is not the stale payload above.
    if (!(result instanceof Error)) {
      expect(result.word).not.toBe('stale')
    }
    // The old key itself is left untouched (no migration / cleanup). Its
    // TTL will reclaim it; the new code path simply doesn't read it.
    expect(state.redisStore.get(oldKey)).toBe(
      JSON.stringify({ word: 'stale', reading: 'stale', meaning: 'stale' }),
    )
  })

  it('GeneratedCardDataSchema accepts an exampleSentence carrying sentenceAudio', async () => {
    const { GeneratedCardDataSchema } = await import('@fsrs-japanese/shared-types')
    const parsed = GeneratedCardDataSchema.parse({
      word:    '猫',
      reading: 'ねこ',
      meaning: 'cat',
      exampleSentences: [
        {
          ja:            '猫が好きです。',
          en:            'I like cats.',
          furigana:      'ねこがすきです。',
          sentenceAudio: 'https://cdn.example.test/sentence-001.mp3',
        },
      ],
    })
    expect(parsed.exampleSentences?.[0]?.sentenceAudio).toBe('https://cdn.example.test/sentence-001.mp3')
  })

  it('GeneratedCardDataSchema rejects a negative pitchPosition (defends against bad model output)', async () => {
    const { GeneratedCardDataSchema } = await import('@fsrs-japanese/shared-types')
    const result = GeneratedCardDataSchema.safeParse({
      word:          '雨',
      reading:       'あめ',
      meaning:       'rain',
      pitchPosition: -1,
    })
    expect(result.success).toBe(false)
  })

  it('GeneratedCardDataSchema rejects a non-integer pitchPosition', async () => {
    const { GeneratedCardDataSchema } = await import('@fsrs-japanese/shared-types')
    const result = GeneratedCardDataSchema.safeParse({
      word:          '雪',
      reading:       'ゆき',
      meaning:       'snow',
      pitchPosition: 1.5,
    })
    expect(result.success).toBe(false)
  })

  it('GeneratedCardDataSchema admits picture / expressionAudio fields even though the prompt does not request them', async () => {
    // The schema is forward-compatible so a future prompt-version bump can
    // wire up these fields without a second schema change. Today's prompt
    // explicitly tells the model NOT to invent values for them, but if a
    // model does produce them they must round-trip cleanly.
    const { GeneratedCardDataSchema } = await import('@fsrs-japanese/shared-types')
    const parsed = GeneratedCardDataSchema.parse({
      word:            '光',
      reading:         'ひかり',
      meaning:         'light',
      picture:         'https://cdn.example.test/hikari.jpg',
      expressionAudio: 'https://cdn.example.test/hikari.mp3',
    })
    expect(parsed.picture).toBe('https://cdn.example.test/hikari.jpg')
    expect(parsed.expressionAudio).toBe('https://cdn.example.test/hikari.mp3')
  })
})

describe('ai.service — corrupt cached payload is treated as miss', () => {
  // Previous behavior: bad cache → ZodError surfaced as 500 to every caller
  // that hashed to the corrupt key until TTL. New behavior: log + delete +
  // fall through to a fresh OpenAI call. The OpenAI fetch isn't mocked here,
  // so it may resolve (writing a fresh value at the same key) or reject;
  // either way, the original corrupt entry must no longer be present.

  it('generateCard removes the corrupt cache entry (does not surface ZodError)', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    // Key includes `v2` for CARD_PROMPT_VERSION — see the Stage 2 block below.
    const key  = `card:v2:水:N5:${hash}`
    const corrupt = JSON.stringify({ word: '水' /* missing reading + meaning */ })
    state.redisStore.set(key, corrupt)

    const result = await generateCard('水', 'N5', []).catch((err) => err)
    // Whether OpenAI fell through successfully or errored, the corrupt
    // entry must no longer be there — otherwise the next caller hits the
    // same bad cache.
    expect(state.redisStore.get(key)).not.toBe(corrupt)
    // And specifically: any thrown error must NOT be a ZodError surfacing
    // the corrupt-shape complaint to callers.
    if (result instanceof Error) {
      expect(result.name).not.toBe('ZodError')
    }
  })

  it('generateSentences removes the corrupt cache entry (does not surface ZodError)', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    const key  = `sentences:水:N5:${hash}:3`
    const corrupt = JSON.stringify({ wrong: 'shape' })
    state.redisStore.set(key, corrupt)

    const result = await generateSentences('水', 'N5', [], 3).catch((err) => err)
    expect(state.redisStore.get(key)).not.toBe(corrupt)
    if (result instanceof Error) {
      expect(result.name).not.toBe('ZodError')
    }
  })
})
