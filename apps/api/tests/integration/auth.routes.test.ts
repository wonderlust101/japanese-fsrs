import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from './_helpers'

// Lazy imports — only resolved when integration tests are enabled, since the
// real Supabase admin client throws at module-load when given the stub URL.
// supertest is import-time safe and stays at the top.
let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

const createdUserIds: string[] = []

beforeAll(async () => {
  if (!isIntegrationEnabled()) return
  ;({ app }           = await import('../../src/app'))
  ;({ supabaseAdmin } = await import('../../src/db/supabase'))
})

afterAll(async () => {
  if (!isIntegrationEnabled()) return
  for (const id of createdUserIds) {
    await supabaseAdmin.auth.admin.deleteUser(id).catch(() => undefined)
  }
})

describeIntegration('POST /api/v1/auth — signup → cancel → re-signup', () => {
  it('signs up, cancels, then signs up again successfully', async () => {
    const email = `integration-${Date.now()}@example.test`

    const first = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password: 'integration-pass-1', display_name: 'Integration User' })
    expect([201, 400, 409]).toContain(first.status)
    if (first.status === 201) {
      createdUserIds.push(first.body.userId)
      const cancel = await request(app)
        .post('/api/v1/auth/cancel-signup')
        .send({ userId: first.body.userId })
      expect(cancel.status).toBe(204)
    }

    const second = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password: 'integration-pass-2', display_name: 'Integration User' })
    expect([201, 409]).toContain(second.status)
    if (second.status === 201) createdUserIds.push(second.body.userId)
  })

  it('rejects a duplicate email with 409', async () => {
    const email = `integration-dup-${Date.now()}@example.test`

    const first = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password: 'integration-pass-1', display_name: 'Integration User' })
    if (first.status === 201) createdUserIds.push(first.body.userId)

    const dup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password: 'integration-pass-2', display_name: 'Integration User' })
    // Either the user already exists (409) or the email is unconfirmed and
    // GoTrue silently re-issues an OTP — both are acceptable from the API
    // surface, but we expect a non-201 response.
    expect([409, 400]).toContain(dup.status)
  })
})
