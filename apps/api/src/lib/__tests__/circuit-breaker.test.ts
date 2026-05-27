import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'

import { seedRandom, restoreRandom } from '../../../tests/support'

// In-memory redis stub. circuit-breaker.ts imports `redis` from `../db/redis.ts`
// at module load; this `mock.module` swap must run BEFORE the import below.
//
// The stub models the small slice of Upstash semantics the breaker actually
// touches: SET NX EX, INCR, GET, GETDEL, DEL, TTL. Unlike the previous
// single-key stub, this one tracks per-key state via a Map so the half-open
// probe key (`circuit:${name}:probe`) and the failure key
// (`circuit:${name}:failures`) can coexist without aliasing each other.

interface SetOptions { ex?: number; nx?: boolean }
interface StoreEntry { value: string | number; ttl: number }
const store = new Map<string, StoreEntry>()

const fakeRedis = {
  set: async (key: string, value: number | string, opts?: SetOptions): Promise<string | null> => {
    if (opts?.nx === true && store.has(key)) return null
    store.set(key, { value, ttl: opts?.ex ?? -1 })
    return 'OK'
  },
  incr: async (key: string): Promise<number> => {
    const entry = store.get(key)
    const cur   = entry === undefined
      ? 0
      : (typeof entry.value === 'number' ? entry.value : Number.parseInt(entry.value, 10) || 0)
    const next  = cur + 1
    store.set(key, { value: next, ttl: entry?.ttl ?? -1 })
    return next
  },
  get: async <T>(key: string): Promise<T | null> => {
    const entry = store.get(key)
    return entry === undefined ? null : (entry.value as unknown as T)
  },
  // GETDEL: atomically reads and removes the key. Used by `recordSuccess`
  // to close the get→del race that an INCR could land between.
  getdel: async <T>(key: string): Promise<T | null> => {
    const entry = store.get(key)
    if (entry === undefined) return null
    store.delete(key)
    return entry.value as unknown as T
  },
  del: async (key: string): Promise<number> => {
    const had = store.has(key) ? 1 : 0
    store.delete(key)
    return had
  },
  ttl: async (key: string): Promise<number> => store.get(key)?.ttl ?? -2,
}

// Mock both `redis` and `rawRedis` exports — circuit-breaker.ts imports
// `rawRedis` (not `redis`) to avoid recursion through its own breaker; without
// the rawRedis mock, the breaker's internal calls would see `undefined` and
// throw on every method invocation.
mock.module('../../db/redis.ts', () => ({
  redis: fakeRedis,
  rawRedis: fakeRedis,
}))

const { recordFailure, recordSuccess, isOpen, getRetryAfterSeconds, withBreaker, invalidateIsOpenCache } = await import('../circuit-breaker.ts')
const { AppError, ServiceUnavailableError } = await import('../../middleware/errorHandler.ts')

beforeEach(() => {
  store.clear()
  // Clear the in-memory isOpen cache between tests so pre-set state is visible.
  invalidateIsOpenCache('test')
})

// ─── Test helpers ──────────────────────────────────────────────────────────

const failureKey = (name: string): string => `circuit:${name}:failures`
const probeKey   = (name: string): string => `circuit:${name}:probe`

function presetFailures(name: string, count: number, ttl: number): void {
  store.set(failureKey(name), { value: count, ttl })
}
function presetProbe(name: string, ttl = 5): void {
  store.set(probeKey(name), { value: '1', ttl })
}
function getCount(name: string): number | null {
  const entry = store.get(failureKey(name))
  if (entry === undefined) return null
  return typeof entry.value === 'number' ? entry.value : Number.parseInt(entry.value, 10) || null
}
function isProbeHeld(name: string): boolean {
  return store.has(probeKey(name))
}

// ─── Counter / state primitives ────────────────────────────────────────────

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

