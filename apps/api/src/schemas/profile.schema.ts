import { z } from 'zod'

import { JLPTLevel } from '@fsrs-japanese/shared-types'

import { safeShortText } from '../lib/sanitize.ts'

// Derived from the canonical JLPTLevel const in shared-types.
// CLAUDE.md: 'beyond_jlpt' is the correct value for native/non-JLPT vocabulary;
// never use null to mean "not on JLPT".
export const jlptLevelEnum = z.enum(Object.values(JLPTLevel) as [JLPTLevel, ...JLPTLevel[]])

export const updateProfileSchema = z.object({
  jlpt_target:           jlptLevelEnum.optional(),
  study_goal:            safeShortText(500).optional(),
  interests:             z.array(safeShortText(50, 1)).max(20).optional(),
  daily_new_cards_limit: z.number().int().min(1).max(9999).optional(),
  daily_review_limit:    z.number().int().min(1).max(9999).optional(),
  retention_target:      z.number().min(0.6).max(0.99).optional(),
  timezone:              safeShortText(100, 1).optional(),
  native_language:       safeShortText(10, 2).optional(),
}).strict()

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
