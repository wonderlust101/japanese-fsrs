import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import type { SignupInput, LoginInput, RefreshInput } from '../schemas/auth.schema.ts'

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
}

export interface SignUpResult {
  userId: string
  email:  string
}

/**
 * Creates a new Supabase Auth user and ensures the corresponding profiles row exists.
 *
 * The `on_auth_user_created` DB trigger (migration 000000) inserts into `profiles`
 * automatically on every auth.users INSERT. The explicit upsert below is
 * defense-in-depth: it is a no-op when the trigger ran, but guarantees the row
 * exists if the trigger is ever removed or skipped in a test environment.
 *
 * If the profile write fails after the auth user was created, the auth user is
 * deleted to prevent orphaned auth entries with no matching profile.
 */
export async function signUp(input: SignupInput): Promise<SignUpResult> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email:         input.email,
    password:      input.password,
    email_confirm: true,
  })

  if (error !== null || data.user === null) {
    // Supabase returns status 422 when the email is already registered.
    const status = error?.status === 422 ? 409 : 400
    throw new AppError(status, error?.message ?? 'Signup failed')
  }

  const userId = data.user.id

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

  if (profileError !== null) {
    // Roll back the auth user so the account does not exist in a half-created state.
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new AppError(500, 'Account creation failed: could not initialize profile')
  }

  return { userId, email: data.user.email ?? input.email }
}

/**
 * Authenticates a user by email and password and returns a session token pair.
 * Uses the standard Supabase auth flow; the service role client is required
 * because the anon key is not available server-side.
 */
export async function signInWithPassword(input: LoginInput): Promise<AuthTokens> {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email:    input.email,
    password: input.password,
  })

  if (error !== null || data.session === null) {
    throw new AppError(401, 'Invalid email or password')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

/**
 * Exchanges a valid refresh token for a new access/refresh token pair.
 * The old refresh token is invalidated by Supabase upon success.
 */
export async function refreshSession(input: RefreshInput): Promise<AuthTokens> {
  const { data, error } = await supabaseAdmin.auth.refreshSession({
    refresh_token: input.refreshToken,
  })

  if (error !== null || data.session === null) {
    throw new AppError(401, 'Invalid or expired refresh token')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

/**
 * Invalidates the session associated with the given JWT.
 * Uses `scope: 'local'` so only the current device session is revoked —
 * sessions on other devices remain active.
 */
export async function signOut(jwt: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(jwt, 'local')

  if (error !== null) {
    throw new AppError(500, 'Logout failed')
  }
}
