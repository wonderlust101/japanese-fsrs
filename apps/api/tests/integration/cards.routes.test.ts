import { it, expect, beforeAll, afterAll } from 'bun:test'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let request:       typeof import('supertest').default
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser {
  userId: string
  jwt:    string
  deckId: string
}

const seeded: SeededUser[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-cards-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password:      'integration-pass',
    email_confirm: true,
  })
  if (error !== null || data.user === null) throw new Error(`createUser failed: ${error?.message ?? 'unknown'}`)
  const userId = data.user.id

  const sessionRes = await supabaseAdmin.auth.signInWithPassword({ email, password: 'integration-pass' })
  if (sessionRes.error !== null || sessionRes.data.session === null) {
    throw new Error(`session generation failed: ${sessionRes.error?.message ?? 'no session'}`)
  }
  const jwt = sessionRes.data.session.access_token

  const deckRes = await request(app)
    .post('/api/v1/decks')
    .set('Authorization', `Bearer ${jwt}`)
    .send({ name: 'Integration Deck', deck_type: 'vocabulary' })
  if (deckRes.status !== 201) throw new Error(`createDeck failed: ${deckRes.status} ${JSON.stringify(deckRes.body)}`)

  return { userId, jwt, deckId: deckRes.body.id }
}

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app }            = await import('../../src/app'))
  ;({ default: request } = await import('supertest'))
  ;({ supabaseAdmin }  = await import('../../src/db/supabase'))
})

afterAll(async () => {
  if (!isIntegrationEnabled()) return
  for (const u of seeded) {
    await supabaseAdmin.auth.admin.deleteUser(u.userId).catch(() => undefined)
  }
})

describeIntegration('cards routes — create / get / update / delete + RLS', () => {
  it('runs the full lifecycle and isolates cross-user access', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    // Create
    const createRes = await request(app)
      .post(`/api/v1/decks/${a.deckId}/cards`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .send({
        fields_data: { word: '猫', reading: 'ねこ', meaning: 'cat' },
        layout_type: 'vocabulary',
        card_type:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id

    // Get
    const getRes = await request(app)
      .get(`/api/v1/decks/${a.deckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.fieldsData.word).toBe('猫')

    // Update
    const updateRes = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .send({ fields_data: { word: '猫', reading: 'ねこ', meaning: 'cat (updated)' } })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.fieldsData.meaning).toBe('cat (updated)')

    // Cross-user PATCH — must 404, never reveal the card to user B.
    const crossUserRes = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${b.jwt}`)
      .send({ fields_data: { word: 'X' } })
    expect(crossUserRes.status).toBe(404)

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
    expect(deleteRes.status).toBe(204)

    // Confirm gone
    const getAfterDelete = await request(app)
      .get(`/api/v1/decks/${a.deckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
    expect(getAfterDelete.status).toBe(404)
  })
})
