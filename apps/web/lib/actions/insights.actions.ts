'use server'

import { z } from 'zod'

import {
  ApiMaturitySnapshotSchema,
  type ApiMaturitySnapshot,
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
