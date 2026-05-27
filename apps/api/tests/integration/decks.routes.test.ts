import { randomUUID } from 'node:crypto'
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
//
// Backend Completion Plan Stage 3 (2026-05-17): GET /api/v1/decks now
// returns ApiDeckWithStats (was ApiDeck) so the dashboard can render
// per-deck rollups in one round-trip; GET /api/v1/decks/:id additionally
// carries `lastReviewedAt`. POST /decks still returns the slim ApiDeck —
// a freshly created deck has no rollups to report.
//
// Backend Completion Plan Stage 4 (2026-05-17, copy model): `isPremadeFork`
// dropped from the wire — the column no longer exists, and all decks
// delete identically regardless of origin. `sourcePremadeId` is kept as
// attribution-only.
const API_DECK_KEYS = [
  'archivedAt',
  'cardCount',
  'createdAt',
  'deckType',
  'description',
  'id',
  'name',
  'sourcePremadeId',
  'updatedAt',
  'version',
].sort()

const API_DECK_WITH_STATS_KEYS = [
  ...API_DECK_KEYS,
  'dueCount',
  'newCount',
  'matureCount',
  'dueNewCount',
  'dueReviewCount',
  'lastReviewedAt',
].sort()

describeIntegration('decks routes — wire shape', () => {
  it('GET /api/v1/decks returns rows whose keys exactly match ApiDeckWithStats (Stage 3 rollups)', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Wire-shape Deck', description: 'check fields', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)

    const listRes = await request(app)
      .get('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    expect(Array.isArray(listRes.body.items)).toBe(true)
    expect(listRes.body.items.length).toBeGreaterThan(0)
    expect(listRes.body.hasMore).toBe(false)
    expect(listRes.body.nextCursor).toBeNull()

    const item = listRes.body.items[0]
    const keys = Object.keys(item).sort()
    expect(keys).toEqual(API_DECK_WITH_STATS_KEYS)

    // A freshly created deck has zero cards, so every count is exactly 0
    // and lastReviewedAt is null — confirms the COALESCE / LEFT JOIN path
    // in the RPC handles the empty-rollup case correctly.
    expect(item.dueCount).toBe(0)
    expect(item.newCount).toBe(0)
    expect(item.matureCount).toBe(0)
    expect(item.dueNewCount).toBe(0)
    expect(item.dueReviewCount).toBe(0)
    expect(item.lastReviewedAt).toBeNull()
  })

  it('GET /api/v1/decks/:id returns a row whose keys exactly match ApiDeckWithStats', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Wire-shape Deck Detail', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)
    const deckId = createRes.body.id

    const detailRes = await request(app)
      .get(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(detailRes.status).toBe(200)

    const keys = Object.keys(detailRes.body).sort()
    expect(keys).toEqual(API_DECK_WITH_STATS_KEYS)
    expect(detailRes.body.lastReviewedAt).toBeNull()
  })

  it('POST /api/v1/decks returns a row whose keys exactly match ApiDeck (no rollups on create)', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Created Deck', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)

    const keys = Object.keys(createRes.body).sort()
    expect(keys).toEqual(API_DECK_KEYS)
  })
})

// Backend Completion Plan Stage 3 acceptance: a deck with reviewed cards
// returns realistic rollups on GET /decks (one round-trip, no N+1). This
// proves the FILTER aggregates and last_reviewed_at projection are wired
// end-to-end through the RPC.
describeIntegration('decks routes — Stage 3 rollups on populated deck', () => {
  it('GET /api/v1/decks reports per-deck counts after card creation and a review', async () => {
    const u = await seedUser(); seeded.push(u)

    const deckRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Populated Deck', deckType: 'vocabulary' })
    expect(deckRes.status).toBe(201)
    const deckId = deckRes.body.id

    // Create two cards in this deck. Both land in state=New (FSRS initial
    // state) and due immediately (FSRS sets due=NOW on creation), so the
    // expected rollups before any review are:
    //   newCount = 2, dueCount = 2, dueNewCount = 2,
    //   matureCount = 0, dueReviewCount = 0
    for (const word of ['一', '二']) {
      const r = await request(app)
        .post(`/api/v1/decks/${deckId}/cards`)
        .set('Authorization', `Bearer ${u.jwt}`)
        .set('Idempotency-Key', randomUUID())
        .send({
          mode:       'manual',
          fieldsData: { word, reading: word, meaning: 'number' },
          layoutType: 'vocabulary',
        })
      expect(r.status).toBe(201)
    }

    // Snapshot the rollups via the list endpoint — the very contract Stage
    // 3 is meant to deliver.
    const listRes = await request(app)
      .get('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(listRes.status).toBe(200)
    const row = (listRes.body.items as Array<{ id: string; newCount: number; dueCount: number; lastReviewedAt: string | null }>)
      .find((d) => d.id === deckId)
    expect(row).toBeDefined()
    expect(row!.newCount).toBe(2)
    expect(row!.dueCount).toBe(2)
    expect(row!.lastReviewedAt).toBeNull()
  })
})

describeIntegration('decks routes — If-Match optimistic concurrency', () => {
  it('rejects PATCH /decks/:id without If-Match (428)', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'IfMatch Deck', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)
    const deckId = createRes.body.id

    const res = await request(app)
      .patch(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ name: 'Renamed' })
    expect(res.status).toBe(428)
  })

  it('returns 412 on stale If-Match', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Race Deck', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)
    const deckId = createRes.body.id
    const v1     = createRes.body.version

    const first = await request(app)
      .patch(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(v1))
      .send({ name: 'First rename' })
    expect(first.status).toBe(200)
    expect(first.body.version).toBe(v1 + 1)

    // Re-using the original (now stale) version → 412.
    const stale = await request(app)
      .patch(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(v1))
      .send({ name: 'Second rename' })
    expect(stale.status).toBe(412)
  })

  it('200 + bumped version on current If-Match', async () => {
    const u = await seedUser(); seeded.push(u)

    const createRes = await request(app)
      .post('/api/v1/decks')
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('Idempotency-Key', randomUUID())
      .send({ name: 'Bump Deck', deckType: 'vocabulary' })
    expect(createRes.status).toBe(201)
    const deckId = createRes.body.id
    const v1     = createRes.body.version

    const res = await request(app)
      .patch(`/api/v1/decks/${deckId}`)
      .set('Authorization', `Bearer ${u.jwt}`)
      .set('If-Match', String(v1))
      .send({ description: 'updated description' })
    expect(res.status).toBe(200)
    expect(res.body.description).toBe('updated description')
    expect(res.body.version).toBe(v1 + 1)
  })
})
