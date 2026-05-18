import { z } from 'zod'

import { ApiProblemCardBucketSchema } from '@fsrs-japanese/shared-types'

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
