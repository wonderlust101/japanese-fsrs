import { z } from 'zod'

// Mirrors the jlpt_level DB enum exactly — all six values, no extras.
// CLAUDE.md: 'beyond_jlpt' is the correct value for native/non-JLPT vocabulary;
// never use null to mean "not on JLPT".
export const jlptLevelEnum = z.enum(['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt'])

export const updateProfileSchema = z.object({
  jlpt_target:           jlptLevelEnum.optional(),
  study_goal:            z.string().trim().max(500).optional(),
  interests:             z.array(z.string().trim().min(1)).max(20).optional(),
  daily_new_cards_limit: z.number().int().min(1).max(9999).optional(),
  daily_review_limit:    z.number().int().min(1).max(9999).optional(),
  retention_target:      z.number().min(0.7).max(0.99).optional(),
  timezone:              z.string().trim().min(1).max(100).optional(),
}).strict()

export type JlptLevel         = z.infer<typeof jlptLevelEnum>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
