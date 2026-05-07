import { it, expect, beforeAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app: import('express').Express

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app } = await import('../../src/app'))
})

describeIntegration('rate limiting — auth signup per-email budget (5 / 15 min)', () => {
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
