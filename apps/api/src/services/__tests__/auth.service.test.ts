import { describe, it, expect, mock, beforeEach } from 'bun:test'

// ─── Mock state ───────────────────────────────────────────────────────────────

interface MockState {
  // Per-test override of signInWithPassword's behaviour.
  signInResult: { ok: true } | { ok: false }
  // Captured credentials from the last signInWithPassword call (proves the
  // service verifies the CURRENT password, not the new one).
  lastSignInArgs: { email: string; password: string } | null
  // Per-test override of admin.updateUserById behaviour.
  updateUserError: { name: string; message: string } | null
  // Per-test override of admin.deleteUser behaviour.
  deleteUserError: { name: string; message: string } | null
  // Stub for admin.signUp result.
  signUpUser: { id: string; email: string } | null
  signUpError: { status?: number; message?: string; name?: string } | null
  // Per-test admin.getUserById response (cancelSignup). Shape matches the
  // real Supabase return: { data: { user }, error }.
  getUserByIdResponse: {
    data:  { user: { email_confirmed_at: string | null } | null }
    error: { name: string; message: string } | null
  }
  // Captured call args.
  lastUpdateUserId:    string | null
  lastUpdateUserPatch: { password?: string } | null
  lastDeleteUserId:    string | null
  // Redis state.
  redisStore: Map<string, string>
}

const state: MockState = {
  signInResult: { ok: true },
  lastSignInArgs: null,
  updateUserError: null,
  deleteUserError: null,
  signUpUser: { id: 'user-uuid-1', email: 'alice@example.com' },
  signUpError: null,
  getUserByIdResponse: { data: { user: { email_confirmed_at: null } }, error: null },
  lastUpdateUserId:    null,
  lastUpdateUserPatch: null,
  lastDeleteUserId:    null,
  redisStore: new Map(),
}

// ─── Module mocks (must precede dynamic import of auth.service) ───────────────

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    auth: {
      signInWithPassword: mock(async (creds: { email: string; password: string }) => {
        state.lastSignInArgs = creds
        if (state.signInResult.ok) {
          return {
            data:  { session: { access_token: 'a', refresh_token: 'r', expires_in: 3600 } },
            error: null,
          }
        }
        return {
          data:  { session: null },
          error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400 },
        }
      }),
      signUp: mock(async () => {
        if (state.signUpError !== null) return { data: { user: null }, error: state.signUpError }
        return { data: { user: state.signUpUser }, error: null }
      }),
      admin: {
        updateUserById: mock(async (userId: string, patch: { password?: string }) => {
          state.lastUpdateUserId    = userId
          state.lastUpdateUserPatch = patch
          if (state.updateUserError !== null) {
            return { data: null, error: state.updateUserError }
          }
          return { data: { user: { id: userId } }, error: null }
        }),
        deleteUser: mock(async (userId: string) => {
          state.lastDeleteUserId = userId
          if (state.deleteUserError !== null) {
            return { data: null, error: state.deleteUserError }
          }
          return { data: null, error: null }
        }),
        getUserById: mock(async (_userId: string) => state.getUserByIdResponse),
      },
    },
  },
}))

mock.module('../../db/redis.ts', () => ({
  redis: {
    get:  mock(async (key: string) => state.redisStore.get(key) ?? null),
    set:  mock(async (key: string, value: string) => {
      state.redisStore.set(key, value)
      return 'OK'
    }),
    del:  mock(async (key: string) => {
      state.redisStore.delete(key)
      return 1
    }),
  },
}))

// ─── Dynamic import (after mocks) ─────────────────────────────────────────────

const authService = await import('../auth.service.ts')

