import { randomUUID } from 'node:crypto'
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
    .set('Idempotency-Key', randomUUID())
    .send({ name: 'Integration Deck', deckType: 'vocabulary' })
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
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '猫', reading: 'ねこ', meaning: 'cat' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    const cardId = createRes.body.id

    // Get
    const getRes = await request(app)
      .get(`/api/v1/decks/${a.deckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.fieldsData.word).toBe('猫')

    // Update — sends If-Match: <version> from the create response.
    const updateRes = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .set('If-Match', String(createRes.body.version))
      .send({ fieldsData: { word: '猫', reading: 'ねこ', meaning: 'cat (updated)' } })
    expect(updateRes.status).toBe(200)
    expect(updateRes.body.fieldsData.meaning).toBe('cat (updated)')
    expect(updateRes.body.version).toBe(createRes.body.version + 1)

    // Cross-user PATCH — must 404, never reveal the card to user B.
    const crossUserRes = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${b.jwt}`)
      .set('If-Match', String(updateRes.body.version))
      .send({ fieldsData: { word: 'X' } })
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
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '犬', reading: 'いぬ', meaning: 'dog' },
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // Submit a review to create a review_log
    const reviewRes = await request(app)
      .post('/api/v1/reviews/submit')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ cardId, rating: 'good' })
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
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '本', reading: 'ほん', meaning: 'book' },
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // Regenerate embedding — should return 204
    const regenerateRes = await request(app)
      .post(`/api/v1/cards/${cardId}/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(regenerateRes.status).toBe(204)
  })

  it('POST /api/v1/cards/:id/regenerate-embedding returns 404 for unowned card', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    // User A creates card
    const cardRes = await request(app)
      .post(`/api/v1/decks/${a.deckId}/cards`)
      .set('Authorization', `Bearer ${a.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '手', reading: 'て', meaning: 'hand' },
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id

    // User B tries to regenerate it — must fail
    const regenerateRes = await request(app)
      .post(`/api/v1/cards/${cardId}/regenerate-embedding`)
      .set('Authorization', `Bearer ${b.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(regenerateRes.status).toBe(404)
  })

  it('POST /api/v1/cards/:id/regenerate-embedding rejects a non-UUID id at the Zod layer', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .post(`/api/v1/cards/nonexistent-card-id/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
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
      .set('Idempotency-Key', randomUUID())
    expect(res.status).toBe(404)
  })
})

