'use server'

import {
  ApiLeechDrillAttemptSchema,
  ApiLeechDrillSessionDetailSchema,
  ApiLeechDrillSessionSchema,
  ApiLeechListItemSchema,
  ApiLeechListResponseSchema,
  type ApiLeechDrillAttempt,
  type ApiLeechDrillAttemptResult,
  type ApiLeechDrillSession,
  type ApiLeechDrillSessionDetail,
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

// ─── Drill sessions (Phase 2) ────────────────────────────────────────────────

export type CreateDrillSessionInput =
  | {
      source:        'unresolvedLeeches'
      deckId?:       string
      jlptLevel?:    string
      cardType?:     string
      order?:        'mostRecent' | 'mostLapses' | 'oldestUnresolved' | 'deckOrder'
      limit?:        number
      repeatPolicy?: 'none' | 'missedAfterLag'
    }
  | {
      source:        'deckScoped'
      deckId:        string
      jlptLevel?:    string
      cardType?:     string
      order?:        'mostRecent' | 'mostLapses' | 'oldestUnresolved' | 'deckOrder'
      limit?:        number
      repeatPolicy?: 'none' | 'missedAfterLag'
    }
  | {
      source:        'highLapseCandidates'
      jlptLevel?:    string
      cardType?:     string
      minLapses?:    number
      order?:        'mostRecent' | 'mostLapses' | 'oldestUnresolved' | 'deckOrder'
      limit?:        number
      repeatPolicy?: 'none' | 'missedAfterLag'
    }
  | {
      source:        'currentCard'
      cardId:        string
      limit?:        number
      repeatPolicy?: 'none' | 'missedAfterLag'
    }
  | {
      source:        'manualSelection'
      cardIds:       string[]
      limit?:        number
      repeatPolicy?: 'none' | 'missedAfterLag'
    }

/**
 * Create a new drill session. The backend requires an `Idempotency-Key`
 * header so a network retry on the start screen doesn't create two parallel
 * sessions. We mint a fresh UUID per call — replay protection is by payload,
 * not by key, so a different payload produces a different session.
 */
export async function createDrillSessionAction(
  input: CreateDrillSessionInput,
): Promise<ApiLeechDrillSession> {
  const idempotencyKey = crypto.randomUUID()
  return apiCall<ApiLeechDrillSession>(
    '/api/v1/leeches/drill-sessions',
    ApiLeechDrillSessionSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': idempotencyKey },
      body:    JSON.stringify(input),
    },
    'Failed to create drill session',
  )
}

/**
 * Resume / refresh a drill session. Returns the full queue plus per-row
 * stale flags so the client can warn when canonical scheduler state has
 * changed underneath the snapshot (a real review happened elsewhere).
 */
export async function getDrillSessionAction(
  sessionId: string,
): Promise<ApiLeechDrillSessionDetail> {
  return apiCall<ApiLeechDrillSessionDetail>(
    `/api/v1/leeches/drill-sessions/${sessionId}`,
    ApiLeechDrillSessionDetailSchema,
    {},
    'Failed to load drill session',
  )
}

export interface RecordDrillAttemptInput {
  eventId:          string
  sessionCardId:    string
  leechId?:         string
  cardId?:          string
  result:           ApiLeechDrillAttemptResult
  localSequence?:   number
  responseTimeMs?:  number
  shownAt?:         string
  answeredAt?:      string
}

/**
 * Record a drill attempt. The `eventId` is the domain idempotency key —
 * a retry with the same id returns the original row without a second insert.
 * Wire payload mirrors `recordDrillAttemptSchema` from the API; the request
 * body itself is the idempotency key payload (no separate header needed for
 * drill attempts, unlike create/finish).
 */
export async function recordDrillAttemptAction(
  sessionId: string,
  input:     RecordDrillAttemptInput,
): Promise<ApiLeechDrillAttempt> {
  return apiCall<ApiLeechDrillAttempt>(
    `/api/v1/leeches/drill-sessions/${sessionId}/attempts`,
    ApiLeechDrillAttemptSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': input.eventId },
      body:    JSON.stringify(input),
    },
    'Failed to record drill attempt',
  )
}

/**
 * Mark a drill session finished. Bridges to the post-drill summary surface.
 * Strict-empty body per the backend's `emptyBodySchema`.
 */
export async function finishDrillSessionAction(
  sessionId: string,
): Promise<ApiLeechDrillSessionDetail> {
  return apiCall<ApiLeechDrillSessionDetail>(
    `/api/v1/leeches/drill-sessions/${sessionId}/finish`,
    ApiLeechDrillSessionDetailSchema,
    {
      method:  'POST',
      body:    JSON.stringify({}),
    },
    'Failed to finish drill session',
  )
}

/**
 * Abort a drill session. Used when the learner exits before reaching the
 * end of the queue. Backend treats this as a terminal status — the session
 * cannot be resumed once aborted.
 */
export async function abortDrillSessionAction(
  sessionId: string,
): Promise<ApiLeechDrillSessionDetail> {
  return apiCall<ApiLeechDrillSessionDetail>(
    `/api/v1/leeches/drill-sessions/${sessionId}/abort`,
    ApiLeechDrillSessionDetailSchema,
    {
      method:  'POST',
      body:    JSON.stringify({}),
    },
    'Failed to abort drill session',
  )
}
