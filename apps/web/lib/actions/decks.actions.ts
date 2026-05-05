'use server'

import { z } from 'zod'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiDeckSchema,
  ApiDeckWithStatsSchema,
  voidResponseSchema,
  type ApiDeck,
  type ApiDeckWithStats,
  type CreateDeckPayload,
} from '@fsrs-japanese/shared-types'

export async function listDecksAction(): Promise<ApiDeck[]> {
  return apiCallSafe<ApiDeck[]>('/api/v1/decks', z.array(ApiDeckSchema), {}, [])
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
  return apiCall<ApiDeck>(
    '/api/v1/decks',
    ApiDeckSchema,
    { method: 'POST', body: JSON.stringify(payload) },
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
