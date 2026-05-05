import type { z } from 'zod'

import type { SessionLeechSchema, SessionSummarySchema } from './schemas/api.schema.ts'

export const ReviewRating = {
  Manual: 'manual', // forget / reschedule operations; never a user-facing rating
  Again:  'again',
  Hard:   'hard',
  Good:   'good',
  Easy:   'easy',
} as const
export type ReviewRating = typeof ReviewRating[keyof typeof ReviewRating]

export type SessionLeech   = z.infer<typeof SessionLeechSchema>
export type SessionSummary = z.infer<typeof SessionSummarySchema>
