import type { RequestHandler } from 'express'

import { listProblemCardsQuerySchema } from '../schemas/insights.schema.ts'
import * as insightsService from '../services/insights.service.ts'

/**
 * GET /api/v1/insights/problem-cards?bucket=…
 *
 * Backend Completion Plan Stage 7 — problem cards bucketed by lapse count.
 * Bucket values are validated at the Zod layer; an unknown bucket → 400.
 *
 * The route is consumer-agnostic: future surfaces (a `/cards` lapse-range
 * saved view, an analytics histogram, parity diagnostics) can pick this up
 * without a contract change. No live consumer in the current frontend.
 */
export const problemCards: RequestHandler = async (req, res): Promise<void> => {
  const { bucket } = listProblemCardsQuerySchema.parse(req.query)
  const data       = await insightsService.listProblemCards(req.user.id, bucket)
  res.json(data)
}
