'use server'

import { z } from 'zod'

import {
  ApiMaturitySnapshotSchema,
  ApiCardQualityIssueSchema,
  ApiInsightsDistributionsSchema,
  type ApiMaturitySnapshot,
  type ApiCardQualityIssue,
  type ApiInsightsDistributions,
} from '@fsrs-japanese/shared-types'

import { apiCallSafe } from '@/lib/api/client'

/**
 * Backend Completion Plan Stage 9 — `GET /api/v1/insights/maturity-history`.
 * Returns up to `days` worth of per-day (date, new, learning, review,
 * relearning, mature) snapshots. Today's row is always computed live on the
 * server so the chart reflects the current moment between cron runs.
 *
 * Empty fallback (`[]`) for unauthenticated calls / 5xx is graceful: every
 * downstream consumer (Statistics page, the existing Progress mature-pipeline
 * chart) already renders empty-state messaging when the array is empty.
 */
export type MaturityHistoryWindow = '90' | '180' | '365'

export async function getMaturityHistoryAction(
  days: MaturityHistoryWindow = '90',
): Promise<ReadonlyArray<ApiMaturitySnapshot>> {
  return apiCallSafe<ReadonlyArray<ApiMaturitySnapshot>>(
    `/api/v1/insights/maturity-history?days=${days}`,
    z.array(ApiMaturitySnapshotSchema),
    {},
    [],
  )
}

/**
 * Backend Completion Plan Stage 8 — `GET /api/v1/insights/card-quality`.
 * Six rows of `{ issueType, count }` describing how many of the learner's
 * vocabulary+grammar cards are missing a given support field. Always
 * returns all six rows (zero-filled) so the consumer renders a stable
 * shape. Auth/5xx returns an empty array so the panel reads as a positive.
 */
export async function getCardQualityIssuesAction(): Promise<ReadonlyArray<ApiCardQualityIssue>> {
  return apiCallSafe<ReadonlyArray<ApiCardQualityIssue>>(
    '/api/v1/insights/card-quality',
    z.array(ApiCardQualityIssueSchema),
    {},
    [],
  )
}

/**
 * Bundled distributions for the Statistics page — `GET /api/v1/insights/distributions`.
 * Four histograms (rating + interval + FSRS stability + FSRS difficulty) in
 * one round-trip. Auth/5xx falls back to a zero-filled bundle so the page
 * keeps rendering calm empty-state copy instead of erroring.
 */
const EMPTY_DISTRIBUTIONS: ApiInsightsDistributions = {
  ratings:    { again: 0, hard: 0, good: 0, easy: 0 },
  intervals:  [],
  stability:  [],
  difficulty: [],
}

export async function getInsightsDistributionsAction(): Promise<ApiInsightsDistributions> {
  return apiCallSafe<ApiInsightsDistributions>(
    '/api/v1/insights/distributions',
    ApiInsightsDistributionsSchema,
    {},
    EMPTY_DISTRIBUTIONS,
  )
}
