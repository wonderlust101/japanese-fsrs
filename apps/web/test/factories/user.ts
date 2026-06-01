/**
 * Factory for the `Profile` shape returned by `GET /api/v1/profile`.
 *
 * Matches `ProfileSchema` in `packages/shared-types/src/schemas/api.schema.ts`.
 * Defaults model a fresh-but-onboarded learner: English native speaker
 * targeting N5, `dailyNewCardsLimit = 10`, retention target 0.88 (the global
 * FSRS request_retention).
 */

import type { Profile } from "@fsrs-japanese/shared-types";

export function makeProfile(overrides: Partial<Profile> = {}): Profile {
	const base: Profile = {
		id: "user-1",
		nativeLanguage: "en",
		jlptTarget: "N5",
		studyGoal: null,
		interests: [],
		dailyNewCardsLimit: 10,
		dailyReviewLimit: 200,
		retentionTarget: 0.88,
		timezone: "UTC",
		version: 1,
		createdAt: "2026-05-01T00:00:00.000Z",
		updatedAt: "2026-05-01T00:00:00.000Z",
	};
	return { ...base, ...overrides };
}