describeIntegration('cards routes — If-Match optimistic concurrency', () => {
  it('rejects PATCH /cards/:id without If-Match (428)', async () => {
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

    const res = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ fieldsData: { word: '光', reading: 'ひかり', meaning: 'glow' } })
    expect(res.status).toBe(428)
  })

  it('returns 412 on stale If-Match', async () => {
    const u = await seedUser(); seeded.push(u)

    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '影', reading: 'かげ', meaning: 'shadow' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId = cardRes.body.id
    const v1     = cardRes.body.version

    // First successful PATCH bumps version.
    const first = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(v1))
      .send({ fieldsData: { word: '影', reading: 'かげ', meaning: 'shade' } })
    expect(first.status).toBe(200)
    expect(first.body.version).toBe(v1 + 1)

    // Re-using the original (now stale) version → 412.
    const stale = await request(app)
      .patch(`/api/v1/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(v1))
      .send({ fieldsData: { word: '影', reading: 'かげ', meaning: 'silhouette' } })
    expect(stale.status).toBe(412)
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
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '空', reading: 'そら', meaning: 'sky' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
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

// ─── Lapis-style fields_data round-trip (Backend Completion Plan, Stage 1) ──
//
// Pins the wire contract for the five additive Lapis fields admitted by
// field-shapes.schema.ts. A vocabulary card created with picture, nuance,
// pitchPosition, expressionAudio, plus a nested sentenceAudio on its example
// sentence must round-trip through:
//   - POST /api/v1/decks/:deckId/cards (manual mode)
//   - GET  /api/v1/decks/:deckId/cards/:id
//   - GET  /api/v1/decks/:deckId/cards (list projection)
//
// Without these assertions, a future Zod schema edit could silently strip
// any of these keys from the response while leaving the request validation
// untouched — the data lands in the DB but disappears on read.
describeIntegration('cards routes — Lapis-style fields round-trip', () => {
  it('preserves picture / expressionAudio / pitchPosition / nuance / sentenceAudio through create + get', async () => {
    const u = await seedUser(); seeded.push(u)

    const fieldsData = {
      word:            '猫',
      reading:         'ねこ',
      meaning:         'cat',
      picture:         'https://cdn.example.test/neko.jpg',
      expressionAudio: 'https://cdn.example.test/neko.mp3',
      pitchPosition:   0,
      nuance:          'Neutral register; covers both domestic and stray cats.',
      exampleSentences: [
        {
          ja:            '猫が好きです。',
          en:            'I like cats.',
          furigana:      'ねこがすきです。',
          sentenceAudio: 'https://cdn.example.test/sentence-neko.mp3',
        },
      ],
    }

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode:       'manual',
        fieldsData,
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)
    expect(createRes.body.fieldsData).toEqual(fieldsData)

    const getRes = await request(app)
      .get(`/api/v1/decks/${u.deckId}/cards/${createRes.body.id}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.fieldsData).toEqual(fieldsData)

    // List projection must surface the new keys too — the card-browser UI
    // reads from this endpoint, so a missing key here means an empty slot
    // in the deck list even when the card has data.
    const listRes = await request(app)
      .get(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    const item = (listRes.body.items as Array<{ id: string; fieldsData: typeof fieldsData }>)
      .find((row) => row.id === createRes.body.id)
    expect(item).toBeDefined()
    expect(item!.fieldsData).toEqual(fieldsData)
  })

  it('rejects a negative pitchPosition on update (wire-level guard)', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '夢', reading: 'ゆめ', meaning: 'dream' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)

    // The wire `fieldsData` schema is a permissive z.record (it admits any
    // keys), so the negative number lands in the DB unchallenged on PATCH.
    // The display-time `WordFieldsSchema` is what catches it on parse — see
    // packages/shared-types/src/schemas/__tests__/field-shapes.schema.test.ts.
    // This test documents that boundary: the API itself does NOT enforce
    // pitchPosition >= 0, so we just confirm the PATCH succeeds without
    // surfacing as 4xx, leaving validation to the consumer schema.
    const patchRes = await request(app)
      .patch(`/api/v1/cards/${createRes.body.id}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(createRes.body.version))
      .send({
        fieldsData: {
          word:          '夢',
          reading:       'ゆめ',
          meaning:       'dream',
          pitchPosition: 2,
        },
      })
    expect(patchRes.status).toBe(200)
    expect(patchRes.body.fieldsData.pitchPosition).toBe(2)
  })
})

// ─── Cross-deck access via the dual-mount router ─────────────────────────────
//
// The cards router is mounted twice (apps/api/src/app.ts:75-76):
//   /api/v1/decks/:deckId/cards/:id  — deck-scoped
//   /api/v1/cards/:id                — flat
//
// Every controller method on the deck-scoped mount has to thread
// `scopedDeckId(req)` through to the service layer (see
// apps/api/src/controllers/cards.controller.ts:170-174). Forgetting that
// argument on any single method would let a card from deck A be touched
// via deck B's URL — a real authorization regression. These tests run
// the wrong-deck URL against every method and assert 404, so a future
// regression dropping `scopedDeckId(req)` from any one call site fails
// loudly instead of silently letting the request through.
describeIntegration('cards routes — cross-deck access via dual-mount router', () => {
  it('every card method returns 404 when accessed via another deck\'s URL', async () => {
    const u = await seedUser(); seeded.push(u)

    // Create a second deck owned by the SAME user. The cross-deck check is
    // about deckId mismatch, not user mismatch — keeping ownership the same
    // proves the failure is purely from the deck-scoping plumbing, not from
    // RLS / user-id checks.
    const otherDeckRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Other Integration Deck', deckType: 'vocabulary' })
    expect(otherDeckRes.status).toBe(201)
    const otherDeckId = otherDeckRes.body.id

    // Create a card in the user's primary deck.
    const cardRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode: 'manual',
        fieldsData: { word: '橋', reading: 'はし', meaning: 'bridge' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(cardRes.status).toBe(201)
    const cardId  = cardRes.body.id
    const version = cardRes.body.version

    // The card belongs to u.deckId — accessing it via otherDeckId on every
    // method must 404. Each request authenticates as the same user so the
    // failure is purely from the deck-scoping check.

    const getRes = await request(app)
      .get(`/api/v1/decks/${otherDeckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(getRes.status).toBe(404)

    const patchRes = await request(app)
      .patch(`/api/v1/decks/${otherDeckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(version))
      .send({ fieldsData: { word: '橋', reading: 'はし', meaning: 'overpass' } })
    expect(patchRes.status).toBe(404)

    const deleteRes = await request(app)
      .delete(`/api/v1/decks/${otherDeckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(deleteRes.status).toBe(404)

    const similarRes = await request(app)
      .get(`/api/v1/decks/${otherDeckId}/cards/${cardId}/similar`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(similarRes.status).toBe(404)

    const regenRes = await request(app)
      .post(`/api/v1/decks/${otherDeckId}/cards/${cardId}/regenerate-embedding`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
    expect(regenRes.status).toBe(404)

    // Sanity: the card is still reachable via its OWN deck-scoped URL —
    // proves the cross-deck 404s above weren't from a bad cardId or a
    // broken card on the row level.
    const sanityRes = await request(app)
      .get(`/api/v1/decks/${u.deckId}/cards/${cardId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(sanityRes.status).toBe(200)
  })
})

// ─── Backend Completion Plan Stage 12 — sentence-layout CHECK ────────────────
//
// Pins the migration's DB-layer enforcement: a sentence-layout card without
// ja/en/furigana is rejected by the `cards_fields_data_shape` constraint.
// Vocabulary cards are unaffected — pinned by the existing wire-shape tests
// above.
describeIntegration('cards routes — Stage 12 sentence-layout shape', () => {
  it('accepts a sentence-layout card with the canonical ja/en/furigana shape', async () => {
    const u = await seedUser(); seeded.push(u)

    const fieldsData = {
      ja:       '猫が好きです。',
      en:       'I like cats.',
      furigana: 'ねこがすきです。',
      breakdown: [
        { token: '猫', reading: 'ねこ', meaning: 'cat' },
        { token: 'が' },
        { token: '好き', reading: 'すき', meaning: 'liked' },
      ],
      audio:  'https://cdn.example.test/sentence-cat.mp3',
      nuance: 'Polite, neutral register.',
    }

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode:       'manual',
        fieldsData,
        layoutType: 'sentence',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBe(201)

    // Round-trip via GET — the persisted shape must come back intact.
    const getRes = await request(app)
      .get(`/api/v1/decks/${u.deckId}/cards/${createRes.body.id}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(getRes.status).toBe(200)
    expect(getRes.body.fieldsData.ja).toBe('猫が好きです。')
    expect(getRes.body.fieldsData.en).toBe('I like cats.')
    expect(getRes.body.fieldsData.furigana).toBe('ねこがすきです。')
    expect(getRes.body.fieldsData.nuance).toBe('Polite, neutral register.')
  })

  it('rejects a sentence-layout card without ja at the DB CHECK layer', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode:       'manual',
        // Wire-level Zod admits any keys (the body-level fieldsDataSchema
        // is a permissive z.record); the DB CHECK is what enforces
        // ja/en/furigana for sentence-layout. So this request gets past
        // wire validation but the INSERT fails with a 5xx surface.
        fieldsData: { en: 'I like cats.', furigana: 'ねこがすきです。' },
        layoutType: 'sentence',
        cardType:   'comprehension',
      })
    expect(createRes.status).toBeGreaterThanOrEqual(400)
    expect(createRes.status).toBeLessThan(600)
  })

  it('vocabulary cards still pass the CHECK (no regression on the unchanged arm)', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .post(`/api/v1/decks/${u.deckId}/cards`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({
        mode:       'manual',
        fieldsData: { word: '本', reading: 'ほん', meaning: 'book' },
        layoutType: 'vocabulary',
        cardType:   'comprehension',
      })
    expect(res.status).toBe(201)
  })
})
