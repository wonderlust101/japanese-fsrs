import { describe, it, expect, mock, beforeEach } from 'bun:test'

// In-memory redis stub. circuit-breaker.ts imports `redis` from `../db/redis.ts`
// at module load; this `mock.module` swap must run BEFORE the import below.
//
// The stub models the small slice of Upstash semantics the breaker actually
// touches: SET NX EX, INCR, GET, DEL, TTL. Only one key is ever held at a
// time across these tests (the breaker writes to one key per name, and we
// reset between tests), so a single `storedCount` / `storedTtl` pair is enough.

let storedCount: number | null = null
let storedTtl: number = -2

interface SetOptions { ex?: number; nx?: boolean }

mock.module('../../db/redis.ts', () => ({
  redis: {
    set: async (_key: string, _value: number, opts?: SetOptions): Promise<string | null> => {
      if (opts?.nx === true && storedCount !== null) return null
      storedCount = 0
      storedTtl   = opts?.ex ?? -1
      return 'OK'
    },
    incr: async (_key: string): Promise<number> => {
      if (storedCount === null) storedCount = 0
      storedCount += 1
      return storedCount
    },
    get: async <T>(_key: string): Promise<T | null> => storedCount as unknown as T | null,
    del: async (_key: string): Promise<number> => {
      const had = storedCount !== null ? 1 : 0
      storedCount = null
      storedTtl   = -2
      return had
    },
    ttl: async (_key: string): Promise<number> => storedTtl,
  },
}))

const { recordFailure, recordSuccess, isOpen, getRetryAfterSeconds } = await import('../circuit-breaker.ts')

beforeEach(() => {
  storedCount = null
  storedTtl   = -2
})

describe('circuit-breaker — closed state', () => {
  it('isOpen is false when no failures have been recorded', async () => {
    expect(await isOpen('test')).toBe(false)
  })

  it('isOpen stays false below the threshold (9 of 10 failures)', async () => {
    for (let i = 0; i < 9; i += 1) await recordFailure('test')
    expect(await isOpen('test')).toBe(false)
  })
})

describe('circuit-breaker — opens at threshold', () => {
  it('isOpen is true at exactly the threshold (10 failures)', async () => {
    for (let i = 0; i < 10; i += 1) await recordFailure('test')
    expect(await isOpen('test')).toBe(true)
  })

  it('isOpen stays true past the threshold', async () => {
    for (let i = 0; i < 25; i += 1) await recordFailure('test')
    expect(await isOpen('test')).toBe(true)
  })
})

describe('circuit-breaker — recovery via recordSuccess', () => {
  it('recordSuccess closes an open breaker', async () => {
    for (let i = 0; i < 10; i += 1) await recordFailure('test')
    expect(await isOpen('test')).toBe(true)

    await recordSuccess('test')
    expect(await isOpen('test')).toBe(false)
  })

  it('recordSuccess on an already-closed breaker is a no-op', async () => {
    // No failures recorded — get returns null — del runs but returns 0.
    await recordSuccess('test')
    expect(await isOpen('test')).toBe(false)
  })
})

describe('circuit-breaker — getRetryAfterSeconds', () => {
  it('returns the TTL set by the first failure', async () => {
    await recordFailure('test')
    // Stub stores opts.ex (300 = WINDOW_SECONDS in the impl).
    expect(await getRetryAfterSeconds('test')).toBe(300)
  })

  it('falls back to the full window when no key exists', async () => {
    // No failures recorded — TTL = -2 — falls back to WINDOW_SECONDS.
    expect(await getRetryAfterSeconds('test')).toBe(300)
  })
})
