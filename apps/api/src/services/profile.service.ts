import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import type { JlptLevel, UpdateProfileInput } from '../schemas/profile.schema.ts'

// ─── Column projection ────────────────────────────────────────────────────────

// Never use select('*') — keep this list in sync with the Profile interface below.
const PROFILE_COLUMNS = [
  'id',
  'username',
  'native_language',
  'jlpt_target',
  'study_goal',
  'interests',
  'daily_new_cards_limit',
  'daily_review_limit',
  'retention_target',
  'timezone',
  'created_at',
  'updated_at',
].join(', ')

// ─── Return shape ─────────────────────────────────────────────────────────────

/** Full profile row returned to callers — matches PROFILE_COLUMNS exactly. */
export interface Profile {
  id:                    string
  username:              string | null
  native_language:       string
  jlpt_target:           JlptLevel | null
  study_goal:            string | null
  interests:             string[]
  daily_new_cards_limit: number
  daily_review_limit:    number
  retention_target:      number
  timezone:              string
  created_at:            string
  updated_at:            string
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetches the profile row for the given user.
 *
 * Under normal operation this cannot return 404 — the `on_auth_user_created`
 * trigger inserts a default profile row on every signup. A 404 here indicates
 * the trigger was bypassed (test seed, migration rollback, manual deletion).
 *
 * @param userId - The authenticated user's UUID from auth.users
 */
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Profile not found')
  }

  return data as unknown as Profile
}

/**
 * Applies a partial update to the user's profile and returns the updated row.
 *
 * Only the fields present in `input` are written — callers send only what
 * changed (true PATCH semantics). `updated_at` is always refreshed, even when
 * the DB trigger would do the same, so the returned row is always current.
 *
 * @param userId - The authenticated user's UUID from auth.users
 * @param input  - Validated partial update from `updateProfileSchema`
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single()

  // Supabase returns PGRST116 when .single() finds no matching row — the only
  // realistic cause here is a missing profile (see getProfile for why that's unusual).
  if (error !== null) {
    const status = error.code === 'PGRST116' ? 404 : 500
    const message =
      status === 404 ? 'Profile not found' : `Failed to update profile: ${error.message}`
    throw new AppError(status, message)
  }

  if (data === null) {
    throw new AppError(404, 'Profile not found')
  }

  return data as unknown as Profile
}
