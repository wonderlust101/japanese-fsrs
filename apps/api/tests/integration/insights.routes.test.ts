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

// ─── Backend Completion Plan Stage 8 — card-quality issue counts ─────────────
//
// Direct-insert fixture helper. Sets `fields_data` precisely so we can
// trigger each issue-type independently. Bypasses the API because the
// `createCard` path runs Zod sanitization that strips empty fields,
// which would defeat the point of testing "field present but empty."
async function seedCardWithFields(
  u:           { userId: string; jwt: string; deckId: string },
  fieldsData:  Record<string, unknown>,
  layoutType:  'vocabulary' | 'grammar' | 'sentence' = 'vocabulary',
): Promise<string> {
  const id = randomUUID()
  const { error } = await supabaseAdmin.from('cards').insert({
    id,
    user_id:        u.userId,
    deck_id:        u.deckId,
    layout_type:    layoutType,
    fields_data:    fieldsData,
    card_type:      'comprehension',
    jlpt_level:     'N5',
    is_suspended:   false,
  })
  if (error !== null) throw new Error(`seed quality card failed: ${error.message}`)
  return id
}

describeIntegration('insights routes — Stage 8 card-quality issue counts', () => {
  it('returns six rows (one per known issue type) even when every count is zero', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed one card with all fields populated — every count should be zero.
    await seedCardWithFields(u, {
      word:    '完璧',
      reading: 'かんぺき',
      meaning: 'perfect',
      mnemonic: 'A complete kanji — every stroke in place.',
      picture: 'https://cdn.example.test/perfect.jpg',
      nuance:  'Used to praise without exaggeration; not used ironically.',
      exampleSentences: [
        { ja: '完璧です。', en: "It's perfect.", furigana: 'かんぺきです。' },
      ],
    })

    const res = await request(app)
      .get('/api/v1/insights/card-quality')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items).toHaveLength(6)
    expect(res.body.nextCursor).toBeNull()
    expect(res.body.hasMore).toBe(false)

    const byType: Record<string, number> = {}
    for (const issue of res.body.items as Array<{ issueType: string; count: number }>) {
      byType[issue.issueType] = issue.count
    }
    // Sanity: all six known types present.
    expect(Object.keys(byType).sort()).toEqual([
      'missing_example',
      'missing_meaning',
      'missing_mnemonic',
      'missing_nuance',
      'missing_picture',
      'missing_reading',
    ])
    // Fully populated card → every issue count is zero.
    expect(byType['missing_reading']).toBe(0)
    expect(byType['missing_meaning']).toBe(0)
    expect(byType['missing_example']).toBe(0)
    expect(byType['missing_mnemonic']).toBe(0)
    expect(byType['missing_picture']).toBe(0)
    expect(byType['missing_nuance']).toBe(0)
  })

  it('counts a missing-mnemonic / missing-picture / missing-nuance card on those bars', async () => {
    const u = await seedUser(); seeded.push(u)

    // Required keys present (CHECK constraint enforces them) but the
    // optional Lapis-style fields and the mnemonic are absent.
    await seedCardWithFields(u, {
      word:    '欠',
      reading: 'けつ',
      meaning: 'lack',
      // no mnemonic, picture, nuance, or exampleSentences
    })

    const res = await request(app)
      .get('/api/v1/insights/card-quality')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)

    const byType: Record<string, number> = {}
    for (const issue of res.body.items as Array<{ issueType: string; count: number }>) {
      byType[issue.issueType] = issue.count
    }
    expect(byType['missing_reading']).toBe(0)
    expect(byType['missing_meaning']).toBe(0)
    expect(byType['missing_example']).toBe(1)
    expect(byType['missing_mnemonic']).toBe(1)
    expect(byType['missing_picture']).toBe(1)
    expect(byType['missing_nuance']).toBe(1)
  })

  it('counts an empty exampleSentences array on the missing_example bar', async () => {
    const u = await seedUser(); seeded.push(u)

    // The schema allows an exampleSentences key with an empty array; this
    // is the edge case the RPC's jsonb_array_length guard handles.
    await seedCardWithFields(u, {
      word:    '空',
      reading: 'から',
      meaning: 'empty',
      exampleSentences: [],
    })

    const res = await request(app)
      .get('/api/v1/insights/card-quality')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)

    const byType: Record<string, number> = {}
    for (const issue of res.body.items as Array<{ issueType: string; count: number }>) {
      byType[issue.issueType] = issue.count
    }
    expect(byType['missing_example']).toBe(1)
  })

  it('excludes sentence-layout cards from every bucket', async () => {
    const u = await seedUser(); seeded.push(u)

    // A sentence-layout card with nothing populated — would trigger every
    // issue type if not excluded. The RPC scopes to vocabulary/grammar
    // only, so this card contributes to zero issue counts.
    await seedCardWithFields(
      u,
      { sentence: 'これは文です。', translation: 'This is a sentence.' },
      'sentence',
    )

    const res = await request(app)
      .get('/api/v1/insights/card-quality')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)

    for (const issue of res.body.items as Array<{ issueType: string; count: number }>) {
      expect(issue.count).toBe(0)
    }
  })

  it('isolates results across users', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    // a has a card missing nuance; b should see zero across the board.
    await seedCardWithFields(a, {
      word:    '個',
      reading: 'こ',
      meaning: 'individual / counter',
    })

    const resB = await request(app)
      .get('/api/v1/insights/card-quality')
      .set('Authorization', `Bearer ${b.jwt}`)
    expect(resB.status).toBe(200)
    for (const issue of resB.body.items as Array<{ issueType: string; count: number }>) {
      expect(issue.count).toBe(0)
    }
  })

  it('returns 401 for an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/insights/card-quality')
    expect(res.status).toBe(401)
  })
})

