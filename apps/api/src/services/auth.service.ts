import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import type { SignupInput, LoginInput, RefreshInput, CancelSignupInput, VerifyOtpInput, ResendOtpInput } from '../schemas/auth.schema.ts'

export interface AuthTokens {
  accessToken:  string
  refreshToken: string
  expiresIn:    number
}

export interface SignUpResult {
  email:  string
  userId: string
}

/**
 * Registers a new user and triggers the 6-digit OTP verification email.
 *
 * Uses `auth.signUp()` (not `admin.createUser`) so Supabase sends the
 * confirmation email according to the project's email template settings.
 * The account is created but unconfirmed; the user must enter the 6-digit
 * OTP on the signup page, which verifies it directly via the browser client.
 *
 * The `on_auth_user_created` trigger inserts into `profiles` on auth.users
 * INSERT. The explicit upsert below is defense-in-depth and is a no-op when
 * the trigger ran correctly.
 *
 * If the profile write fails, the auth user is deleted to avoid an orphaned
 * account with no profile row.
 *
 * Requires the Supabase project to have "Confirm email" enabled and the email
 * template configured to send OTP tokens (not magic links).
 */
export async function signUp(input: SignupInput): Promise<SignUpResult> {
  const { data, error } = await supabaseAdmin.auth.signUp({
    email:    input.email,
    password: input.password,
    options:  { data: { display_name: input.display_name } },
  })

  if (error !== null) {
    const msg = error.message ?? ''
    // GoTrue 422 = email already registered; some versions surface this
    // as "User already registered" at status 400 instead.
    const isDuplicate =
      error.status === 422 ||
      msg.toLowerCase().includes('already registered') ||
      msg.toLowerCase().includes('already exists')
    if (isDuplicate) throw new AppError(409, 'Email already registered')
    console.error('[auth.service] signup failed', { name: error.name, message: error.message })
    throw new AppError(400, 'Signup failed')
  }

  // When the email is already confirmed, GoTrue returns user: null (no error)
  // to avoid leaking account existence to anonymous clients. From the server
  // side we can safely surface this as a conflict.
  if (data.user === null) {
    throw new AppError(409, 'Email address already registered')
  }

  const userId = data.user.id

  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId }, { onConflict: 'id', ignoreDuplicates: true })

  if (profileError !== null) {
    await supabaseAdmin.auth.admin.deleteUser(userId)
    throw new AppError(500, 'Account creation failed: could not initialize profile')
  }

  return { email: data.user.email ?? input.email, userId }
}

/**
 * Deletes an unconfirmed user when they abandon the OTP verification step.
 * Silently no-ops if the user does not exist or has already confirmed their
 * email — this prevents the endpoint from being used to delete real accounts.
 */
export async function cancelSignup(input: CancelSignupInput): Promise<void> {
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(input.userId)

  if (error !== null || data.user === null) return

  // Guard: never delete an account that has already been confirmed.
  if (data.user.email_confirmed_at !== null && data.user.email_confirmed_at !== undefined) return

  await supabaseAdmin.auth.admin.deleteUser(input.userId)
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
 * Verifies a 6-digit email OTP for the signup flow.
 * Returns an access/refresh token pair on success so the caller can
 * establish a session without a second round-trip.
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<AuthTokens> {
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type:  'signup',
  })

  if (error !== null || data.session === null) {
    if (error !== null) {
      console.error('[auth.service] verifyOtp failed', { name: error.name, message: error.message })
    }
    throw new AppError(400, 'Invalid or expired code')
  }

  return {
    accessToken:  data.session.access_token,
    refreshToken: data.session.refresh_token,
    expiresIn:    data.session.expires_in,
  }
}

/**
 * Resends the signup OTP email to the given address.
 * Uses the service role client to trigger the resend without a user session.
 */
export async function resendOtp(input: ResendOtpInput): Promise<void> {
  const { error } = await supabaseAdmin.auth.resend({
    type:  'signup',
    email: input.email,
  })

  if (error !== null) {
    console.error('[auth.service] resendOtp failed', { name: error.name, message: error.message })
    throw new AppError(400, 'Failed to resend OTP')
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

/**
 * Permanently deletes the user's account and all linked data.
 * The auth.users → profiles cascade chain wipes profile, decks, cards,
 * subscriptions, and review logs in a single Supabase admin call.
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error !== null) {
    throw dbError('delete account', error)
  }
}
