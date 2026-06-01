import type { Profile, UpdateProfileInput } from "@fsrs-japanese/shared-types";
import { jlptLevelEnum } from "@fsrs-japanese/shared-types";

import { z } from "zod";
import { supabaseAdmin } from "../db/supabase.ts";
import { asPayload } from "../lib/db.ts";
import { invalidateProfileCache, readProfileCache, writeProfileCache } from "../lib/profile-cache.ts";
import { AppError, dbError } from "../middleware/errorHandler.ts";

export type { Profile };

// ─── Column projection ────────────────────────────────────────────────────────

// Never use select('*') — keep this list in sync with the Profile interface below.
// `interests` is sourced from the user_interests junction table (M1) — fetched
// separately and merged into the returned shape.
const PROFILE_COLUMNS = [
	"id",
	"native_language",
	"jlpt_target",
	"study_goal",
	"daily_new_cards_limit",
	"daily_review_limit",
	"retention_target",
	"timezone",
	"version",
	"created_at",
	"updated_at",
].join(", ");

// ─── Internal DB row shape ────────────────────────────────────────────────────

/**
 * Raw snake_case row shape returned by SELECT PROFILE_COLUMNS. Internal —
 *  the boundary type is the camelCase shared `Profile`. Schema-as-source so
 *  any column drift surfaces as a ZodError at parse time.
 */
const ProfileDbRowSchema = z.object({
	id: z.string(),
	native_language: z.string(),
	jlpt_target: jlptLevelEnum.nullable(),
	study_goal: z.string().nullable(),
	daily_new_cards_limit: z.number(),
	daily_review_limit: z.number(),
	retention_target: z.number(),
	timezone: z.string(),
	version: z.number(),
	created_at: z.string(),
	updated_at: z.string(),
});
type ProfileDbRow = z.infer<typeof ProfileDbRowSchema>;

const InterestRowSchema = z.object({ interest: z.string() });

