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

/**
 * Backend Completion Plan Stage 10 — query schema for
 * `GET /api/v1/insights/confusable-pairs`. `limit` arrives as a string;
 * `z.coerce.number()` converts. Bounded [1, 100] — matching the RPC's
 * server-side cap.
 */
export const listConfusablePairsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict()

export type ListConfusablePairsQuery = z.infer<typeof listConfusablePairsQuerySchema>
