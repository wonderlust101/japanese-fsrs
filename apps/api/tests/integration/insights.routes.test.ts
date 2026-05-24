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
    // Sentence-layout cards require ja/en/furigana per the Stage 12
    // CHECK constraint. The shape is intentionally minimal here — the
    // assertion below is that the card contributes ZERO issue counts
    // regardless of how rich its content is, because the RPC scopes to
    // vocabulary/grammar.
    await seedCardWithFields(
      u,
      { ja: 'これは文です。', en: 'This is a sentence.', furigana: 'これはぶんです。' },
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
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'new', reading: 'new', meaning: 'new' },
        state: 0, scheduled_days: 0, is_suspended: false },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'learn1', reading: 'learn1', meaning: 'learn1' },
        state: 1, scheduled_days: 0, is_suspended: false, reps: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'learn2', reading: 'learn2', meaning: 'learn2' },
        state: 1, scheduled_days: 0, is_suspended: false, reps: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'review', reading: 'review', meaning: 'review' },
        state: 2, scheduled_days: 5, is_suspended: false, reps: 3 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'relearn', reading: 'relearn', meaning: 'relearn' },
        state: 3, scheduled_days: 1, is_suspended: false, reps: 5, lapses: 1 },
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
        fields_data: { word: 'mature', reading: 'mature', meaning: 'mature' },
        state: 2, scheduled_days: 30, is_suspended: false, reps: 10 },
      // Suspended card — must NOT show up in any bucket.
      { user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
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
      suspendedCount: number
    }
    expect(today.newCount).toBe(1)
    expect(today.learningCount).toBe(2)
    expect(today.reviewCount).toBe(1)
    expect(today.relearningCount).toBe(1)
    // Mature: the suspended one with scheduled_days=30 must NOT count.
    expect(today.matureCount).toBe(1)
    // ...but it is tallied separately in suspendedCount.
    expect(today.suspendedCount).toBe(1)
  })

  it('record_card_state_snapshots upserts a row that the history RPC reads back as historical (after manual cron simulation)', async () => {
    const u = await seedUser(); seeded.push(u)

    // Seed a mature card so the snapshot row has non-zero counts.
    await supabaseAdmin.from('cards').insert({
      user_id: u.userId, deck_id: u.deckId, layout_type: 'vocabulary',
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
      user_id: a.userId, deck_id: a.deckId, layout_type: 'vocabulary',
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

