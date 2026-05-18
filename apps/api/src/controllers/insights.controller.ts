import type { RequestHandler } from 'express'

import {
  listProblemCardsQuerySchema,
  maturityHistoryQuerySchema,
} from '../schemas/insights.schema.ts'
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

/**
 * GET /api/v1/insights/card-quality
 *
 * Backend Completion Plan Stage 8 — six fixed issue-type rows with counts
 * over the user's vocabulary+grammar cards. No query parameters; the
 * response is fully determined by the authenticated user and current
 * card content.
 *
 * Feeds the card-health distribution strip on `/cards`. Bars stay zero
 * until generated content (Stage 2 onward) starts populating the new
 * Lapis fields — that's expected, not a regression.
 */
export const cardQuality: RequestHandler = async (req, res): Promise<void> => {
  const data = await insightsService.listCardQualityIssues(req.user.id)
  res.json(data)
}

/**
 * GET /api/v1/insights/maturity-history?days=…
 *
 * Backend Completion Plan Stage 9 — maturity-pipeline history. The `days`
 * window is one of `90 | 180 | 365`; Zod rejects everything else with 400.
 *
 * Historical rows come from the daily snapshot table; today's row is
 * always computed live so the chart reflects the user's current moment.
 */
export const maturityHistory: RequestHandler = async (req, res): Promise<void> => {
  const { days } = maturityHistoryQuerySchema.parse(req.query)
  const data     = await insightsService.listMaturityHistory(req.user.id, days)
  res.json(data)
}
