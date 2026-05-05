import { z } from 'zod'

import { cardTypeEnum, jlptLevelEnum } from '@fsrs-japanese/shared-types'

// ─── RPC response schemas ─────────────────────────────────────────────────────
// Numeric columns from PostgreSQL aggregations may serialize as strings or
// numbers depending on the type (NUMERIC vs INT). z.coerce.number() normalises.

export const HeatmapRpcRowSchema = z.object({
  date:      z.string(),
  retention: z.coerce.number(),
  count:     z.coerce.number(),
})
export const HeatmapRpcSchema = z.array(HeatmapRpcRowSchema)
export type HeatmapRpcRow = z.infer<typeof HeatmapRpcRowSchema>

export const AccuracyRpcRowSchema = z.object({
  layout:     cardTypeEnum,
  total:      z.coerce.number(),
  successful: z.coerce.number(),
})
export const AccuracyRpcSchema = z.array(AccuracyRpcRowSchema)
export type AccuracyRpcRow = z.infer<typeof AccuracyRpcRowSchema>

export const StreakRpcRowSchema = z.object({
  current_streak:   z.coerce.number().nullable(),
  longest_streak:   z.coerce.number().nullable(),
  last_review_date: z.string().nullable(),
})
export const StreakRpcSchema = z.array(StreakRpcRowSchema)
export type StreakRpcRow = z.infer<typeof StreakRpcRowSchema>

export const JlptGapRpcRowSchema = z.object({
  jlpt_level: jlptLevelEnum,
  total:      z.coerce.number(),
  learned:    z.coerce.number(),
  due:        z.coerce.number(),
})
export const JlptGapRpcSchema = z.array(JlptGapRpcRowSchema)
export type JlptGapRpcRow = z.infer<typeof JlptGapRpcRowSchema>

export const MilestoneForecastRpcRowSchema = z.object({
  jlpt_level:                jlptLevelEnum,
  total:                     z.coerce.number(),
  learned:                   z.coerce.number(),
  daily_pace:                z.coerce.number().nullable(),
  days_remaining:            z.coerce.number().nullable(),
  projected_completion_date: z.string().nullable(),
})
export const MilestoneForecastRpcSchema = z.array(MilestoneForecastRpcRowSchema)
export type MilestoneForecastRpcRow = z.infer<typeof MilestoneForecastRpcRowSchema>
