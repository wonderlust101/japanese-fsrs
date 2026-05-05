import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
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
  ;({ app }           = await import('../../src/app'))
  ;({ supabaseAdmin } = await import('../../src/db/supabase'))
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

describeIntegration('cards routes — cascading deletes', () => {
  it('preserves review_logs when a card is deleted (SET NULL)', async () => {
    const u = await seedUser(); seeded.push(u)

    // Create card
    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({
        fields_data: { word: '犬', reading: 'いぬ', meaning: 'dog' },
        card_type:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // Submit a review to create a review_log
    const reviewRes = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ card_id: cardId, rating: 'good' })
    expect(reviewRes.status).toBe(200)

    // Delete the card — review_log.card_id should become NULL (not deleted)
    const deleteRes = await request(app)
      .delete(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(deleteRes.status).toBe(204)

    // Verify card is gone
    const getRes = await request(app)
      .get(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(getRes.status).toBe(404)

    // Verify analytics still work (review_logs preserved)
    const heatmapRes = await request(app)
      .get('/api/v1/analytics/heatmap')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(heatmapRes.status).toBe(200)
    // Should not crash even though the card that created the review_log is gone
  })
})

describeIntegration('cards routes — regenerate-embedding', () => {
  it('POST /api/v1/cards/:id/regenerate-embedding returns 204 for own card', async () => {
    const u = await seedUser(); seeded.push(u)

    // Create card
    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({
        fields_data: { word: '本', reading: 'ほん', meaning: 'book' },
        card_type:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // Regenerate embedding — should return 204
    const regenerateRes = await request(app)
      .post(`/api/v1/cards/${cardId}/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(regenerateRes.status).toBe(204)
  })

  it('POST /api/v1/cards/:id/regenerate-embedding returns 404 for unowned card', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    // User A creates card
    const cardRes = await request(app)
      .post(`/api/v1/decks/${a.deckId}/cards`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .send({
        fields_data: { word: '手', reading: 'て', meaning: 'hand' },
        card_type:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // User B tries to regenerate it — must fail
    const regenerateRes = await request(app)
      .post(`/api/v1/cards/${cardId}/regenerate-embedding`)
      .set('Authorization', `Bearer ${b.jwt}`)
    expect(regenerateRes.status).toBe(404)
  })

  it('POST /api/v1/cards/:id/regenerate-embedding rejects a non-UUID id at the Zod layer', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .post(`/api/v1/cards/nonexistent-card-id/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
    // cardIdParamSchema requires UUID — Zod returns 400 (errorHandler maps ZodError → 400).
    expect([400, 422]).toContain(res.status)
  })

  it('POST /api/v1/cards/:id/regenerate-embedding returns 404 for a valid-but-nonexistent UUID', async () => {
    const u = await seedUser(); seeded.push(u)

    // Valid UUIDv4 that does not match any seeded card.
    const fakeUuid = '00000000-0000-4000-8000-000000000000'
    const res = await request(app)
      .post(`/api/v1/cards/${fakeUuid}/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(404)
  })
})

// Pinning the wire shape for the deck card-browser list. Any drift from
// ApiCardListItem (e.g. accidentally re-including FSRS internals like
// stability/difficulty/reps) will fail this test.
const API_CARD_LIST_ITEM_KEYS = [
  'cardType',
  'due',
  'fieldsData',
  'id',
  'isSuspended',
  'jlptLevel',
  'layoutType',
  'state',
  'tags',
].sort()

describeIntegration('cards routes — list wire shape', () => {
  it('GET /api/v1/decks/:deckId/cards returns items whose keys exactly match ApiCardListItem', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({
        fields_data: { word: '空', reading: 'そら', meaning: 'sky' },
        layout_type: 'vocabulary',
        card_type:   'comprehension',
      })
    expect(createRes.status).toBe(201)

    const listRes = await request(app)
      .get(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.items)).toBe(true)
    expect(listRes.body.items.length).toBeGreaterThan(0)

    const keys = Object.keys(listRes.body.items[0]).sort()
    expect(keys).toEqual(API_CARD_LIST_ITEM_KEYS)
  })
})
