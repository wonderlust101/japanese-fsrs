import { z } from 'zod'

import {
  ApiMaturityHistoryDaysSchema,
} from '@fsrs-japanese/shared-types'

/**
 * Backend Completion Plan Stage 9 — query schema for
 * `GET /api/v1/insights/maturity-history?days=…`. The shared
 * `ApiMaturityHistoryDaysSchema` is a string enum because URL query
 * params arrive as strings; the service coerces to int when calling
 * the RPC.
 */
export const maturityHistoryQuerySchema = z.object({
  days: ApiMaturityHistoryDaysSchema,
}).strict()

export type MaturityHistoryQuery = z.infer<typeof maturityHistoryQuerySchema>
