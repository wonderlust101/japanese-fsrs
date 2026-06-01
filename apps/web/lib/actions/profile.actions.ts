"use server";

import type { Profile, UpdateProfileInput } from "@fsrs-japanese/shared-types";
import { ProfileSchema } from "@fsrs-japanese/shared-types";
import { apiCall, apiCallSafe } from "@/lib/api/client";

export async function getProfileAction(): Promise<Profile | null> {
	return apiCallSafe<Profile | null>("/api/v1/profile", ProfileSchema.nullable(), {}, null);
}

/**
 * Partially updates the caller's profile. The PATCH route is guarded by
 * optimistic concurrency: `version` (read from a prior GET /profile, or
 * returned by the previous update) is sent as the `If-Match` header; a stale
 * value makes the API respond 412. Returns the freshly-written profile with
 * its bumped `version` so callers can chain further edits.
 *
 * Mirrors `updateCardAction` — the established If-Match write pattern.
 */
export async function updateProfileAction(
	version: number,
	payload: UpdateProfileInput,
): Promise<Profile> {
	return apiCall<Profile>(
		"/api/v1/profile",
		ProfileSchema,
		{
			method: "PATCH",
			headers: { "If-Match": String(version) },
			body: JSON.stringify(payload),
		},
		"Failed to update profile",
	);
}
