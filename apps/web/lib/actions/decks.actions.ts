'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiCopyDeckResultSchema,
  ApiDeckSchema,
  ApiDeckWithStatsSchema,
  apiListEnvelope,
  voidResponseSchema,
  type ApiCopyDeckResult,
  type ApiDeck,
  type ApiDeckWithStats,
  type ApiList,
  type CreateDeckPayload,
  type UpdateDeckPayload,
} from '@fsrs-japanese/shared-types'

const EMPTY_DECKS_PAGE: ApiList<ApiDeck> = { items: [], nextCursor: null, hasMore: false }

/** Server-side filter forwarded to `GET /api/v1/decks?view=`. Matches the
 *  backend contract introduced in migration 20260622000000_deck_archive.sql:
 *  `'active'` (default) excludes `archived_at IS NOT NULL`, `'archived'`
 *  flips that, and `'all'` drops the filter entirely. */
export type DeckListView = 'active' | 'archived' | 'all'

export async function listDecksAction(
  options: { limit?: number; cursor?: string; view?: DeckListView } = {},
): Promise<ApiList<ApiDeck>> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined) params.set('cursor', options.cursor)
  if (options.view   !== undefined) params.set('view',   options.view)

  return apiCallSafe<ApiList<ApiDeck>>(
    `/api/v1/decks?${params.toString()}`,
    apiListEnvelope(ApiDeckSchema),
    {},
    EMPTY_DECKS_PAGE,
  )
}

export async function getDeckAction(deckId: string): Promise<ApiDeckWithStats | null> {
  return apiCallSafe<ApiDeckWithStats | null>(
    `/api/v1/decks/${deckId}`,
    ApiDeckWithStatsSchema.nullable(),
    {},
    null,
  )
}

/** Alias for getDeckAction kept while consumers migrate; both call the same endpoint. */
export const getDeckWithStatsAction = getDeckAction

export async function createDeckAction(payload: CreateDeckPayload): Promise<ApiDeck> {
  const key = crypto.randomUUID()
  return apiCall<ApiDeck>(
    '/api/v1/decks',
    ApiDeckSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
      body:    JSON.stringify(payload),
    },
    'Failed to create deck',
  )
}

export async function deleteDeckAction(deckId: string): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/decks/${deckId}`,
    voidResponseSchema,
    { method: 'DELETE' },
    'Failed to delete deck',
  )
}

export async function updateDeckAction(
  deckId:  string,
  payload: UpdateDeckPayload,
): Promise<ApiDeck> {
  return apiCall<ApiDeck>(
    `/api/v1/decks/${deckId}`,
    ApiDeckSchema,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    },
    'Failed to update deck',
  )
}

/**
 * POST /api/v1/decks/:id/copy — duplicate a deck the caller owns. Returns
 * `{ deckId, cardCount }`. An empty body lets the server pick the default
 * name (`<source> (Copy [N])`); the wider catalogue UI doesn't surface a
 * name dialog, so we don't either.
 *
 * Fresh `Idempotency-Key` per call so a deliberate "copy again" makes
 * another deck; double-click protection is handled at the UI layer.
 */
export async function copyDeckAction(deckId: string): Promise<ApiCopyDeckResult> {
  const key = crypto.randomUUID()
  return apiCall<ApiCopyDeckResult>(
    `/api/v1/decks/${deckId}/copy`,
    ApiCopyDeckResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
    },
    'Failed to copy deck',
  )
}

export async function archiveDeckAction(deckId: string): Promise<ApiDeck> {
  return apiCall<ApiDeck>(
    `/api/v1/decks/${deckId}/archive`,
    ApiDeckSchema,
    { method: 'POST' },
    'Failed to archive deck',
  )
}

export async function unarchiveDeckAction(deckId: string): Promise<ApiDeck> {
  return apiCall<ApiDeck>(
    `/api/v1/decks/${deckId}/unarchive`,
    ApiDeckSchema,
    { method: 'POST' },
    'Failed to unarchive deck',
  )
}
