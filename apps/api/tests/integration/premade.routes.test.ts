import { randomUUID } from 'node:crypto'
import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = []
// Premade deck IDs created by the test for isolation. Cleaned up in afterAll;
// cascades remove `user_premade_subscriptions` and any forked `decks` rows.
const seededPremadeDeckIds: string[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-premade-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
  const created = await supabaseAdmin.auth.admin.createUser({
    email, password: 'integration-pass', email_confirm: true,
  })
  if (created.error !== null || created.data.user === null) throw new Error(`createUser failed: ${created.error?.message}`)
  const userId = created.data.user.id

  const session = await supabaseAdmin.auth.signInWithPassword({ email, password: 'integration-pass' })
  if (session.error !== null || session.data.session === null) throw new Error('session failed')

  return { userId, jwt: session.data.session.access_token }
}

// Creates a test-scoped premade deck so the integration test can mutate
// `premade_decks.version` without polluting shared seed data. The seed
// migration's premade decks are read by other tests; mutating them across
// concurrent runs would cause flakes.
async function seedPremadeDeck(): Promise<string> {
  const id = randomUUID()
  const { error } = await supabaseAdmin
    .from('premade_decks')
    .insert({
      id,
      name:        `Stage 4 Test Deck ${Date.now()}`,
      description: 'integration-test only — deleted in afterAll',
      deck_type:   'vocabulary',
      jlpt_level:  'N5',
      domain:      null,
      is_active:   true,
      // version starts at the default (1); we override directly when the test
      // needs to simulate "source deck content updated".
    })
  if (error !== null) throw new Error(`createPremadeDeck failed: ${error.message}`)
  seededPremadeDeckIds.push(id)
  return id
}

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app }           = await import('../../src/app'))
  ;({ supabaseAdmin } = await import('../../src/db/supabase'))
})

afterAll(async () => {
  if (!isIntegrationEnabled()) return
  for (const u of seeded) {
    await supabaseAdmin.auth.admin.deleteUser(u.userId).catch(() => undefined)
  }
  // Delete the test-scoped premade decks. Cascades clean up
  // user_premade_subscriptions and any forked decks under the (already
  // deleted) test users.
  for (const id of seededPremadeDeckIds) {
    await supabaseAdmin.from('premade_decks').delete().eq('id', id).then(() => undefined, () => undefined)
  }
})

// Backend Completion Plan Stage 4 — surface `version` + `lastSeenVersion` on
// GET /api/v1/premade-decks/subscriptions/me. Pins the wire shape and proves
// the "new content available" comparison works end-to-end: a fresh
// subscription reports version === lastSeenVersion; bumping the source
// deck's version (simulating a catalogue content update) makes
// version > lastSeenVersion without touching the subscriber's row.
describeIntegration('premade subscriptions routes — Stage 4 version surfacing', () => {
  it('GET /subscriptions/me returns version + lastSeenVersion, equal for fresh subscriptions', async () => {
    const u            = await seedUser(); seeded.push(u)
    const premadeId    = await seedPremadeDeck()

    // Subscribe via the public API so the user owns a forked deck on the
    // /decks side — listSubscriptionsRaw filters subscriptions to those with
    // a live fork (orphan-cleanup invariant), so a direct
    // user_premade_subscriptions insert wouldn't surface here.
    const subscribeRes = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/subscribe`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    // 201 (fresh) or 200 (idempotent re-subscribe — won't happen on first call,
    // but the API treats both as success and both surface the same row shape).
    expect([200, 201]).toContain(subscribeRes.status)

    const listRes = await request(app)
      .get('/api/v1/premade-decks/subscriptions/me')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.items)).toBe(true)

    const row = (listRes.body.items as Array<{
      premadeDeckId:   string
      version:         number
      lastSeenVersion: number
    }>).find((r) => r.premadeDeckId === premadeId)
    expect(row).toBeDefined()
    // Both columns default to 1; the seed insert above doesn't override
    // version, so the fresh-subscription invariant holds.
    expect(row!.version).toBe(1)
    expect(row!.lastSeenVersion).toBe(1)
    expect(row!.version).toBe(row!.lastSeenVersion)
  })

  it('reports version > lastSeenVersion once the source deck has been content-updated', async () => {
    const u         = await seedUser(); seeded.push(u)
    const premadeId = await seedPremadeDeck()

    const subscribeRes = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/subscribe`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect([200, 201]).toContain(subscribeRes.status)

    // Simulate a catalogue content update by bumping the source deck's
    // version directly. Stage 5 will introduce the proper sync RPC that
    // bumps `last_seen_version` after pulling new cards; until then, the
    // version+last_seen_version pair is the read-only signal the frontend
    // uses to render a "new content available" badge.
    const { error: bumpError } = await supabaseAdmin
      .from('premade_decks')
      .update({ version: 2 })
      .eq('id', premadeId)
    if (bumpError !== null) throw new Error(`bump version failed: ${bumpError.message}`)

    const listRes = await request(app)
      .get('/api/v1/premade-decks/subscriptions/me')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)

    const row = (listRes.body.items as Array<{
      premadeDeckId:   string
      version:         number
      lastSeenVersion: number
    }>).find((r) => r.premadeDeckId === premadeId)
    expect(row).toBeDefined()
    expect(row!.version).toBe(2)
    expect(row!.lastSeenVersion).toBe(1)
    expect(row!.version).toBeGreaterThan(row!.lastSeenVersion)
  })
})