beforeEach(() => {
  state.signInResult = { ok: true }
  state.lastSignInArgs = null
  state.updateUserError = null
  state.deleteUserError = null
  state.signUpUser = { id: 'user-uuid-1', email: 'alice@example.com' }
  state.signUpError = null
  state.getUserByIdResponse = { data: { user: { email_confirmed_at: null } }, error: null }
  state.lastUpdateUserId    = null
  state.lastUpdateUserPatch = null
  state.lastDeleteUserId    = null
  state.redisStore.clear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('auth.service — changePassword', () => {
  it('updates the password when current password is correct', async () => {
    state.signInResult = { ok: true }

    await authService.changePassword('user-1', 'alice@example.com', 'old-password', 'new-password-123')

    // Verification must use the CURRENT password against the user's email. A
    // regression that verified the NEW password would still pass the patch
    // assertion below, so this is the line that actually guards the check.
    expect(state.lastSignInArgs).toEqual({ email: 'alice@example.com', password: 'old-password' })
    expect(state.lastUpdateUserId).toBe('user-1')
    expect(state.lastUpdateUserPatch).toEqual({ password: 'new-password-123' })
  })

  it('throws 401 when current password is wrong', async () => {
    state.signInResult = { ok: false }

    let caught: unknown = null
    try {
      await authService.changePassword('user-1', 'alice@example.com', 'wrong-password', 'new-password-123')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect((caught as { statusCode: number }).statusCode).toBe(401)
    expect((caught as Error).message).toMatch(/incorrect/i)
    // Critically: updateUserById must NOT have been called.
    expect(state.lastUpdateUserId).toBeNull()
  })

  it('surfaces a 500 if Supabase fails to apply the new password', async () => {
    state.signInResult = { ok: true }
    state.updateUserError = { name: 'AdminApiError', message: 'boom' }

    let caught: unknown = null
    try {
      await authService.changePassword('user-1', 'alice@example.com', 'old-password', 'new-password-123')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect((caught as { statusCode: number }).statusCode).toBe(500)
  })
})

describe('auth.service — deleteAccount', () => {
  it('deletes the account when current password is correct', async () => {
    state.signInResult = { ok: true }

    await authService.deleteAccount('user-2', 'alice@example.com', 'old-password')

    expect(state.lastDeleteUserId).toBe('user-2')
  })

  it('throws 401 and does NOT delete when current password is wrong', async () => {
    state.signInResult = { ok: false }

    let caught: unknown = null
    try {
      await authService.deleteAccount('user-2', 'alice@example.com', 'wrong-password')
    } catch (e) {
      caught = e
    }
    expect(caught).toBeTruthy()
    expect((caught as { statusCode: number }).statusCode).toBe(401)
    expect(state.lastDeleteUserId).toBeNull()
  })
})

describe('auth.service — signUp + cancelSignup token flow', () => {
  it('signUp issues a cancellation token paired with userId on a fresh signup', async () => {
    state.signUpUser = { id: 'user-fresh', email: 'fresh@example.com' }
    state.signUpError = null

    const result = await authService.signUp({
      email:       'fresh@example.com',
      password:    'a-strong-pass-123',
      displayName: 'Fresh User',
    })

    expect(result.userId).toBe('user-fresh')
    expect(typeof result.cancellationToken).toBe('string')
    expect(result.cancellationToken).not.toBeNull()
    // Token must be persisted under the per-user key for /cancel-signup to verify later.
    expect(state.redisStore.get('signup-cancel:user-fresh')).toBe(String(result.cancellationToken))
  })

  it('signUp returns null cancellationToken on the duplicate-email path', async () => {
    state.signUpUser = null
    state.signUpError = { status: 422, message: 'User already registered' }

    const result = await authService.signUp({
      email:       'taken@example.com',
      password:    'a-strong-pass-123',
      displayName: 'Taken Email',
    })

    expect(result.userId).toBeNull()
    expect(result.cancellationToken).toBeNull()
    // No Redis entries written on the duplicate path.
    expect(state.redisStore.size).toBe(0)
  })

  it('cancelSignup deletes the user when the token matches', async () => {
    state.redisStore.set('signup-cancel:pending-1', 'token-abc')
    state.getUserByIdResponse = { data: { user: { email_confirmed_at: null } }, error: null }

    await authService.cancelSignup({
      userId:            'pending-1',
      cancellationToken: 'token-abc',
    })

    expect(state.lastDeleteUserId).toBe('pending-1')
    // Token consumed.
    expect(state.redisStore.has('signup-cancel:pending-1')).toBe(false)
  })

  it('cancelSignup silently no-ops when the token does NOT match', async () => {
    state.redisStore.set('signup-cancel:pending-1', 'real-token')

    await authService.cancelSignup({
      userId:            'pending-1',
      cancellationToken: 'wrong-token',
    })

    // No deletion attempted.
    expect(state.lastDeleteUserId).toBeNull()
    // Real token stays — wrong-token attempts must not invalidate the legitimate
    // user's ability to cancel.
    expect(state.redisStore.get('signup-cancel:pending-1')).toBe('real-token')
  })

  it('cancelSignup silently no-ops on a confirmed account even with matching token', async () => {
    state.redisStore.set('signup-cancel:pending-1', 'token-abc')
    state.getUserByIdResponse = {
      data:  { user: { email_confirmed_at: '2026-05-07T00:00:00Z' } },
      error: null,
    }

    await authService.cancelSignup({
      userId:            'pending-1',
      cancellationToken: 'token-abc',
    })

    expect(state.lastDeleteUserId).toBeNull()
  })
})
