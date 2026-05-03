import type { RequestHandler } from 'express'

import * as analyticsService from '../services/analytics.service.ts'

/**
 * GET /api/v1/analytics/heatmap
 * Returns daily retention rates for the last 365 days.
 * Days with zero reviews are omitted — the frontend fills those gaps as 0.
 */
export const heatmap: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getHeatmapData(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/analytics/accuracy
 * Returns review accuracy broken down by layout (comprehension | production | listening).
 */
export const accuracy: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getAccuracyByLayout(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