describe('circuit-breaker — getRetryAfterSeconds (with jitter)', () => {
  // The 'test' namespace falls back to FALLBACK_CONFIG (window=300s).
  // Production adds 0–29s jitter to thwart thundering-herd retries.
  it('returns base TTL plus jitter (0–29s) after a recorded failure', async () => {
    await recordFailure('test')
    const v = await getRetryAfterSeconds('test')
    expect(v).toBeGreaterThanOrEqual(300)
    expect(v).toBeLessThan(330)
  })

  it('falls back to full window plus jitter when no key exists', async () => {
    const v = await getRetryAfterSeconds('test')
    expect(v).toBeGreaterThanOrEqual(300)
    expect(v).toBeLessThan(330)
  })
})

describe('circuit-breaker — getRetryAfterSeconds (seeded jitter is exact)', () => {
  // The range tests above pin the unseeded production contract (value stays in
  // [base, base+30)). Seeding Math.random turns that into exact assertions,
  // locking the formula to `base + floor(random * 30)` — a regression to
  // `base * random` or an off-by-one in the jitter ceiling fails here.
  // 'test' uses FALLBACK_CONFIG (window = 300s).
  afterEach(() => { restoreRandom() })

  it('adds zero jitter when random() is 0 — returns the base window TTL exactly', async () => {
    await recordFailure('test') // failure key now carries a 300s TTL
    seedRandom(0)
    expect(await getRetryAfterSeconds('test')).toBe(300)
  })

  it('adds floor(random * 30) — 15s of jitter at random() = 0.5', async () => {
    await recordFailure('test')
    seedRandom(0.5)
    expect(await getRetryAfterSeconds('test')).toBe(315)
  })

  it('caps jitter at 29s just below random() = 1 (never reaches a full +30)', async () => {
    await recordFailure('test')
    seedRandom(0.999)
    expect(await getRetryAfterSeconds('test')).toBe(329)
  })

  it('uses the full window as the base when no failure key exists (TTL -2 ⇒ windowSeconds)', async () => {
    seedRandom(0) // isolate the base from jitter
    expect(await getRetryAfterSeconds('test')).toBe(300)
  })
})

// ─── withBreaker — half-open probe behaviour ──────────────────────────────
//
// New post-Phase-B semantics: when the breaker is open, the FIRST caller
// acquires a probe slot via SET-NX and runs `fn` as a probe. Concurrent
// callers see the probe held and fast-fail until either the probe completes
// (releasing the slot) or PROBE_TTL_SECONDS expires.

describe('withBreaker — open breaker, half-open probe', () => {
  it('first caller acquires probe and runs fn; probe success closes breaker', async () => {
    presetFailures('test', 10, 250)  // open
    expect(await isOpen('test')).toBe(true)

    let ranInner = false
    const result = await withBreaker('test', 'service down', async () => {
      ranInner = true
      return 'probe-ok'
    })

    expect(result).toBe('probe-ok')
    expect(ranInner).toBe(true)
    // Probe success → recordSuccess clears failures, releaseProbe clears probe.
    expect(getCount('test')).toBeNull()
    expect(isProbeHeld('test')).toBe(false)
    expect(await isOpen('test')).toBe(false)
  })

  it('concurrent caller fast-fails when probe is held by another', async () => {
    presetFailures('test', 10, 250)  // open
    presetProbe('test')              // another caller's probe in flight

    let ranInner = false
    let captured: unknown
    try {
      await withBreaker('test', 'service down', async () => {
        ranInner = true
        return 'should not reach this'
      })
    } catch (err) {
      captured = err
    }

    expect(captured).toBeInstanceOf(ServiceUnavailableError)
    expect(ranInner).toBe(false)
    // Probe key still held — we didn't release it (we never had it).
    expect(isProbeHeld('test')).toBe(true)
    // Failures unchanged — the other prober owns failure-recording for this attempt.
    expect(getCount('test')).toBe(10)
  })

  it('probe failure releases the slot but keeps breaker open', async () => {
    presetFailures('test', 10, 250)

    let captured: unknown
    try {
      await withBreaker('test', 'service down', async () => {
        throw new Error('still failing')
      })
    } catch (err) {
      captured = err
    }

    expect(captured).toBeInstanceOf(ServiceUnavailableError)
    // Probe failure: recordFailure increments (10 → 11) so breaker stays open.
    expect(getCount('test')).toBe(11)
    // Probe slot released — another caller can probe after PROBE_TTL_SECONDS.
    expect(isProbeHeld('test')).toBe(false)
    expect(await isOpen('test')).toBe(true)
  })
})

