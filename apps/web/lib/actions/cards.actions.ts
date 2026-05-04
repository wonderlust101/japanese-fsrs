'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import type { ApiCard, ApiCardListItem } from '@fsrs-japanese/shared-types'

// ─── Card list types ──────────────────────────────────────────────────────────

export type CardItem = ApiCardListItem

export interface CardListPage {
  items:      CardItem[]
  nextCursor: string | null
  hasMore:    boolean
}

const EMPTY_PAGE: CardListPage = { items: [], nextCursor: null, hasMore: false }

export async function listCardsAction(
  deckId:  string,
  options: { limit?: number; cursor?: string; status?: string },
): Promise<CardListPage> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined)                             params.set('cursor', options.cursor)
  if (options.status !== undefined && options.status !== 'all') params.set('status', options.status)

  return apiCallSafe<CardListPage>(
    `/api/v1/decks/${deckId}/cards?${params.toString()}`,
    {},
    EMPTY_PAGE,
  )
}

// Mirrors GeneratedCardDataSchema from the API — fields_data shape for a vocabulary card.
export interface GeneratedCardData {
  word:              string
  reading:           string
  meaning:           string
  partOfSpeech?:     string
  exampleSentences?: { ja: string; en: string; furigana: string }[]
  kanjiBreakdown?:   { kanji: string; meaning: string }[]
  pitchAccent?:      string
  mnemonic?:         string
}

export interface SaveCardPayload {
  fields_data:  GeneratedCardData
  layout_type?: 'vocabulary' | 'grammar' | 'sentence'
  card_type?:   'comprehension' | 'production' | 'listening'
  jlpt_level?:  string
  tags?:        string[]
}

export async function generateCardPreviewAction(word: string): Promise<GeneratedCardData> {
  return apiCall<GeneratedCardData>(
    '/api/v1/ai/generate-card',
    { method: 'POST', body: JSON.stringify({ word }) },
    'Failed to generate card',
  )
}

export async function saveCardAction(deckId: string, payload: SaveCardPayload): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/decks/${deckId}/cards`,
    {
      method: 'POST',
      body:   JSON.stringify({
        fields_data: payload.fields_data,
        layout_type: payload.layout_type ?? 'vocabulary',
        card_type:   payload.card_type   ?? 'comprehension',
        jlpt_level:  payload.jlpt_level,
        tags:        payload.tags,
      }),
    },
    'Failed to save card',
  )
}

// ─── Card detail types ────────────────────────────────────────────────────────

export type CardDetail = ApiCard

export async function getCardAction(deckId: string, cardId: string): Promise<CardDetail | null> {
  return apiCallSafe<CardDetail | null>(
    `/api/v1/decks/${deckId}/cards/${cardId}`,
    {},
    null,
  )
}

export async function getSimilarCardsAction(cardId: string): Promise<CardItem[]> {
  return apiCallSafe<CardItem[]>(`/api/v1/cards/${cardId}/similar`, {}, [])
}

// ─── Card edit / delete actions ───────────────────────────────────────────────

export interface UpdateCardPayload {
  fields_data?: Record<string, unknown>
  jlpt_level?:  string | null
  tags?:        string[]
}

export async function updateCardAction(cardId: string, payload: UpdateCardPayload): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/cards/${cardId}`,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update card',
  )
}

export interface RegeneratedSentences {
  sentences: { ja: string; en: string; furigana: string }[]
}

export async function generateSentencesAction(
  cardId: string,
  count?: number,
): Promise<RegeneratedSentences> {
  return apiCall<RegeneratedSentences>(
    '/api/v1/ai/generate-sentences',
    {
      method: 'POST',
      body:   JSON.stringify(count !== undefined ? { cardId, count } : { cardId }),
    },
    'Failed to regenerate sentences',
  )
}

export interface RegeneratedMnemonic {
  mnemonic: string
}

export async function generateMnemonicAction(cardId: string): Promise<RegeneratedMnemonic> {
  return apiCall<RegeneratedMnemonic>(
    '/api/v1/ai/generate-mnemonic',
    { method: 'POST', body: JSON.stringify({ cardId }) },
    'Failed to regenerate mnemonic',
  )
}

export async function deleteCardAction(cardId: string): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/cards/${cardId}`,
    { method: 'DELETE' },
    'Failed to delete card',
  )
}
