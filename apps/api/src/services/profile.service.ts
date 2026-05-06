import { supabaseAdmin } from '../db/supabase.ts'
import { narrowRow, asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import type { JLPTLevel, Profile, UpdateProfileInput } from '@fsrs-japanese/shared-types'

export type { Profile }

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

// ─── Internal DB row shape ────────────────────────────────────────────────────

/** Raw snake_case row shape returned by SELECT PROFILE_COLUMNS. Internal —
 *  the boundary type is the camelCase shared `Profile`. */
interface ProfileDbRow {
  id:                    string
  native_language:       string
  jlpt_target:           JLPTLevel | null
  study_goal:            string | null
  daily_new_cards_limit: number
  daily_review_limit:    number
  retention_target:      number
  timezone:              string
  created_at:            string
  updated_at:            string
}

/** Maps a raw DB row + interests array to the camelCase wire-format Profile. */
function toProfile(raw: ProfileDbRow, interests: string[]): Profile {
  return {
    id:                  raw.id,
    nativeLanguage:      raw.native_language,
    jlptTarget:          raw.jlpt_target,
    studyGoal:           raw.study_goal,
    interests,
    dailyNewCardsLimit:  raw.daily_new_cards_limit,
    dailyReviewLimit:    raw.daily_review_limit,
    retentionTarget:     raw.retention_target,
    timezone:            raw.timezone,
    createdAt:           raw.created_at,
    updatedAt:           raw.updated_at,
  }
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

  return toProfile(narrowRow<ProfileDbRow>(profileResult.data), interests)
}

/**
 * Applies a partial update to the user's profile via the
 * update_profile_with_interests RPC, which atomically writes the profile
 * patch and (when `interests` is provided) replaces the user_interests set.
 *
 * @param userId - The authenticated user's UUID from auth.users
 * @param input  - Validated partial update from `updateProfileSchema`
 */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const { interests, ...profileFields } = input

  // Function name cast: database.types.ts is auto-generated and won't include
  // update_profile_with_interests until `supabase gen types` runs post-deploy.
  const { error } = await supabaseAdmin.rpc('update_profile_with_interests' as never, asPayload({
    p_user_id:   userId,
    p_patch:     profileFields,
    p_interests: interests ?? null,
  }))

  if (error !== null) {
    if (error.code === '02000' || error.message.includes('profile_not_found')) {
      throw new AppError(404, 'Profile not found')
    }
    throw dbError('update profile', error)
  }

  return getProfile(userId)
}
