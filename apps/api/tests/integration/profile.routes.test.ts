import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

interface SeededUser { userId: string; jwt: string }

const seeded: SeededUser[] = []

async function seedUser(): Promise<SeededUser> {
  const email = `it-profile-${Date.now()}-${Math.random().toString(16).slice(2, 6)}@example.test`
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

// Pinning the wire shape of /profile. The shared `Profile` type is camelCase;
// the DB row is snake_case. Before this assertion existed, the service leaked
// snake_case keys directly to the client and the frontend grew a local
// `ProfileResponse` workaround to compensate. This test guards against that
// regression.
const PROFILE_KEYS = [
  'createdAt',
  'dailyNewCardsLimit',
  'dailyReviewLimit',
  'id',
  'interests',
  'jlptTarget',
  'nativeLanguage',
  'retentionTarget',
  'studyGoal',
  'timezone',
  'updatedAt',
].sort()

describeIntegration('profile routes — wire shape', () => {
  it('GET /api/v1/profile returns a row whose keys exactly match the camelCase Profile', async () => {
    const u = await seedUser(); seeded.push(u)

    const res = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${u.jwt}`)
    expect(res.status).toBe(200)

    const keys = Object.keys(res.body).sort()
    expect(keys).toEqual(PROFILE_KEYS)
  })

  it('PATCH /api/v1/profile accepts snake_case input and returns camelCase output', async () => {
    const u = await seedUser(); seeded.push(u)

    // Request body stays snake_case (matches the rest of the API's request
    // convention — see CLAUDE.md and card.controller.ts:input.card_type etc.).
    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', `Bearer ${u.jwt}`)
      .send({ daily_review_limit: 222, jlpt_target: 'N3' })
    expect(res.status).toBe(200)

    const keys = Object.keys(res.body).sort()
    expect(keys).toEqual(PROFILE_KEYS)

    // Response is camelCase and reflects the patched values.
    expect(res.body.dailyReviewLimit).toBe(222)
    expect(res.body.jlptTarget).toBe('N3')
  })
})
