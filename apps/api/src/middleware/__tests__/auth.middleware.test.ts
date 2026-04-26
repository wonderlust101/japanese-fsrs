import { describe, it, expect, mock } from 'bun:test'

// Must be registered before any module that transitively imports supabase.ts.
// The real module throws at load time when env vars are absent.
mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    auth: {
      // Default: simulate an invalid token. Overridden per-test where needed.
      getUser: mock(() =>
        Promise.resolve({
          data: { user: null },
          error: { message: 'Invalid JWT', status: 401 },
        })
      ),
    },
  },
}))

// Dynamic imports are required: mock.module() must be registered before
// the modules that depend on it are evaluated.
const { app }            = await import('../../app.ts')
const { default: request } = await import('supertest')

describe('authMiddleware — unauthenticated requests', () => {
  it('returns 401 when the Authorization header is absent', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Missing or malformed Authorization header')
  })

  it('returns 401 when the Authorization header is not Bearer format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Basic dXNlcjpwYXNz')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Missing or malformed Authorization header')
  })

  it('returns 401 when the token fails Supabase verification', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer invalid.jwt.token')

    expect(res.status).toBe(401)
    expect(res.body.error).toBe('Invalid or expired token')
  })
})
