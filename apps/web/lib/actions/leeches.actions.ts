'use server'

import {
  ApiLeechListItemSchema,
  ApiLeechListResponseSchema,
  type ApiLeechListItem,
  type ApiLeechListResponse,
} from '@fsrs-japanese/shared-types'

import { apiCall, apiCallSafe } from '@/lib/api/client'

// ─── Filter / sort vocabularies (mirror apps/api/src/schemas/leech.schema.ts) ─

export type LeechStatusFilter    = 'unresolved' | 'resolved'
export type LeechDiagnosisFilter = 'available'  | 'missing'
export type LeechSortOrder       =
  | 'mostRecent'
  | 'oldestUnresolved'
  | 'mostLapses'
  | 'deckOrder'

export interface ListLeechesOptions {
  status?:    LeechStatusFilter
  deckId?:    string
  jlptLevel?: string
  cardType?:  string
  diagnosis?: LeechDiagnosisFilter
  sort?:      LeechSortOrder
  limit?:     number
  cursor?:    string
}

const EMPTY_LIST: ApiLeechListResponse = {
  items:      [],
  nextCursor: null,
  hasMore:    false,
}

// ─── List ─────────────────────────────────────────────────────────────────────

/**
 * Fetches the unresolved/resolved leech list with optional filters. Uses the
 * "safe" variant so an unauthenticated session or backend hiccup degrades to
 * an empty list rather than tearing down the page — matches how analytics
 * actions treat their non-critical reads.
 */
export async function listLeechesAction(
  opts: ListLeechesOptions = {},
): Promise<ApiLeechListResponse> {
  const params = new URLSearchParams()
  params.set('status', opts.status ?? 'unresolved')
  params.set('sort',   opts.sort   ?? 'mostRecent')
  params.set('limit',  String(opts.limit ?? 50))
  if (opts.deckId    !== undefined) params.set('deckId',    opts.deckId)
  if (opts.jlptLevel !== undefined) params.set('jlptLevel', opts.jlptLevel)
  if (opts.cardType  !== undefined) params.set('cardType',  opts.cardType)
  if (opts.diagnosis !== undefined) params.set('diagnosis', opts.diagnosis)
  if (opts.cursor    !== undefined) params.set('cursor',    opts.cursor)

  return apiCallSafe<ApiLeechListResponse>(
    `/api/v1/leeches?${params.toString()}`,
    ApiLeechListResponseSchema,
    {},
    EMPTY_LIST,
  )
}

// ─── Detail / lifecycle / diagnosis ───────────────────────────────────────────

export async function getLeechAction(id: string): Promise<ApiLeechListItem> {
  return apiCall<ApiLeechListItem>(
    `/api/v1/leeches/${id}`,
    ApiLeechListItemSchema,
    {},
    'Failed to load leech',
  )
}

export async function resolveLeechAction(id: string): Promise<ApiLeechListItem> {
  return apiCall<ApiLeechListItem>(
    `/api/v1/leeches/${id}/resolve`,
    ApiLeechListItemSchema,
    { method: 'POST' },
    'Failed to resolve leech',
  )
}

export async function reopenLeechAction(id: string): Promise<ApiLeechListItem> {
  return apiCall<ApiLeechListItem>(
    `/api/v1/leeches/${id}/reopen`,
    ApiLeechListItemSchema,
    { method: 'POST' },
    'Failed to reopen leech',
  )
}

/**
 * Triggers AI diagnosis for a leech. The backend requires an
 * `Idempotency-Key` header so OpenAI cost is bounded against retries — we
 * mint a fresh UUID per call. The replay-on-existing semantic on the server
 * means a leech that already has a diagnosis will return the stored values
 * without a re-call even on a fresh key.
 */
export async function diagnoseLeechAction(id: string): Promise<ApiLeechListItem> {
  const idempotencyKey = crypto.randomUUID()
  return apiCall<ApiLeechListItem>(
    `/api/v1/leeches/${id}/diagnose`,
    ApiLeechListItemSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body:    JSON.stringify({}),
    },
    'Failed to diagnose this leech',
  )
}
