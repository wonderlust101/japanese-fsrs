import type {
  ApiAuthTokens, ApiSignUpResult,
  SignupInput, LoginInput, RefreshInput,
  CancelSignupInput, VerifyOtpInput, ResendOtpInput,
} from '@fsrs-japanese/shared-types'

import { supabaseAdmin } from '../db/supabase.ts'
import { redis } from '../db/redis.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

const log = componentLogger('auth.service')

// ─── Cancellation token for /signup → /cancel-signup ──────────────────────────

/** Redis key for an unconfirmed signup's cancellation token. */
const cancelTokenKey = (userId: string): string => `signup-cancel:${userId}`

/** TTL for the cancellation token. Covers normal OTP-flow window with margin;
 *  Supabase's own unconfirmed-account expiry is comparable. */
const CANCEL_TOKEN_TTL_SECONDS = 3600

// ─── Step-up auth helper ──────────────────────────────────────────────────────

/**
 * Verifies the user's current password by attempting a fresh sign-in. The
 * service-role client does not carry per-user session state, so the returned
 * tokens are discarded — this is purely a verification primitive.
 *
 * Throws AppError(401, 'Current password is incorrect') on failure. Generic
 * message regardless of root cause (unknown email, wrong password, locked
 * account) so the failure mode does not leak account state.
 */
async function verifyCurrentPassword(email: string, password: string): Promise<void> {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password })
  if (error !== null || data.session === null) {
    throw new AppError(401, 'Current password is incorrect')
  }
}

/**
 * Registers a new user and triggers the 6-digit OTP verification email.
 *
 * Uses `auth.signUp()` (not `admin.createUser`) so Supabase sends the
 * confirmation email according to the project's email template settings.
 * The account is created but unconfirmed; the user must enter the 6-digit
 * OTP on the signup page, which verifies it directly via the browser client.
 *
 * Profile row creation is handled by the `on_auth_user_created` trigger,
 * which fires inside the auth.users INSERT transaction. If the trigger
 * raises, the INSERT rolls back and no email is sent — no compensating
 * delete needed on this side.
 *
 * Requires the Supabase project to have "Confirm email" enabled and the email
 * template configured to send OTP tokens (not magic links).
 */
export async function signUp(input: SignupInput): Promise<ApiSignUpResult> {
  const { data, error } = await supabaseAdmin.auth.signUp({
    email:    input.email,
    password: input.password,
    // GoTrue's `raw_user_meta_data` stays snake_case (their internal contract).
    options:  { data: { display_name: input.displayName } },
  })

  // Account-enumeration policy: anonymous callers must not be able to
  // distinguish a fresh signup from one whose email is already registered.
  // Both paths return the same shape; only the `userId` field differs (null
  // when the email was already taken). The OTP step then fails identically
  // for the duplicate case, surfacing as "invalid code".
  if (error !== null) {
    const msg = (error.message ?? '').toLowerCase()
    const isDuplicate =
      error.status === 422 ||
      msg.includes('already registered') ||
      msg.includes('already exists')
    if (isDuplicate) {
      // Email is deliberately NOT logged here — see the account-enumeration
      // policy above. Logging it would re-leak in the log layer what the
      // wire response was hardened to hide.
      log.info('signup attempt on existing email')
      return { email: input.email, userId: null, cancellationToken: null }
    }
    log.error({ err: { name: error.name, message: error.message } }, 'signup failed')
    throw new AppError(400, 'Signup failed')
  }

  // GoTrue returns user: null when the email is already confirmed — same
  // duplicate case from a different code path. Treat it identically.
  if (data.user === null) {
    log.info('signup returned null user (already-confirmed email)')
    return { email: input.email, userId: null, cancellationToken: null }
  }

  // Issue a one-time cancellation token paired with the new userId. A leaked
  // userId alone (e.g. via a screenshot of the response) is no longer
  // sufficient to delete the in-flight signup; the matching token must also
  // be presented at /cancel-signup. Stored in Redis with a 1h TTL.
  const cancellationToken = crypto.randomUUID()
  await redis.set(cancelTokenKey(data.user.id), cancellationToken, { ex: CANCEL_TOKEN_TTL_SECONDS })

  return {
    email: data.user.email ?? input.email,
    userId: data.user.id,
    cancellationToken,
  }
}

