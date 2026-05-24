'use server'

import {
  ApiMaturitySnapshotSchema,
  ApiCardQualityIssueSchema,
  ApiInsightsDistributionsSchema,
  apiListEnvelope,
  type ApiMaturitySnapshot,
  type ApiCardQualityIssue,
  type ApiInsightsDistributions,
  type ApiList,
} from '@fsrs-japanese/shared-types'

import { apiCall, apiCallSafe } from '@/lib/api/client'

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

const EMPTY_MATURITY_PAGE: ApiList<ApiMaturitySnapshot> = {
  items: [], nextCursor: null, hasMore: false,
}

export async function getMaturityHistoryAction(
  days: MaturityHistoryWindow = '90',
): Promise<ReadonlyArray<ApiMaturitySnapshot>> {
  // The endpoint returns an ApiList envelope (`{ items, nextCursor, hasMore }`),
  // not a bare array. Validate against the envelope and unwrap `.items` —
  // a bare-array schema here silently fails `safeParse`, and apiCallSafe then
  // returns the empty fallback, leaving the maturity flow stuck at all-zero.
  const page = await apiCallSafe<ApiList<ApiMaturitySnapshot>>(
    `/api/v1/insights/maturity-history?days=${days}`,
    apiListEnvelope(ApiMaturitySnapshotSchema),
    {},
    EMPTY_MATURITY_PAGE,
  )
  return page.items
}

/**
 * Backend Completion Plan Stage 8 — `GET /api/v1/insights/card-quality`.
 * Six rows of `{ issueType, count }` describing how many of the learner's
 * vocabulary+grammar cards are missing a given support field. Always
 * returns all six rows (zero-filled) so the consumer renders a stable
 * shape. Auth/5xx returns an empty array so the panel reads as a positive.
 */
const EMPTY_CARD_QUALITY_PAGE: ApiList<ApiCardQualityIssue> = {
  items: [], nextCursor: null, hasMore: false,
}

export async function getCardQualityIssuesAction(): Promise<ReadonlyArray<ApiCardQualityIssue>> {
  // Same ApiList envelope contract as maturity-history — unwrap `.items`.
  const page = await apiCallSafe<ApiList<ApiCardQualityIssue>>(
    '/api/v1/insights/card-quality',
    apiListEnvelope(ApiCardQualityIssueSchema),
    {},
    EMPTY_CARD_QUALITY_PAGE,
  )
  return page.items
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

// ── Strict (throwing) variants ────────────────────────────────────────────────
//
// The Statistics deep-dive opts into real error visibility: these throw on
// failure so TanStack Query exposes `isError`/`refetch`, letting each module
// show a "couldn't load, retry" state distinct from a genuine empty one. The
// safe variants above stay the default everywhere else (today, review session,
// overview), preserving the app-wide fail-open behavior those surfaces rely on.

export async function getInsightsDistributionsStrictAction(): Promise<ApiInsightsDistributions> {
  return apiCall<ApiInsightsDistributions>(
    '/api/v1/insights/distributions',
    ApiInsightsDistributionsSchema,
    {},
    'Failed to fetch distributions',
  )
}

export async function getMaturityHistoryStrictAction(
  days: MaturityHistoryWindow = '90',
): Promise<ReadonlyArray<ApiMaturitySnapshot>> {
  const page = await apiCall<ApiList<ApiMaturitySnapshot>>(
    `/api/v1/insights/maturity-history?days=${days}`,
    apiListEnvelope(ApiMaturitySnapshotSchema),
    {},
    'Failed to fetch maturity history',
  )
  return page.items
}
