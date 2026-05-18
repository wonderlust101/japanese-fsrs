import { randomUUID } from 'node:crypto'
import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = []
// Premade deck IDs created by the test for isolation. Cleaned up in afterAll;
// cascades remove any forked `decks` rows (and their cards) under the also-
// deleted test users, so we don't need to delete those explicitly.
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

interface PremadeOptions {
  isActive?: boolean
  cardCount?: number
}

/**
 * Creates a test-scoped premade deck (catalogue entry) plus the requested
 * number of source cards (user_id IS NULL). Source cards live in the
 * catalogue; copy_premade_deck clones them into a user-owned deck.
 *
 * Scoped per-test so version mutations / inactive flags don't pollute the
 * shared seed catalogue.
 */
async function seedPremadeDeck(opts: PremadeOptions = {}): Promise<string> {
  const id = randomUUID()
  const { error } = await supabaseAdmin
    .from('premade_decks')
    .insert({
      id,
      name:        `Stage 4 Copy Test Deck ${Date.now()}`,
      description: 'integration-test only — deleted in afterAll',
      deck_type:   'vocabulary',
      jlpt_level:  'N5',
      domain:      null,
      is_active:   opts.isActive ?? true,
    })
  if (error !== null) throw new Error(`createPremadeDeck failed: ${error.message}`)
  seededPremadeDeckIds.push(id)

  // Seed N source cards. The copy RPC clones rows WHERE premade_deck_id =
  // <deck> AND user_id IS NULL — these are the rows that condition matches.
  const cards = Array.from({ length: opts.cardCount ?? 2 }, (_, i) => ({
    id:              randomUUID(),
    user_id:         null,
    deck_id:         null,
    premade_deck_id: id,
    layout_type:     'vocabulary' as const,
    fields_data:     { word: `源-${i}`, reading: `げん${i}`, meaning: `source ${i}` },
    card_type:       'comprehension' as const,
    jlpt_level:      'N5' as const,
  }))
  if (cards.length > 0) {
    const { error: cardsError } = await supabaseAdmin.from('cards').insert(cards)
    if (cardsError !== null) throw new Error(`createCards failed: ${cardsError.message}`)
  }
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
  // Delete the test-scoped premade decks. cascade=SET NULL on cards →
  // premade_decks (cards stay around with premade_deck_id = NULL), so we
  // explicitly delete the source cards first.
  for (const id of seededPremadeDeckIds) {
    await supabaseAdmin.from('cards').delete().eq('premade_deck_id', id).is('user_id', null).then(() => undefined, () => undefined)
    await supabaseAdmin.from('premade_decks').delete().eq('id', id).then(() => undefined, () => undefined)
  }
})

// Backend Completion Plan Stage 4 (copy model). The route renamed from
// /:id/subscribe to /:id/copy. Subscriptions and version surfacing are gone.
// Tests pin the four acceptance criteria from the plan:
//   (a) fresh copy
//   (b) duplicate copy → two independent decks
//   (c) copy → delete → copy again → third independent deck
//   (d) copy of an inactive deck → 404
describeIntegration('premade copy route — Stage 4 acceptance', () => {
  it('POST /premade-decks/:id/copy creates a new owned deck with fresh FSRS state', async () => {
    const u         = await seedUser(); seeded.push(u)
    const premadeId = await seedPremadeDeck({ cardCount: 2 })

    const copyRes = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(copyRes.status).toBe(201)
    expect(copyRes.headers['location']).toBe(`/api/v1/decks/${copyRes.body.deckId}`)
    expect(typeof copyRes.body.deckId).toBe('string')
    expect(copyRes.body.cardCount).toBe(2)

    // The new deck is fetchable via /api/v1/decks/:id with the same wire
    // shape every user-created deck has. After Stage 4 there is no special
    // path through deleteDeck; every deck is identical.
    const deckRes = await request(app)
      .get(`/api/v1/decks/${copyRes.body.deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(deckRes.status).toBe(200)
    expect(deckRes.body.sourcePremadeId).toBe(premadeId)
    expect(deckRes.body.newCount).toBe(2)
    expect(deckRes.body.lastReviewedAt).toBeNull()
  })

  it('two consecutive copies of the same premade deck produce two independent decks', async () => {
    const u         = await seedUser(); seeded.push(u)
    const premadeId = await seedPremadeDeck({ cardCount: 1 })

    const first = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(first.status).toBe(201)

    const second = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      // Distinct idempotency key — the copy model deliberately allows
      // duplicate copies. Same key would replay the original 201.
      .set('Idempotency-Key', randomUUID())
    expect(second.status).toBe(201)

    expect(first.body.deckId).not.toBe(second.body.deckId)
  })

  it('copy → delete → copy again produces a third independent deck (no subscription junction in the way)', async () => {
    const u         = await seedUser(); seeded.push(u)
    const premadeId = await seedPremadeDeck({ cardCount: 1 })

    const first = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(first.status).toBe(201)

    // Deleting the copied deck uses the SAME path as deleting any other
    // user-owned deck. No `is_premade_fork` branch, no unsubscribe RPC.
    const del = await request(app)
      .delete(`/api/v1/decks/${first.body.deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(del.status).toBe(204)

    const third = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(third.status).toBe(201)
    expect(third.body.deckId).not.toBe(first.body.deckId)
  })

  it('copy of an inactive premade deck returns 404 with PREMADE_DECK_NOT_FOUND', async () => {
    const u         = await seedUser(); seeded.push(u)
    const premadeId = await seedPremadeDeck({ isActive: false, cardCount: 1 })

    const res = await request(app)
      .post(`/api/v1/premade-decks/${premadeId}/copy`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(res.status).toBe(404)
    expect(res.body.code).toBe('PREMADE_DECK_NOT_FOUND')
  })
})