describe('withBreaker — closed breaker', () => {
  it('returns the inner fn result; counter stays clear on success', async () => {
    const result = await withBreaker('test', 'service down', async () => 42)
    expect(result).toBe(42)
    expect(getCount('test')).toBeNull()
  })

  it('does NOT eagerly clear a partial-failure counter on closed-path success (TTL-based reset)', async () => {
    // Closed-path optimization: when isOpen=false at the start of the call,
    // the success path skips recordSuccess to save a Redis round-trip per
    // call. The failure counter clears via TTL (config.windowSeconds) instead
    // of eagerly. Eager clearing only happens on the half-open probe path.
    presetFailures('test', 5, 250)  // closed (under threshold 10)
    const result = await withBreaker('test', 'service down', async () => 'ok')
    expect(result).toBe('ok')
    expect(getCount('test')).toBe(5)
  })
})

describe('withBreaker — fn failure', () => {
  it('wraps a plain Error as ServiceUnavailableError(30) and records failure', async () => {
    let captured: unknown
    try {
      await withBreaker('test', 'service down', async () => {
        throw new Error('network timeout')
      })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(ServiceUnavailableError)
    expect((captured as InstanceType<typeof ServiceUnavailableError>).retryAfterSeconds).toBe(30)
    expect((captured as InstanceType<typeof ServiceUnavailableError>).message).toBe('service down')
    expect(getCount('test')).toBe(1)
  })

  it('propagates AppError unwrapped (preserves intentional inner errors)', async () => {
    // Inner fn throws an intentional 500 — e.g. "API key not configured."
    // withBreaker should NOT wrap this as 503; the original status carries
    // semantic meaning the wrapping would erase.
    let captured: unknown
    try {
      await withBreaker('test', 'service down', async () => {
        throw new AppError(500, 'OPENAI_API_KEY not configured')
      })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(AppError)
    expect(captured).not.toBeInstanceOf(ServiceUnavailableError)
    expect((captured as InstanceType<typeof AppError>).statusCode).toBe(500)
    expect((captured as InstanceType<typeof AppError>).message).toBe('OPENAI_API_KEY not configured')
    // Deterministic AppError does NOT trip the breaker.
    expect(getCount('test')).toBeNull()
  })

  it('inner ServiceUnavailableError is propagated AND records failure', async () => {
    // ServiceUnavailableError extends AppError, so the skip-AppError clause
    // in withBreaker would over-match without the explicit subclass check.
    // This test locks that down: SUE thrown directly by the inner fn must
    // still count against the breaker because it IS the degradation signal.
    let captured: unknown
    try {
      await withBreaker('test', 'service down', async () => {
        throw new ServiceUnavailableError('upstream tipped over', 60)
      })
    } catch (err) {
      captured = err
    }
    expect(captured).toBeInstanceOf(ServiceUnavailableError)
    // The original SUE is propagated unwrapped — its retryAfterSeconds (60)
    // is preserved, NOT replaced with INLINE_RETRY_AFTER_SECONDS (30).
    expect((captured as InstanceType<typeof ServiceUnavailableError>).retryAfterSeconds).toBe(60)
    expect((captured as InstanceType<typeof ServiceUnavailableError>).message).toBe('upstream tipped over')
    expect(getCount('test')).toBe(1)
  })
})