/** Maps a raw DB row + interests array to the camelCase wire-format Profile. */
function toProfile(raw: ProfileDbRow, interests: string[]): Profile {
	return {
		id: raw.id,
		nativeLanguage: raw.native_language,
		jlptTarget: raw.jlpt_target,
		studyGoal: raw.study_goal,
		interests,
		dailyNewCardsLimit: raw.daily_new_cards_limit,
		dailyReviewLimit: raw.daily_review_limit,
		retentionTarget: raw.retention_target,
		timezone: raw.timezone,
		version: raw.version,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
	};
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function fetchInterests(userId: string): Promise<string[]> {
	const { data, error } = await supabaseAdmin
		.from("user_interests")
		.select("interest")
		.eq("user_id", userId);
	if (error !== null)
		throw dbError("fetch user interests", error);
	return z.array(InterestRowSchema).parse(data ?? []).map(r => r.interest);
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Raw DB fetch: the profile row joined with user_interests. The single source
 * of truth both `getProfile` (uncached) and `getProfileCached` build on.
 *
 * Under normal operation this cannot return 404 — the `on_auth_user_created`
 * trigger inserts a default profile row on every signup. A 404 here indicates
 * the trigger was bypassed (test seed, migration rollback, manual deletion).
 */
async function fetchProfileFromDb(userId: string): Promise<Profile> {
	const [profileResult, interests] = await Promise.all([
		supabaseAdmin
			.from("profiles")
			.select(PROFILE_COLUMNS)
			.eq("id", userId)
			.single(),
		fetchInterests(userId),
	]);

	if (profileResult.error !== null || profileResult.data === null) {
		throw new AppError(404, "Profile not found", { code: "PROFILE_NOT_FOUND" });
	}

	return toProfile(ProfileDbRowSchema.parse(profileResult.data), interests);
}

/**
 * Fetches the profile straight from the DB (no cache). Use where the live
 * optimistic-concurrency `version` matters: the settings `GET /profile` and
 * `updateProfile`'s return. Read-heavy callers should prefer
 * {@link getProfileCached}.
 *
 * @param userId - The authenticated user's UUID from auth.users
 */
export async function getProfile(userId: string): Promise<Profile> {
	return fetchProfileFromDb(userId);
}

/**
 * Cached variant of {@link getProfile}. Reads a short-lived Redis entry
 * (`profile:v1:${userId}`); on miss, fetches from the DB and populates the
 * cache fire-and-forget. Invalidated by `updateProfile`.
 *
 * Use for read-heavy / AI paths (reviews, analytics, card generation,
 * day-reflection) where the profile's scheduling/content fields are needed but
 * the live `version` is not — the cached copy can be up to its TTL stale across
 * devices. PATCH stays correct regardless: the update RPC checks `version`
 * against the DB, and the client's If-Match comes from the uncached
 * `GET /profile`.
 */
export async function getProfileCached(userId: string): Promise<Profile> {
	const cached = await readProfileCache(userId);
	if (cached !== null)
		return cached;

	const profile = await fetchProfileFromDb(userId);
	// Fire-and-forget — a Redis hiccup must not delay the response.
	void writeProfileCache(userId, profile);
	return profile;
}

/**
 * Applies a partial update to the user's profile via the
 * update_profile_with_interests RPC, which atomically writes the profile
 * patch and (when `interests` is provided) replaces the user_interests set.
 *
 * Optimistic concurrency: caller must pass `expectedVersion` from a prior
 * GET /profile fetch. Mismatch → 412. Successful UPDATE bumps `version`
 * by 1 inside the RPC.
 *
 * @param userId          - The authenticated user's UUID from auth.users
 * @param expectedVersion - The `version` the caller saw last (If-Match header)
 * @param input           - Validated partial update from `updateProfileSchema`
 */
export async function updateProfile(
	userId: string,
	expectedVersion: number,
	input: UpdateProfileInput,
): Promise<Profile> {
	const { interests, ...rest } = input;

	// The wire-format input is camelCase; the RPC's `p_patch` JSONB is forwarded
	// verbatim as a column-name patch and therefore expects snake_case keys.
	const patch: Record<string, unknown> = {};
	if (rest.jlptTarget !== undefined)
		patch.jlpt_target = rest.jlptTarget;
	if (rest.studyGoal !== undefined)
		patch.study_goal = rest.studyGoal;
	if (rest.dailyNewCardsLimit !== undefined)
		patch.daily_new_cards_limit = rest.dailyNewCardsLimit;
	if (rest.dailyReviewLimit !== undefined)
		patch.daily_review_limit = rest.dailyReviewLimit;
	if (rest.retentionTarget !== undefined)
		patch.retention_target = rest.retentionTarget;
	if (rest.timezone !== undefined)
		patch.timezone = rest.timezone;
	if (rest.nativeLanguage !== undefined)
		patch.native_language = rest.nativeLanguage;

	const { error } = await supabaseAdmin.rpc("update_profile_with_interests", asPayload({
		p_user_id: userId,
		p_expected_version: expectedVersion,
		p_patch: patch,
		p_interests: interests ?? null,
	}));

	if (error !== null) {
		if (error.code === "02000" && error.message.includes("profile_not_found")) {
			throw new AppError(404, "Profile not found", { code: "PROFILE_NOT_FOUND" });
		}
		if (error.code === "22000" && error.message.includes("profile_version_mismatch")) {
			throw new AppError(412, "Profile has been modified since you loaded it; refresh and retry", { code: "VERSION_CONFLICT" });
		}
		throw dbError("update profile", error);
	}

	// Bust the cached copy so the next read reflects the write. Awaited (it
	// never throws — failures are swallowed inside) so the uncached re-fetch
	// below can't race a concurrent reader onto a stale entry.
	await invalidateProfileCache(userId);
	// Uncached on purpose: returns the just-written row with the bumped version.
	return getProfile(userId);
}
