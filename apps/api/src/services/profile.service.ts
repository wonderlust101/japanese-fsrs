import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import type { JlptLevel, UpdateProfileInput } from '../schemas/profile.schema.ts'

// ─── Column projection ────────────────────────────────────────────────────────

// Never use select('*') — keep this list in sync with the Profile interface below.
// `interests` is sourced from the user_interests junction table (M1) — fetched
// separately and merged into the returned shape.
const PROFILE_COLUMNS = [
  'id',
  'native_language',
  'jlpt_target',
  'study_goal',
  'daily_new_cards_limit',
  'daily_review_limit',
  'retention_target',
  'timezone',
  'created_at',
  'updated_at',
].join(', ')

// ─── Return shape ─────────────────────────────────────────────────────────────

/** Full profile row returned to callers. `interests` is a virtual field
 *  joined from user_interests; the rest match PROFILE_COLUMNS exactly. */
export interface Profile {
  id:                    string
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

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchInterests(userId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('user_interests')
    .select('interest')
    .eq('user_id', userId)
  if (error !== null) throw dbError('fetch user interests', error)
  return (data ?? []).map((r) => (r as { interest: string }).interest)
}

/** Atomically replaces the user's interest set: delete-then-insert. The
 *  surrounding update should run before this so the profile FK exists. */
async function replaceInterests(userId: string, interests: string[]): Promise<void> {
  const { error: deleteError } = await supabaseAdmin
    .from('user_interests')
    .delete()
    .eq('user_id', userId)
  if (deleteError !== null) throw dbError('clear user interests', deleteError)

  if (interests.length === 0) return

  const rows = [...new Set(interests)].map((interest) => ({ user_id: userId, interest }))
  const { error: insertError } = await supabaseAdmin
    .from('user_interests')
    .insert(rows)
  if (insertError !== null) throw dbError('insert user interests', insertError)
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetches the profile row for the given user, joined with user_interests.
 *
 * Under normal operation this cannot return 404 — the `on_auth_user_created`
 * trigger inserts a default profile row on every signup. A 404 here indicates
 * the trigger was bypassed (test seed, migration rollback, manual deletion).
 *
 * @param userId - The authenticated user's UUID from auth.users
 */
export async function getProfile(userId: string): Promise<Profile> {
  const [profileResult, interests] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single(),
    fetchInterests(userId),
  ])

  if (profileResult.error !== null || profileResult.data === null) {
    throw new AppError(404, 'Profile not found')
  }

  return {
    ...(profileResult.data as unknown as Omit<Profile, 'interests'>),
    interests,
  }
}

/**
 * Applies a partial update to the user's profile and returns the updated row.
 *
 * Only the fields present in `input` are written — callers send only what
 * changed (true PATCH semantics). `updated_at` is always refreshed, even when
 * the DB trigger would do the same, so the returned row is always current.
 * `interests` is rewritten in user_interests via delete-then-insert.
 *
 * @param userId - The authenticated user's UUID from auth.users
 * @param input  - Validated partial update from `updateProfileSchema`
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const { interests, ...profileFields } = input

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({
      ...profileFields,
      updated_at: new Date().toISOString(),
    } as never)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single()

  // Supabase returns PGRST116 when .single() finds no matching row — the only
  // realistic cause here is a missing profile (see getProfile for why that's unusual).
  if (error !== null) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Profile not found')
    throw dbError('update profile', error)
  }

  if (data === null) {
    throw new AppError(404, 'Profile not found')
  }

  if (interests !== undefined) {
    await replaceInterests(userId, interests)
  }

  // Re-read interests so callers see the persisted set even when `interests`
  // was unchanged in this call.
  const finalInterests = interests ?? await fetchInterests(userId)

  return {
    ...(data as unknown as Omit<Profile, 'interests'>),
    interests: finalInterests,
  }
}