/**
 * Deletes an unconfirmed user when they abandon the OTP verification step.
 * Silently no-ops if the user does not exist, has already confirmed their
 * email, or the cancellation token does not match — this prevents the endpoint
 * from being used to delete real accounts AND closes the third-party-DoS
 * vector where a leaked userId could trigger deletion of an in-flight signup.
 */
export async function cancelSignup(input: CancelSignupInput): Promise<void> {
  // Token check first. A wrong token must not produce a different
  // observable behaviour from a valid-but-unknown userId.
  const storedToken = await redis.get<string>(cancelTokenKey(input.userId))
  if (storedToken !== input.cancellationToken) return

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(input.userId)

  if (error !== null || data.user === null) {
    // Token matched something stale; clear it.
    await redis.del(cancelTokenKey(input.userId))
    return
  }

  // Guard: never delete an account that has already been confirmed.
  if (data.user.email_confirmed_at !== null && data.user.email_confirmed_at !== undefined) {
    await redis.del(cancelTokenKey(input.userId))
    return
  }

  await supabaseAdmin.auth.admin.deleteUser(input.userId)
  await redis.del(cancelTokenKey(input.userId))
}

/**
 * Authenticates a user by email and password and returns a session token pair.
 * Uses the standard Supabase auth flow; the service role client is required
 * because the anon key is not available server-side.
 */
export async function signInWithPassword(input: LoginInput): Promise<ApiAuthTokens> {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email:    input.email,
    password: input.password,
  })

  if (error !== null || data.session === null) {
    // No identity field — the global error handler will log the 401 with
    // the request id, which is sufficient correlation for incident response.
    log.warn('login failed')
    throw new AppError(401, 'Invalid email or password')
  }

  log.info({ userId: data.session.user.id }, 'login succeeded')

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
export async function refreshSession(input: RefreshInput): Promise<ApiAuthTokens> {
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
export async function verifyOtp(input: VerifyOtpInput): Promise<ApiAuthTokens> {
  const { data, error } = await supabaseAdmin.auth.verifyOtp({
    email: input.email,
    token: input.token,
    type:  'signup',
  })

  if (error !== null || data.session === null) {
    if (error !== null) {
      log.error({ err: { name: error.name, message: error.message } }, 'verifyOtp failed')
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
    log.error({ err: { name: error.name, message: error.message } }, 'resendOtp failed')
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
 * Updates the user's password after step-up verification of the current one.
 * The current-password check protects against session-token compromise being
 * escalated to permanent account takeover (see security audit FIND-001).
 */
export async function changePassword(
  userId:          string,
  email:           string,
  currentPassword: string,
  newPassword:     string,
): Promise<void> {
  await verifyCurrentPassword(email, currentPassword)

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
  if (error !== null) {
    throw dbError('change password', error)
  }

  log.info({ userId }, 'password changed')
}

/**
 * Permanently deletes the user's account and all linked data.
 * The auth.users → profiles cascade chain wipes profile, decks, cards,
 * subscriptions, and review logs in a single Supabase admin call.
 *
 * Step-up: requires the current password. Same rationale as changePassword —
 * a stolen access token must not be enough to nuke the account.
 */
export async function deleteAccount(
  userId:          string,
  email:           string,
  currentPassword: string,
): Promise<void> {
  await verifyCurrentPassword(email, currentPassword)

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId)

  if (error !== null) {
    throw dbError('delete account', error)
  }

  // Audit-trail log for an irreversible action. Combined with the request-id
  // header this gives forensic capability if a stolen-token deletion ever
  // needs investigation.
  log.info({ userId }, 'account deleted')
}
