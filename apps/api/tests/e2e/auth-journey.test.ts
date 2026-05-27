import { randomUUID } from 'node:crypto'
import { it, expect, beforeAll, afterAll } from 'bun:test'
import request from 'supertest'

import { describeIntegration, isIntegrationEnabled } from '../integration/_helpers'

// ─── E2E — auth lifecycle ─────────────────────────────────────────────────────
//
// The one critical path the study-loop journeys (journeys.test.ts) deliberately
// skip: account access. Those mint tokens via signInUser to sidestep the app's
// auth surface; here we drive the real endpoints end-to-end —
//   signup → login → authenticated read → refresh → logout → (revoked refresh)
// plus the OTP-confirmation path and its reject case.
//
// Gated like the rest of the integration tier (real Supabase + Upstash shim).
//
// NOTE on OTP: the local GoTrue auto-confirms signups, so no confirmation email
// is sent and a normal signup is immediately usable (the login flow below). To
// exercise the verify-otp endpoint's HAPPY path we mint a real signup OTP via
// the admin API (generateLink), which hands back the same 6-digit code the
// email would carry — no SMTP/inbucket scraping, no flakiness.

let app:           import('express').Express
let supabaseAdmin: import('@supabase/supabase-js').SupabaseClient

const createdUserIds: string[] = []

function uniqueEmail(tag: string): string {
  return `e2e-${tag}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`
}

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

// ─── Journey 1: signup → login → authed → refresh → logout ────────────────────

describeIntegration('E2E — auth: signup → login → refresh → logout', () => {
  it('signs up, logs in, authenticates a protected read, refreshes, then logs out and the revoked refresh token is rejected', async () => {
    const email    = uniqueEmail('auth')
    const password = 'e2e-auth-pass-1234'

    // 1. Signup. Returns the anti-enumeration shape { email, userId, cancellationToken }.
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email, password, displayName: 'E2E Auth' })
    expect(signup.status).toBe(201)
    expect(signup.body.email).toBe(email)
    expect(typeof signup.body.userId).toBe('string')
    createdUserIds.push(signup.body.userId)

    // 2. Login with the same credentials → an access/refresh token pair.
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
    expect(login.status).toBe(200)
    expect(typeof login.body.accessToken).toBe('string')
    expect(typeof login.body.refreshToken).toBe('string')

    // 3. The minted access token authenticates a protected read — proves the
    //    JWT carries the identity auth middleware resolves (profile row was
    //    created by the on_auth_user_created trigger during signup).
    const me = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
    expect(me.status).toBe(200)

    // 4. Refresh consumes the refresh token and returns a fresh pair.
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
    expect(refresh.status).toBe(200)
    expect(typeof refresh.body.accessToken).toBe('string')
    expect(typeof refresh.body.refreshToken).toBe('string')

    // 5. Logout revokes the session behind the (refreshed) access token.
    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`)
    expect(logout.status).toBe(204)

    // 6. The handoff that proves logout actually revoked the session: the
    //    refresh token from that session no longer exchanges for new tokens.
    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh.body.refreshToken })
    expect(refreshAfterLogout.status).toBe(401)
  })
})

// ─── Journey 2: OTP confirmation path ─────────────────────────────────────────

describeIntegration('E2E — auth: OTP verification', () => {
  it('confirms a pending signup via its 6-digit OTP and returns a working session', async () => {
    const email    = uniqueEmail('otp')
    const password = 'e2e-otp-pass-1234'

    // Mint a real signup OTP (see file header). generateLink creates the
    // unconfirmed user and returns the same code the confirmation email carries.
    const link = await supabaseAdmin.auth.admin.generateLink({ type: 'signup', email, password })
    if (link.error !== null) throw new Error(`generateLink failed: ${link.error.message}`)
    if (link.data.user !== null) createdUserIds.push(link.data.user.id)
    const otp = link.data.properties?.email_otp ?? ''
    expect(otp).toMatch(/^\d{6}$/)

    // The app's verify-otp endpoint confirms the account and issues tokens.
    const verify = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email, token: otp })
    expect(verify.status).toBe(200)
    expect(typeof verify.body.accessToken).toBe('string')

    // The issued token authenticates a protected read.
    const me = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', `Bearer ${verify.body.accessToken}`)
    expect(me.status).toBe(200)
  })

  it('rejects an invalid OTP with 400', async () => {
    const verify = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ email: uniqueEmail('badotp'), token: '000000' })
    expect(verify.status).toBe(400)
  })
})
