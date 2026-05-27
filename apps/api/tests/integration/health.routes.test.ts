import { it, expect, beforeAll, beforeEach, afterEach } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app: import('express').Express
let rawRedis: typeof import('../../src/db/redis').rawRedis
let invalidateIsOpenCache: typeof import('../../src/lib/circuit-breaker').invalidateIsOpenCache

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app } = await import('../../src/app'))
  ;({ rawRedis } = await import('../../src/db/redis'))
  ;({ invalidateIsOpenCache } = await import('../../src/lib/circuit-breaker'))
})

// Other suites' card-create embeddings / AI calls fail against the dummy OpenAI
// key and open the openai-* breakers in the SHARED Redis. /_health/ready
// correctly reports any open breaker, so clear them before each readiness
// assertion — otherwise cross-file pollution turns "no breaker open" red.
beforeEach(async () => {
  if (!isIntegrationEnabled()) return
  for (const ns of ['openai-chat', 'openai-embeddings']) {
    await rawRedis.del(`circuit:${ns}:failures`)
    await rawRedis.del(`circuit:${ns}:probe`)
    invalidateIsOpenCache(ns)
  }
})

// Tests preset breaker state in Redis to verify the readiness endpoint
// surfaces it. Clean up after each test so a leaked-open breaker doesn't
// cascade across cases. We use the `openai-chat` breaker for tests that
// need the breaker to APPEAR open: the supabase ping inside /_health/ready
// would acquire the half-open probe, succeed against the real Supabase,
// and racily close the breaker before findOpenBreakers reads the state.
// `openai-chat` is never invoked by the health endpoint's pings, so its
// preset state remains visible end-to-end.
afterEach(async () => {
  if (!isIntegrationEnabled()) return
  await rawRedis.del('circuit:openai-chat:failures')
  await rawRedis.del('circuit:openai-chat:probe')
  invalidateIsOpenCache('openai-chat')
})

describeIntegration('GET /api/v1/_health/live', () => {
  it('always returns 200 with ok:true regardless of dep state', async () => {
    const res = await request(app).get('/api/v1/_health/live')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ ok: true })
  })
})

describeIntegration('GET /api/v1/_health/ready', () => {
  it('returns 200 when deps reachable and no breaker open', async () => {
    const res = await request(app).get('/api/v1/_health/ready')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
    expect(res.body.supabase).toBe('ok')
    expect(res.body.upstash).toBe('ok')
    expect(res.body.breakerOpen).toEqual([])
  })

  it('returns 503 when a breaker is open, listing the open namespaces', async () => {
    // openai-chat threshold is 10 — preset 10 to open it.
    await rawRedis.set('circuit:openai-chat:failures', 10, { ex: 300 })
    invalidateIsOpenCache('openai-chat')

    const res = await request(app).get('/api/v1/_health/ready')
    expect(res.status).toBe(503)
    expect(res.body.ok).toBe(false)
    expect(res.body.breakerOpen).toContain('openai-chat')
    // Deps themselves are reachable — only the breaker is the obstacle.
    expect(res.body.supabase).toBe('ok')
    expect(res.body.upstash).toBe('ok')
  })
})

describeIntegration('GET /api/v1/_health/deep', () => {
  it('returns 200 with full breaker snapshots across all 4 namespaces', async () => {
    const res = await request(app).get('/api/v1/_health/deep')
    expect(res.status).toBe(200)
    expect(res.body.live).toEqual({ ok: true })
    expect(res.body.ready.supabase).toBe('ok')
    expect(res.body.ready.upstash).toBe('ok')

    expect(res.body.breakers).toBeDefined()
    for (const name of ['openai-chat', 'openai-embeddings', 'supabase', 'upstash']) {
      const snap = res.body.breakers[name]
      expect(snap).toBeDefined()
      expect(typeof snap.failures).toBe('number')
      expect(typeof snap.threshold).toBe('number')
      expect(typeof snap.isOpen).toBe('boolean')
      expect(typeof snap.probeHeld).toBe('boolean')
      expect(typeof snap.windowTtl).toBe('number')
      expect(typeof snap.probeTtl).toBe('number')
    }
  })

  it('reflects preset breaker state in the snapshot shape', async () => {
    await rawRedis.set('circuit:openai-chat:failures', 7, { ex: 250 })
    invalidateIsOpenCache('openai-chat')

    const res = await request(app).get('/api/v1/_health/deep')
    expect(res.status).toBe(200)
    const snap = res.body.breakers['openai-chat']
    expect(snap.failures).toBe(7)
    expect(snap.isOpen).toBe(false)  // 7 < threshold 10
    expect(snap.windowTtl).toBeGreaterThan(0)
    expect(snap.windowTtl).toBeLessThanOrEqual(250)
  })
})
