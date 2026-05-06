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

/**
 * GET /api/v1/analytics/streak
 * Returns the user's current/longest streak and last review date.
 */
export const streak: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getStreak(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/analytics/jlpt-gap
 * Returns per-JLPT-level total/learned/due counts plus progressPct.
 */
export const jlptGap: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getJlptGap(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/analytics/milestones
 * Returns per-JLPT-level projected completion dates based on the user's
 * 30-day learning pace.
 */
export const milestones: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getMilestoneForecast(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/analytics/dashboard
 * Bundled response combining heatmap, accuracy, streak, JLPT gap, and
 * milestone forecast in a single round-trip. The granular endpoints above
 * remain available for partial reloads.
 */
export const dashboard: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await analyticsService.getDashboardData(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}
