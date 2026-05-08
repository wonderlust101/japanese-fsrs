import { randomUUID } from 'node:crypto'
import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
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
    .post('/api/v1/decks')
    .set('Authorization', `Bearer ${jwt}`)
    .set('Idempotency-Key', randomUUID())
    .send({ name: 'Reviews Deck', deckType: 'vocabulary' })
  if (deckRes.status !== 201) throw new Error(`createDeck failed: ${deckRes.status}`)

  return { userId, jwt, deckId: deckRes.body.id }
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

describeIntegration('reviews — submit advances FSRS state', () => {
  it('submitting a "good" review moves a New card out of state 0', async () => {
    const u = await seedUser(); seeded.push(u)

    // Create a fresh card
    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '本', reading: 'ほん', meaning: 'book' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id
    expect(createRes.body.state).toBe(0)
    const stabilityBefore = createRes.body.stability

    const submitRes = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ cardId, rating: 'good' })
    expect(submitRes.status).toBe(200)
    // Controller returns the reviewed-card raw (no `{ card: ... }` wrapper).
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
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '川', reading: 'かわ', meaning: 'river' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id

    const res = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ cardId, rating: 'manual' })
    // Zod rejects 'manual' since it's not in the public enum.
    expect([400, 422]).toContain(res.status)
  })
})

// Pinning the wire shape of GET /reviews/due. This is the most consequential
// leak that PR 1 closed — the endpoint used to return all 23 ApiCard fields
// (including FSRS internals like stability, difficulty, reps, lapses) under a
// contract that promised only 7 ApiDueCard fields. If a future change selects
// extra columns or swaps the mapper, this assertion fails.
const API_DUE_CARD_KEYS = [
  'cardType',
  'deckId',
  'due',
  'fieldsData',
  'id',
  'jlptLevel',
  'layoutType',
  'state',
].sort()

describeIntegration('reviews — Idempotency-Key replay', () => {
  it('rejects POST /reviews/submit without Idempotency-Key (400)', async () => {
    const u = await seedUser(); seeded.push(u)

    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '夢', reading: 'ゆめ', meaning: 'dream' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    const res = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ cardId, rating: 'good' })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Idempotency-Key')
  })

  it('replays the response and does not double-advance FSRS state on duplicate submit', async () => {
    const u = await seedUser(); seeded.push(u)

    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '光', reading: 'ひかり', meaning: 'light' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    const idempotencyKey = randomUUID()

    const first = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ cardId, rating: 'good' })
    expect(first.status).toBe(200)

    // Replay with the same key + same body — must return the same response
    // and must NOT double-advance the card's FSRS state.
    const replay = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ cardId, rating: 'good' })
    expect(replay.status).toBe(200)
    expect(replay.body).toEqual(first.body)

    // Same key + different body → 422 conflict.
    const conflict = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ cardId, rating: 'easy' })
    expect(conflict.status).toBe(422)
  })
})

describeIntegration('reviews — due card wire shape', () => {
  it('GET /api/v1/reviews/due returns rows whose keys exactly match ApiDueCard', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed at least one new card so the due list is non-empty.
    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '雪', reading: 'ゆき', meaning: 'snow' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)

    const dueRes = await request(app)
      .get('/api/v1/reviews/due')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(dueRes.status).toBe(200)
    expect(Array.isArray(dueRes.body.items)).toBe(true)
    expect(dueRes.body.items.length).toBeGreaterThan(0)
    expect(dueRes.body.hasMore).toBe(false)
    expect(dueRes.body.nextCursor).toBeNull()

    const keys = Object.keys(dueRes.body.items[0]).sort()
    expect(keys).toEqual(API_DUE_CARD_KEYS)
  })
})
