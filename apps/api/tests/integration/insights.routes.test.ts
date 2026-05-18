import { randomUUID } from 'node:crypto'
import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string; deckId: string }

const seeded: SeededUser[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-insights-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
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
    .send({ name: 'Insights Test Deck', deckType: 'vocabulary' })
  if (deckRes.status !== 201) throw new Error(`createDeck failed: ${deckRes.status} ${JSON.stringify(deckRes.body)}`)

  return { userId, jwt, deckId: deckRes.body.id }
}

/**
 * Seeds a card with a specific lapse count by bypassing the API and
 * writing directly via supabaseAdmin. The API has no public path to set
 * `lapses` arbitrarily — the only legitimate way to bump lapses is to
 * submit an `again` review, which would also tick the FSRS scheduler
 * forward and require N round-trips per card. Direct DB writes are the
 * only practical fixture path for testing the lapse-bucket boundaries.
 */
async function seedCardWithLapses(
  u:      SeededUser,
  lapses: number,
  word:   string,
): Promise<string> {
  const id = randomUUID()
  const { error } = await supabaseAdmin.from('cards').insert({
    id,
    user_id:        u.userId,
    deck_id:        u.deckId,
    layout_type:    'vocabulary',
    fields_data:    { word, reading: word, meaning: `mock ${word}` },
    card_type:      'comprehension',
    jlpt_level:     'N3',
    state:          2,
    lapses,
    reps:           Math.max(lapses, 1),  // reps_gte_lapses constraint
    is_suspended:   false,
    last_review:    new Date(Date.now() - lapses * 1000).toISOString(),
    due:            new Date(Date.now() + 86400000).toISOString(),
  })
  if (error !== null) throw new Error(`seed card with lapses=${lapses} failed: ${error.message}`)
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
})

// Backend Completion Plan Stage 7 acceptance.
describeIntegration('insights routes — Stage 7 problem cards', () => {
  it('GET /api/v1/insights/problem-cards?bucket=4-5 returns cards in that lapse range only', async () => {
    const u = await seedUser(); seeded.push(u)

    // Spread cards across bucket boundaries to make sure each bucket sees
    // only its own. lapses=1 → no bucket; lapses=3 → 2-3 bucket; lapses=5
    // → 4-5; lapses=7 → 6-7; lapses=9 → 8plus.
    await seedCardWithLapses(u, 1, 'lap1')
    await seedCardWithLapses(u, 3, 'lap3')
    const lap5 = await seedCardWithLapses(u, 5, 'lap5')
    await seedCardWithLapses(u, 7, 'lap7')
    await seedCardWithLapses(u, 9, 'lap9')

    const res = await request(app)
      .get('/api/v1/insights/problem-cards?bucket=4-5')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)
    expect(res.body.nextCursor).toBeNull()
    expect(res.body.hasMore).toBe(false)

    const ids = (res.body.items as Array<{ cardId: string; lapses: number }>).map((c) => c.cardId)
    expect(ids).toContain(lap5)
    // No cards from neighbouring buckets.
    expect(ids).toHaveLength(1)
    // Lapses field round-trips cleanly.
    const items = res.body.items as Array<{ lapses: number }>
    if (items[0] === undefined) throw new Error('expected one item')
    expect(items[0].lapses).toBe(5)
  })

  it('the 8plus bucket cardinality matches GET /api/v1/leeches (unresolved) for the same user', async () => {
    const u = await seedUser(); seeded.push(u)

    // Three cards in the 8+ zone — each will also have an open leech row
    // because process_review inserts one at lapses >= LEECH_THRESHOLD (8).
    // We're bypassing the review path with direct INSERTs, so we have to
    // create the matching leech rows ourselves to mirror what the live
    // pipeline would have produced. This is the cleanest way to pin the
    // parity invariant the plan calls out.
    const c1 = await seedCardWithLapses(u, 8, 'leech1')
    const c2 = await seedCardWithLapses(u, 10, 'leech2')
    const c3 = await seedCardWithLapses(u, 12, 'leech3')
    const leechRows = [c1, c2, c3].map((cardId) => ({
      card_id:  cardId,
      user_id:  u.userId,
      resolved: false,
    }))
    const leechInsert = await supabaseAdmin.from('leeches').insert(leechRows)
    expect(leechInsert.error).toBeNull()

    const problemRes = await request(app)
      .get('/api/v1/insights/problem-cards?bucket=8plus')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(problemRes.status).toBe(200)

    const leechRes = await request(app)
      .get('/api/v1/leeches?status=unresolved')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(leechRes.status).toBe(200)

    // The acceptance criterion: the 8plus bucket size equals the
    // unresolved-leech count for the same user. Three of each.
    expect(problemRes.body.items.length).toBe(3)
    expect(leechRes.body.items.length).toBe(3)
    expect(problemRes.body.items.length).toBe(leechRes.body.items.length)
  })

  it('excludes suspended cards from every bucket', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed a 5-lapse card, then suspend it. The 4-5 bucket should be empty.
    const cardId = await seedCardWithLapses(u, 5, 'suspended-lap5')
    const { error: suspendError } = await supabaseAdmin
      .from('cards')
      .update({ is_suspended: true })
      .eq('id', cardId)
    expect(suspendError).toBeNull()

    const res = await request(app)
      .get('/api/v1/insights/problem-cards?bucket=4-5')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
  })

  it('rejects an unknown bucket value at the Zod layer with 400', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/insights/problem-cards?bucket=42')
      .set('Authorization', `Bearer ${u.jwt}`)
    // Zod rejects an invalid enum value; the global error handler maps to
    // 400 with a recognisable code.
    expect(res.status).toBe(400)
  })

  it('returns 400 when the bucket query parameter is missing entirely', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/insights/problem-cards')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(400)
  })

  it('returns 401 for an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/insights/problem-cards?bucket=4-5')
    expect(res.status).toBe(401)
  })

  it('isolates results across users (one user\'s problem cards never leak to another)', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    await seedCardWithLapses(a, 5, 'a-only')

    const resB = await request(app)
      .get('/api/v1/insights/problem-cards?bucket=4-5')
      .set('Authorization', `Bearer ${b.jwt}`)
    expect(resB.status).toBe(200)
    expect(resB.body.items).toEqual([])
  })
})
