import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-decks-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
  const created = await supabaseAdmin.auth.admin.createUser({
    email, password: 'integration-pass', email_confirm: true,
  })
  if (created.error !== null || created.data.user === null) throw new Error(`createUser failed: ${created.error?.message}`)
  const userId = created.data.user.id

  const session = await supabaseAdmin.auth.signInWithPassword({ email, password: 'integration-pass' })
  if (session.error !== null || session.data.session === null) throw new Error('session failed')

  return { userId, jwt: session.data.session.access_token }
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
})

// Pinning the wire shape: any future addition / removal of a field on the
// service-layer DeckRow / DeckWithStats must come with a deliberate update
// to ApiDeck / ApiDeckWithStats and to these key-set assertions. This is
// what stops the leak we just fixed from creeping back in.
const API_DECK_KEYS = [
  'cardCount',
  'createdAt',
  'deckType',
  'description',
  'id',
  'isPremadeFork',
  'name',
  'sourcePremadeId',
  'updatedAt',
].sort()

const API_DECK_WITH_STATS_KEYS = [...API_DECK_KEYS, 'dueCount', 'newCount'].sort()

describeIntegration('decks routes — wire shape', () => {
  it('GET /api/v1/decks returns rows whose keys exactly match ApiDeck', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ name: 'Wire-shape Deck', description: 'check fields', deck_type: 'vocabulary' })
    expect(createRes.status).toBe(201)

    const listRes = await request(app)
      .get('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body)).toBe(true)
    expect(listRes.body.length).toBeGreaterThan(0)

    const keys = Object.keys(listRes.body[0]).sort()
    expect(keys).toEqual(API_DECK_KEYS)
  })

  it('GET /api/v1/decks/:id returns a row whose keys exactly match ApiDeckWithStats', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ name: 'Wire-shape Deck Detail', deck_type: 'vocabulary' })
    expect(createRes.status).toBe(201)
    const deckId = createRes.body.id

    const detailRes = await request(app)
      .get(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(detailRes.status).toBe(200)

    const keys = Object.keys(detailRes.body).sort()
    expect(keys).toEqual(API_DECK_WITH_STATS_KEYS)
  })

  it('POST /api/v1/decks returns a row whose keys exactly match ApiDeck', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ name: 'Created Deck', deck_type: 'vocabulary' })
    expect(createRes.status).toBe(201)

    const keys = Object.keys(createRes.body).sort()
    expect(keys).toEqual(API_DECK_KEYS)
  })
})
