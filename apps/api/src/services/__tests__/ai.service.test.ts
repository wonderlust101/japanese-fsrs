import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Both ai.service module-load and redis client need a way to function without
// real env vars. Set a dummy OpenAI key so the SDK constructor doesn't reject.
process.env['OPENAI_API_KEY'] = process.env['OPENAI_API_KEY'] ?? 'sk-test-dummy'

interface MockState {
  redisStore: Map<string, string>
}
const state: MockState = { redisStore: new Map() }

mock.module('../../db/redis.ts', () => ({
  redis: {
    get: mock(async (key: string) => {
      const v = state.redisStore.get(key)
      return v === undefined ? null : v
    }),
    set: mock(async (key: string, value: string) => {
      state.redisStore.set(key, value)
      return 'OK'
    }),
  },
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

describe('ai.service — Zod rejection on malformed cached payload', () => {
  it('generateCard rejects when cached JSON is missing required fields', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    state.redisStore.set(`card:水:N5:${hash}`, JSON.stringify({ word: '水' /* missing reading + meaning */ }))

    await expect(generateCard('水', 'N5', [])).rejects.toThrow()
  })

  it('generateSentences rejects when cached JSON has the wrong shape', async () => {
    const { createHash } = await import('node:crypto')
    const hash = createHash('sha256').update(JSON.stringify([])).digest('hex').slice(0, 16)
    state.redisStore.set(`sentences:水:N5:${hash}:3`, JSON.stringify({ wrong: 'shape' }))

    await expect(generateSentences('水', 'N5', [], 3)).rejects.toThrow()
  })
})
