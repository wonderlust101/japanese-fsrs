'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import type { ApiDeck, ApiDeckWithStats } from '@fsrs-japanese/shared-types'

export interface DeckSummary {
  id:   string
  name: string
}

export type DeckRow    = ApiDeck
export type DeckDetail = ApiDeckWithStats

export interface DeckStats {
  dueCount:  number
  newCount:  number
  cardCount: number
}

export interface CreateDeckPayload {
  name:        string
  description: string | undefined
  deck_type:   'vocabulary' | 'grammar' | 'kanji' | 'mixed'
}

export async function listDecksAction(): Promise<DeckRow[]> {
  return apiCallSafe<DeckRow[]>('/api/v1/decks', {}, [])
}

export async function getDeckStatsAction(deckId: string): Promise<DeckStats | null> {
  return apiCallSafe<DeckStats | null>(`/api/v1/decks/${deckId}`, {}, null)
}

export async function getDeckWithStatsAction(deckId: string): Promise<DeckDetail | null> {
  return apiCallSafe<DeckDetail | null>(`/api/v1/decks/${deckId}`, {}, null)
}

export async function getDeckAction(deckId: string): Promise<DeckSummary | null> {
  return apiCallSafe<DeckSummary | null>(`/api/v1/decks/${deckId}`, {}, null)
}

export async function createDeckAction(payload: CreateDeckPayload): Promise<{ id: string; name: string }> {
  return apiCall<{ id: string; name: string }>(
    '/api/v1/decks',
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to create deck',
  )
}

export async function deleteDeckAction(deckId: string): Promise<void> {
  await apiCall<unknown>(`/api/v1/decks/${deckId}`, { method: 'DELETE' }, 'Failed to delete deck')
}
