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

const { recordFailure, recordSuccess, isOpen, getRetryAfterSeconds, withBreaker } = await import('../circuit-breaker.ts')
const { AppError, ServiceUnavailableError } = await import('../../middleware/errorHandler.ts')

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

// ─── withBreaker (the integration helper consumers use) ──────────────────────

describe('withBreaker — open breaker', () => {
  it('throws ServiceUnavailableError without running fn', async () => {
    // Simulate an already-open breaker (10 failures, 250s left in window).
    storedCount = 10
    storedTtl   = 250

    let ranInner = false
    const promise = withBreaker('test', 'service down', async () => {
      ranInner = true
      return 'should not reach this'
    })

    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableError)
    expect(ranInner).toBe(false)

    // Verify the thrown error carries the TTL-based retry-after.
    try {
      await withBreaker('test', 'service down', async () => 'unused')
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableError)
      expect((err as InstanceType<typeof ServiceUnavailableError>).retryAfterSeconds).toBe(250)
      expect((err as InstanceType<typeof ServiceUnavailableError>).message).toBe('service down')
    }
  })
})

describe('withBreaker — closed breaker', () => {
  it('returns the inner fn result and records success on the breaker', async () => {
    // Pre-condition: 10 failures recorded → breaker would be open.
    // recordSuccess (called by withBreaker on inner success) must clear it.
    storedCount = 10
    storedTtl   = 250

    // But to test the success path we need the breaker to look closed at the
    // pre-check. Reset the state so isOpen returns false at probe time.
    storedCount = null
    storedTtl   = -2

    const result = await withBreaker('test', 'service down', async () => 42)
    expect(result).toBe(42)
    // Counter remains null (recordSuccess on a closed breaker is a no-op).
    expect(storedCount).toBeNull()
  })

  it('clears a stale counter when fn succeeds', async () => {
    // Breaker has 5 failures (still closed at threshold 10) — a success
    // should clear the counter so the partial window doesn't carry over.
    storedCount = 5
    storedTtl   = 250

    const result = await withBreaker('test', 'service down', async () => 'ok')
    expect(result).toBe('ok')
    expect(storedCount).toBeNull()
  })
})

describe('withBreaker — fn failure', () => {
  it('wraps a plain Error as ServiceUnavailableError(30) and records failure', async () => {
    const promise = withBreaker('test', 'service down', async () => {
      throw new Error('network timeout')
    })

    await expect(promise).rejects.toBeInstanceOf(ServiceUnavailableError)
    // Counter incremented to 1 (the failure was recorded).
    expect(storedCount).toBe(1)

    // Verify the wrapped error carries the inline retry-after (30s, not the
    // full window) — because the breaker wasn't yet open when fn ran.
    try {
      // Reset and re-run to capture the error.
      storedCount = null
      storedTtl   = -2
      await withBreaker('test', 'service down', async () => {
        throw new Error('network timeout')
      })
    } catch (err) {
      expect(err).toBeInstanceOf(ServiceUnavailableError)
      expect((err as InstanceType<typeof ServiceUnavailableError>).retryAfterSeconds).toBe(30)
      expect((err as InstanceType<typeof ServiceUnavailableError>).message).toBe('service down')
    }
  })

  it('propagates AppError unwrapped (preserves intentional inner errors)', async () => {
    // Inner fn throws an intentional 500 — e.g. "API key not configured."
    // withBreaker should NOT wrap this as 503; the original status carries
    // semantic meaning the wrapping would erase.
    const promise = withBreaker('test', 'service down', async () => {
      throw new AppError(500, 'OPENAI_API_KEY not configured')
    })

    await expect(promise).rejects.toBeInstanceOf(AppError)
    // Failure still recorded (any inner throw counts).
    expect(storedCount).toBe(1)

    try {
      storedCount = null
      storedTtl   = -2
      await withBreaker('test', 'service down', async () => {
        throw new AppError(500, 'OPENAI_API_KEY not configured')
      })
    } catch (err) {
      // It's exactly the original AppError — not a ServiceUnavailableError.
      expect(err).toBeInstanceOf(AppError)
      expect(err).not.toBeInstanceOf(ServiceUnavailableError)
      expect((err as InstanceType<typeof AppError>).statusCode).toBe(500)
      expect((err as InstanceType<typeof AppError>).message).toBe('OPENAI_API_KEY not configured')
    }
  })
})
