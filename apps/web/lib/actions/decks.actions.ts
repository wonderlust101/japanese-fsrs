'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiDeckSchema,
  ApiDeckWithStatsSchema,
  apiListEnvelope,
  voidResponseSchema,
  type ApiDeck,
  type ApiDeckWithStats,
  type ApiList,
  type CreateDeckPayload,
} from '@fsrs-japanese/shared-types'

const EMPTY_DECKS_PAGE: ApiList<ApiDeck> = { items: [], nextCursor: null, hasMore: false }

export async function listDecksAction(
  options: { limit?: number; cursor?: string } = {},
): Promise<ApiList<ApiDeck>> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined) params.set('cursor', options.cursor)

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
