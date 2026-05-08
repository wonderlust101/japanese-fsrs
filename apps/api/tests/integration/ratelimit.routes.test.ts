import { it, expect, beforeAll, describe } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app: import('express').Express

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app } = await import('../../src/app'))
})

// Rate-limit middleware is gated to NODE_ENV === 'production' (see
// src/middleware/rateLimit.ts) so the dev/test paths bypass Upstash entirely.
// This integration test exercises the real limiter behavior, so it only runs
// when both integration is enabled AND NODE_ENV is production. In dev/test
// it skips silently — the rate-limiting code path it would exercise simply
// isn't active, and forcing it on would defeat the gating that keeps the rest
// of the suite fast.
const describeRateLimited =
  isIntegrationEnabled() && process.env['NODE_ENV'] === 'production' ? describe : describe.skip

describeRateLimited('rate limiting — auth signup per-email budget (5 / 15 min)', () => {
  it('returns 429 with Retry-After + X-RateLimit-* headers on the 6th attempt', async () => {
    // Fresh email keys a cold sliding window in Upstash. Even a same-second
    // burst across 6 requests should trip the 5-per-15-min email limiter.
    // Random suffix avoids cross-test collision in shared Upstash state.
    const email = `it-rl-${Date.now()}-${Math.random().toString(16).slice(2, 8)}@example.test`

    let lastStatus = 0
    let lastHeaders: Record<string, string | string[] | undefined> = {}
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/v1/auth/signup')
        .send({ email, password: 'integration-pass-rl-1', displayName: 'RL Test' })
      lastStatus  = res.status
      lastHeaders = res.headers
      if (res.status === 429) break
    }

    expect(lastStatus).toBe(429)
    expect(lastHeaders['retry-after']).toBeDefined()
    expect(lastHeaders['x-ratelimit-limit']).toBeDefined()
    expect(lastHeaders['x-ratelimit-remaining']).toBe('0')
    expect(lastHeaders['x-ratelimit-reset']).toBeDefined()
  })
})
