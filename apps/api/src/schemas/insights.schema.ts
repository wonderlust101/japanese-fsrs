import { z } from 'zod'

import {
  ApiProblemCardBucketSchema,
  ApiMaturityHistoryDaysSchema,
} from '@fsrs-japanese/shared-types'

/**
 * Backend Completion Plan Stage 7 — query schema for
 * `GET /api/v1/insights/problem-cards?bucket=…`. Strict so an unknown
 * query parameter is a 400, not silently dropped. The `bucket` enum is
 * the shared wire-format enum to keep the SQL RPC, the service, and the
 * frontend (when one exists) reading from one source of truth.
 */
export const listProblemCardsQuerySchema = z.object({
  bucket: ApiProblemCardBucketSchema,
}).strict()

export type ListProblemCardsQuery = z.infer<typeof listProblemCardsQuerySchema>

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