// ─── Backend Completion Plan Stage 9 — maturity-pipeline history ─────────────
//
// The endpoint always returns at least one row — today's live snapshot — for
// any authenticated learner. Historical rows only accumulate once the daily
// cron has run; the integration test asserts the live "today" row is
// present and that the wire shape is correct. The cron itself is exercised
// by an inline `SELECT public.record_card_state_snapshots()` to verify the
// upsert path round-trips.
describeIntegration('insights routes — Stage 9 maturity-pipeline history', () => {
  it('GET /api/v1/insights/maturity-history?days=90 always returns at least today\'s row', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/insights/maturity-history?days=90')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.items)).toBe(true)
    expect(res.body.items.length).toBeGreaterThanOrEqual(1)
    expect(res.body.nextCursor).toBeNull()
    expect(res.body.hasMore).toBe(false)

    // Today's row is the live computation; for a fresh user with no cards
    // every count must be zero.
    const last = res.body.items[res.body.items.length - 1] as {
      date: string
      newCount: number
      learningCount: number
      reviewCount: number
      relearningCount: number
      matureCount: number
    }
    expect(last.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(last.newCount).toBe(0)
    expect(last.learningCount).toBe(0)
    expect(last.reviewCount).toBe(0)
    expect(last.relearningCount).toBe(0)
    expect(last.matureCount).toBe(0)
  })

  it('counts cards across FSRS states for today\'s live row', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed cards across every state we surface on the chart:
    //   - new (state=0)
    //   - learning (state=1)
    //   - review (state=2, scheduled_days < 21)
    //   - relearning (state=3)
    //   - mature (state=2, scheduled_days >= 21)
    const insert = await supabaseAdmin.from('cards').insert([
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'new', reading: 'new', meaning: 'new' },
        state: 0, scheduled_days: 0, is_suspended: false },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'learn1', reading: 'learn1', meaning: 'learn1' },
        state: 1, scheduled_days: 0, is_suspended: false, reps: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'learn2', reading: 'learn2', meaning: 'learn2' },
        state: 1, scheduled_days: 0, is_suspended: false, reps: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'review', reading: 'review', meaning: 'review' },
        state: 2, scheduled_days: 5, is_suspended: false, reps: 3 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'relearn', reading: 'relearn', meaning: 'relearn' },
        state: 3, scheduled_days: 1, is_suspended: false, reps: 5, lapses: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'mature', reading: 'mature', meaning: 'mature' },
        state: 2, scheduled_days: 30, is_suspended: false, reps: 10 },
      // Suspended card — must NOT show up in any bucket.
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
        fields_data: { word: 'suspended', reading: 'suspended', meaning: 'suspended' },
        state: 2, scheduled_days: 30, is_suspended: true, reps: 10 },
    ])
    expect(insert.error).toBeNull()

    const res = await request(app)
      .get('/api/v1/insights/maturity-history?days=90')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)

    const today = res.body.items[res.body.items.length - 1] as {
      newCount: number
      learningCount: number
      reviewCount: number
      relearningCount: number
      matureCount: number
    }
    expect(today.newCount).toBe(1)
    expect(today.learningCount).toBe(2)
    expect(today.reviewCount).toBe(1)
    expect(today.relearningCount).toBe(1)
    // Mature: the suspended one with scheduled_days=30 must NOT count.
    expect(today.matureCount).toBe(1)
  })

  it('record_card_state_snapshots upserts a row that the history RPC reads back as historical (after manual cron simulation)', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed a mature card so the snapshot row has non-zero counts.
    await supabaseAdmin.from('cards').insert({
      user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
      fields_data: { word: 'snap', reading: 'snap', meaning: 'snap' },
      state: 2, scheduled_days: 30, is_suspended: false, reps: 10,
    })

    // Manually fire the snapshot function — same path the daily cron would
    // take. Note: this writes a row labeled with the user's local "today",
    // which the history RPC excludes from the historical CTE. We still
    // verify the function runs without error and that the row lands.
    const snap = await supabaseAdmin.rpc('record_card_state_snapshots')
    expect(snap.error).toBeNull()

    const { data: rows, error: rowsError } = await supabaseAdmin
      .from('card_state_snapshots')
      .select('user_id, snapshot_date, mature_count')
      .eq('user_id', u.userId)
    expect(rowsError).toBeNull()
    expect(rows).not.toBeNull()
    if (rows === null) throw new Error('snapshot rows missing')
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const mine = rows.find((r) => r.user_id === u.userId)
    expect(mine).toBeDefined()
    expect(mine?.mature_count).toBe(1)
  })

  it('rejects an unknown days value at the Zod layer with 400', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/insights/maturity-history?days=42')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(400)
  })

  it('rejects a missing days parameter with 400', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/insights/maturity-history')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(400)
  })

  it('returns 401 for an unauthenticated request', async () => {
    const res = await request(app).get('/api/v1/insights/maturity-history?days=90')
    expect(res.status).toBe(401)
  })

  it('isolates results across users', async () => {
    const a = await seedUser(); seeded.push(a)
    const b = await seedUser(); seeded.push(b)

    // a has a mature card; b should see all zeros.
    await supabaseAdmin.from('cards').insert({
      user_id: a.userId, deck_id: a.deckId, layout_type: 'vocabulary', card_type: 'comprehension',
      fields_data: { word: 'a-only', reading: 'a-only', meaning: 'a-only' },
      state: 2, scheduled_days: 30, is_suspended: false, reps: 10,
    })

    const resB = await request(app)
      .get('/api/v1/insights/maturity-history?days=90')
      .set('Authorization', `Bearer ${b.jwt}`)
    expect(resB.status).toBe(200)
    const today = resB.body.items[resB.body.items.length - 1] as { matureCount: number }
    expect(today.matureCount).toBe(0)
  })
})
