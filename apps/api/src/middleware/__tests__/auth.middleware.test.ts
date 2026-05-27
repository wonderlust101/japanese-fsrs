import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import type { Request, Response, NextFunction } from 'express'

import { freezeClock, restoreClock, supabaseAuthMock } from '../../../tests/support'

// authMiddleware's only external dependency under test is
// supabaseAdmin.auth.getUser — the L2 (Redis) cache is gated off when
// NODE_ENV === 'test'. We drive getUser through the shared mock and assert the
// L1 token cache (30s, keyed by SHA-256 of the bearer token) verifies once,
// expires on schedule, and never serves one user from another's token.
//
// Must be registered before any module that transitively imports supabase.ts.
mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: { auth: { getUser: supabaseAuthMock.getUser } },
}))

const { app }              = await import('../../app.ts')
const { default: request } = await import('supertest')
const { authMiddleware, _clearTokenCacheForTests } = await import('../auth.ts')

beforeEach(() => {
  _clearTokenCacheForTests()
  supabaseAuthMock.reset()   // default: every token is invalid
  restoreClock()
})
afterEach(() => { restoreClock() })

// ── Direct-call helpers (true unit, no HTTP stack) ─────────────────────────────

function fakeReq(token?: string): { headers: { authorization?: string }; user?: { id: string } } {
  return token === undefined ? { headers: {} } : { headers: { authorization: `Bearer ${token}` } }
}

interface RunResult { user: { id: string } | undefined; err: unknown; nexted: boolean }

async function run(req: ReturnType<typeof fakeReq>): Promise<RunResult> {
  let err: unknown
  let nexted = false
  await authMiddleware(
    req as unknown as Request,
    {} as Response,
    ((e?: unknown) => { nexted = true; err = e }) as NextFunction,
  )
  return { user: req.user, err, nexted }
}

// ── Rejection paths (supertest against the real app) ───────────────────────────

describe('authMiddleware — rejects unauthenticated requests', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    const res = await request(app).post('/api/v1/auth/logout')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Missing or malformed Authorization header')
  })

  it('returns 401 when the Authorization header is not Bearer format', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Authorization', 'Basic dXNlcjpwYXNz')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Missing or malformed Authorization header')
  })

  it('returns 401 when the token fails Supabase verification', async () => {
    const res = await request(app).post('/api/v1/auth/logout').set('Authorization', 'Bearer invalid.jwt.token')
    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired token')
  })
})

// ── Verification, caching, isolation (direct unit calls) ───────────────────────

describe('authMiddleware — verification, caching, and isolation', () => {
  it('attaches the user and calls next() with no error for a valid token', async () => {
    supabaseAuthMock.impl = () => ({ data: { user: { id: 'user-A' } }, error: null })

    const out = await run(fakeReq('tok-A'))

    expect(out.nexted).toBe(true)
    expect(out.err).toBeUndefined()
    expect(out.user?.id).toBe('user-A')
  })

  it('calls next(error) with a 401 when getUser rejects the token', async () => {
    supabaseAuthMock.impl = () => ({ data: { user: null }, error: { message: 'Invalid JWT' } })

    const out = await run(fakeReq('bad-token'))

    expect((out.err as { statusCode?: number; code?: string }).statusCode).toBe(401)
    expect((out.err as { code?: string }).code).toBe('AUTH_TOKEN_INVALID')
    expect(out.user).toBeUndefined()
  })

  it('serves the second request from the L1 cache without re-verifying', async () => {
    supabaseAuthMock.impl = () => ({ data: { user: { id: 'user-A' } }, error: null })

    await run(fakeReq('tok-A'))
    await run(fakeReq('tok-A'))

    expect(supabaseAuthMock.calls).toEqual(['tok-A'])   // verified once, then cached
  })

  it('never serves user B from user A\'s cache entry (cache is keyed by token)', async () => {
    supabaseAuthMock.impl = (token) => ({ data: { user: { id: token === 'tok-A' ? 'user-A' : 'user-B' } }, error: null })

    const a = await run(fakeReq('tok-A'))
    const b = await run(fakeReq('tok-B'))

    expect(a.user?.id).toBe('user-A')
    expect(b.user?.id).toBe('user-B')                   // no cross-user leak
    expect(supabaseAuthMock.calls).toEqual(['tok-A', 'tok-B'])
  })

  it('re-verifies once the 30s cache entry has expired', async () => {
    supabaseAuthMock.impl = () => ({ data: { user: { id: 'user-A' } }, error: null })

    freezeClock('2026-05-17T00:00:00.000Z')
    await run(fakeReq('tok-A'))                          // miss → verify (cached until +30s)
    await run(fakeReq('tok-A'))                          // hit
    freezeClock('2026-05-17T00:00:31.000Z')             // 31s later — past the 30s TTL
    await run(fakeReq('tok-A'))                          // miss → re-verify

    expect(supabaseAuthMock.calls).toEqual(['tok-A', 'tok-A'])
  })
})
