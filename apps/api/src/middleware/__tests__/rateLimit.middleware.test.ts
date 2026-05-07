import { describe, it, expect, mock } from 'bun:test'
import type { Request, Response } from 'express'

// rateLimit.ts constructs Ratelimit instances at module-load that touch the
// redis client; stub the redis import so the test process doesn't try to
// reach Upstash. The actual `.limit()` calls are not exercised in these
// tests — we test the pure header / tighter helpers instead.
//
// (The FIND-002 anon-bucket regression — where /refresh and /cancel-signup
// shared a global rate-limit bucket — is fixed in authRateLimitMiddleware
// by branching on `email` presence. End-to-end coverage of that branch
// would require a full Upstash redis stub; the change itself is small and
// self-evident at the call site.)
mock.module('../../db/redis.ts', () => ({ redis: {} }))

const { applyRateLimitHeaders, tighter } = await import('../rateLimit.ts')

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface FakeResponse {
  headers: Map<string, string>
  setHeader: (k: string, v: string) => void
}

function makeRes(): FakeResponse {
  const headers = new Map<string, string>()
  return {
    headers,
    setHeader: (k, v) => { headers.set(k.toLowerCase(), v) },
  }
}

interface WarnCall { msg: string; ctx: Record<string, unknown> }

interface FakeReq {
  log: { warn: (ctx: Record<string, unknown>, msg: string) => void }
  warns: WarnCall[]
}

function makeReq(): FakeReq {
  const warns: WarnCall[] = []
  return {
    warns,
    log: { warn: (ctx, msg) => { warns.push({ msg, ctx }) } },
  }
}

// ─── applyRateLimitHeaders ────────────────────────────────────────────────────

describe('applyRateLimitHeaders — success path', () => {
  it('sets X-RateLimit-Limit/Remaining/Reset and does not set Retry-After', () => {
    const reset = Date.now() + 60_000
    const res = makeRes()
    const req = makeReq()

    applyRateLimitHeaders(
      req as unknown as Request,
      res as unknown as Response,
      { success: true, limit: 240, remaining: 199, reset, pending: Promise.resolve() } as never,
      'default-user',
      'user-1:default',
    )

    expect(res.headers.get('x-ratelimit-limit')).toBe('240')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('199')
    expect(res.headers.get('x-ratelimit-reset')).toBe(String(Math.floor(reset / 1000)))
    expect(res.headers.has('retry-after')).toBe(false)
    expect(req.warns).toHaveLength(0)
  })

  it('clamps a negative remaining to 0', () => {
    const reset = Date.now() + 60_000
    const res = makeRes()
    const req = makeReq()

    applyRateLimitHeaders(
      req as unknown as Request,
      res as unknown as Response,
      { success: true, limit: 5, remaining: -3, reset, pending: Promise.resolve() } as never,
      'auth:email',
      'a@example.test',
    )

    expect(res.headers.get('x-ratelimit-remaining')).toBe('0')
  })
})

describe('applyRateLimitHeaders — 429 path', () => {
  it('sets Retry-After (seconds, ≥ 1) and emits a WARN log line', () => {
    const reset = Date.now() + 30_000
    const res = makeRes()
    const req = makeReq()

    applyRateLimitHeaders(
      req as unknown as Request,
      res as unknown as Response,
      { success: false, limit: 5, remaining: 0, reset, pending: Promise.resolve() } as never,
      'submit',
      'user-1:submit',
    )

    expect(res.headers.get('x-ratelimit-limit')).toBe('5')
    expect(res.headers.get('x-ratelimit-remaining')).toBe('0')
    expect(res.headers.get('x-ratelimit-reset')).toBe(String(Math.floor(reset / 1000)))

    const retryAfter = Number.parseInt(res.headers.get('retry-after') ?? '0', 10)
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(31)

    expect(req.warns).toHaveLength(1)
    expect(req.warns[0]?.msg).toBe('[rate-limit] hit')
    expect(req.warns[0]?.ctx['limiter']).toBe('submit')
    expect(req.warns[0]?.ctx['key']).toBe('user-1:submit')
  })

  it('floors Retry-After to 1 even if reset is in the past', () => {
    const reset = Date.now() - 1_000  // already past
    const res = makeRes()
    const req = makeReq()

    applyRateLimitHeaders(
      req as unknown as Request,
      res as unknown as Response,
      { success: false, limit: 5, remaining: 0, reset, pending: Promise.resolve() } as never,
      'auth:ip',
      '127.0.0.1',
    )

    expect(res.headers.get('retry-after')).toBe('1')
  })
})

// ─── tighter — picks the more-restrictive of two parallel limits ──────────────

describe('tighter — auth limiter result selection', () => {
  it('returns the failed result when one fails and the other passes', () => {
    const success = { success: true,  limit: 5, remaining: 4, reset: 0, pending: Promise.resolve() } as never
    const failed  = { success: false, limit: 5, remaining: 0, reset: 0, pending: Promise.resolve() } as never

    expect(tighter(success, failed)).toBe(failed)
    expect(tighter(failed, success)).toBe(failed)
  })

  it('returns the lower-remaining result when both pass', () => {
    const a = { success: true, limit: 5, remaining: 4, reset: 0, pending: Promise.resolve() } as never
    const b = { success: true, limit: 5, remaining: 1, reset: 0, pending: Promise.resolve() } as never

    expect(tighter(a, b)).toBe(b)
    expect(tighter(b, a)).toBe(b)
  })

  it('returns either when both pass with equal remaining', () => {
    const a = { success: true, limit: 5, remaining: 3, reset: 0, pending: Promise.resolve() } as never
    const b = { success: true, limit: 5, remaining: 3, reset: 0, pending: Promise.resolve() } as never

    // Tie-break is implementation-defined (current: first arg wins on equal),
    // but both are equally valid by contract.
    const result = tighter(a, b)
    expect(result === a || result === b).toBe(true)
  })
})

