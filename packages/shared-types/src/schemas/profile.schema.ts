import { z } from 'zod'

import { jlptLevelEnum } from './card.schema.ts'

import { safeShortText } from '../sanitize.ts'

// jlptLevelEnum is owned by card.schema.ts (single source of truth).
// CLAUDE.md: 'beyond_jlpt' is the correct value for native/non-JLPT vocabulary;
// never use null to mean "not on JLPT".

// Format regexes mirroring the DB CHECK constraints in
// supabase/migrations/20260513000000_validation_hardening.sql. Keeping them
// in lockstep means invalid input surfaces as a Zod 400 instead of a Postgres
// check_violation 500.
export const TIMEZONE_REGEX = /^[A-Za-z]+(\/[A-Za-z0-9_+\-]+)+$/
export const LANGUAGE_TAG_REGEX = /^[a-z]{2,3}(-([A-Z]{2}|[A-Z][a-z]{3}))?$/

export const updateProfileSchema = z.object({
  jlpt_target:           jlptLevelEnum.optional(),
  study_goal:            safeShortText(500).optional(),
  interests:             z.array(safeShortText(50, 1)).max(20).optional(),
  daily_new_cards_limit: z.number().int().min(1).max(9999).optional(),
  daily_review_limit:    z.number().int().min(1).max(9999).optional(),
  retention_target:      z.number().min(0.6).max(0.99).optional(),
  timezone: safeShortText(100, 1)
    .refine(
      (s) => s === 'UTC' || TIMEZONE_REGEX.test(s),
      'Invalid IANA timezone (expected e.g. "America/New_York", "Etc/GMT+8")',
    )
    .optional(),
  native_language: safeShortText(10, 2)
    .refine(
      (s) => LANGUAGE_TAG_REGEX.test(s),
      'Invalid language tag (expected ISO 639-1/3, optionally with region or script — e.g. "en", "en-US", "zh-Hans")',
    )
    .optional(),
}).strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
