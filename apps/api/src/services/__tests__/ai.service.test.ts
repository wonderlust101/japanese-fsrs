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
    // Compute the cache key shape so we can preload redis directly.
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    const key  = `card:${word}:${level}:${hash}`
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

describe('ai.service — corrupt cached payload is treated as miss', () => {
  // Previous behavior: bad cache → ZodError surfaced as 500 to every caller
  // that hashed to the corrupt key until TTL. New behavior: log + delete +
  // fall through to a fresh OpenAI call. The OpenAI fetch isn't mocked here,
  // so it may resolve (writing a fresh value at the same key) or reject;
  // either way, the original corrupt entry must no longer be present.

  it('generateCard removes the corrupt cache entry (does not surface ZodError)', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    const key  = `card:水:N5:${hash}`
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
