import { z } from "zod";

import { safeShortText } from "../sanitize.ts";

import { jlptLevelEnum } from "./card.schema.ts";

// jlptLevelEnum is owned by card.schema.ts (single source of truth).
// CLAUDE.md: 'beyond_jlpt' is the correct value for native/non-JLPT vocabulary;
// never use null to mean "not on JLPT".

// Format regexes mirroring the DB CHECK constraints in
// supabase/migrations/20260513000000_validation_hardening.sql. Keeping them
// in lockstep means invalid input surfaces as a Zod 400 instead of a Postgres
// check_violation 500.
export const TIMEZONE_REGEX = /^[A-Z]+(\/[\w+\-]+)+$/i;
export const LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(-([A-Z]{2}|[A-Z][a-z]{3}))?$/;

export const updateProfileSchema = z.object({
	jlptTarget: jlptLevelEnum.optional(),
	studyGoal: safeShortText(500).optional(),
	interests: z.array(safeShortText(50, 1)).max(20).optional(),
	dailyNewCardsLimit: z.number().int().min(1).max(9999).optional(),
	dailyReviewLimit: z.number().int().min(1).max(9999).optional(),
	retentionTarget: z.number().min(0.6).max(0.99).optional(),
	timezone: safeShortText(100, 1)
		.refine(
			s => s === "UTC" || TIMEZONE_REGEX.test(s),
			"Invalid IANA timezone (expected e.g. \"America/New_York\", \"Etc/GMT+8\")",
		)
		.optional(),
	nativeLanguage: safeShortText(10, 2)
		.refine(
			s => LANGUAGE_TAG_REGEX.test(s),
			"Invalid language tag (expected ISO 639-1/3, optionally with region or script — e.g. \"en\", \"en-US\", \"zh-Hans\")",
		)
		.optional(),
}).strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
