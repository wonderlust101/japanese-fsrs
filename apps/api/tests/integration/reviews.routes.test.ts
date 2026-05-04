import { it, expect, beforeAll, afterAll } from 'bun:test'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let request:       typeof import('supertest').default
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string; deckId: string }

const seeded: SeededUser[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-reviews-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
  const created = await supabaseAdmin.auth.admin.createUser({
    email, password: 'integration-pass', email_confirm: true,
  })
  if (created.error !== null || created.data.user === null) throw new Error(`createUser failed: ${created.error?.message}`)
  const userId = created.data.user.id

  const session = await supabaseAdmin.auth.signInWithPassword({ email, password: 'integration-pass' })
  if (session.error !== null || session.data.session === null) throw new Error('session failed')

  const jwt = session.data.session.access_token

  const deckRes = await request(app)
    .post('/api/v1/decks').set('Authorization', `Bearer ${jwt}`)
    .send({ name: 'Reviews Deck', deck_type: 'vocabulary' })
  if (deckRes.status !== 201) throw new Error(`createDeck failed: ${deckRes.status}`)

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

describeIntegration('reviews — submit advances FSRS state', () => {
  it('submitting a "good" review moves a New card out of state 0', async () => {
    const u = await seedUser(); seeded.push(u)

    // Create a fresh card
    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({
        fields_data: { word: '本', reading: 'ほん', meaning: 'book' },
        layout_type: 'vocabulary',
        card_type:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id
    expect(createRes.body.state).toBe(0)
    const stabilityBefore = createRes.body.stability

    const submitRes = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ cardId, rating: 'good' })
    expect(submitRes.status).toBe(200)
    expect(submitRes.body.id).toBe(cardId)
    // After a Good rating from New, FSRS moves the card off state 0 and
    // assigns positive stability.
    expect(submitRes.body.state).toBeGreaterThan(0)
    expect(submitRes.body.stability).toBeGreaterThan(stabilityBefore)
  })

  it('rejects a "manual" rating at the validation layer', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({
        fields_data: { word: '川', reading: 'かわ', meaning: 'river' },
        layout_type: 'vocabulary',
        card_type:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id

    const res = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ cardId, rating: 'manual' })
    // Zod rejects 'manual' since it's not in the public enum.
    expect([400, 422]).toContain(res.status)
  })
})
