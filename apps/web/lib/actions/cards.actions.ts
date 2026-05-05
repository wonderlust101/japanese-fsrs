'use server'

import { z } from 'zod'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiCardSchema,
  ApiCardListItemSchema,
  ApiSimilarCardSchema,
  GeneratedCardDataSchema,
  GeneratedSentencesSchema,
  GeneratedMnemonicSchema,
  voidResponseSchema,
  type ApiCard,
  type ApiCardListItem,
  type ApiSimilarCard,
  type CardStatusFilter,
  type CreateCardPayload,
  type UpdateCardPayload,
  type GeneratedCardData,
  type GeneratedSentences,
  type GeneratedMnemonic,
} from '@fsrs-japanese/shared-types'

// ─── Card list ────────────────────────────────────────────────────────────────

const CardListPageSchema = z.object({
  items:      z.array(ApiCardListItemSchema),
  nextCursor: z.string().nullable(),
  hasMore:    z.boolean(),
})

export interface CardListPage {
  items:      ApiCardListItem[]
  nextCursor: string | null
  hasMore:    boolean
}

const EMPTY_PAGE: CardListPage = { items: [], nextCursor: null, hasMore: false }

export async function listCardsAction(
  deckId:  string,
  options: { limit?: number; cursor?: string; status?: CardStatusFilter },
): Promise<CardListPage> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined)                             params.set('cursor', options.cursor)
  if (options.status !== undefined && options.status !== 'all') params.set('status', options.status)

  return apiCallSafe<CardListPage>(
    `/api/v1/decks/${deckId}/cards?${params.toString()}`,
    CardListPageSchema,
    {},
    EMPTY_PAGE,
  )
}

// ─── AI flows ─────────────────────────────────────────────────────────────────

export async function generateCardPreviewAction(word: string): Promise<GeneratedCardData> {
  return apiCall<GeneratedCardData>(
    '/api/v1/ai/generate-card',
    GeneratedCardDataSchema,
    { method: 'POST', body: JSON.stringify({ word }) },
    'Failed to generate card',
  )
}

/** Save payload: the web only ever uses the manual (fields_data) branch of
 *  CreateCardPayload, never the AI (word) branch — that flow goes through
 *  generateCardPreviewAction first. */
type ManualCreateCardPayload = Extract<CreateCardPayload, { fields_data: unknown }>

export async function saveCardAction(deckId: string, payload: ManualCreateCardPayload): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/decks/${deckId}/cards`,
    voidResponseSchema,
    { method: 'POST', body: JSON.stringify(payload) },
    'Failed to save card',
  )
}

// ─── Card detail / edit / delete ─────────────────────────────────────────────

export async function getCardAction(deckId: string, cardId: string): Promise<ApiCard | null> {
  return apiCallSafe<ApiCard | null>(
    `/api/v1/decks/${deckId}/cards/${cardId}`,
    ApiCardSchema.nullable(),
    {},
    null,
  )
}

export async function getSimilarCardsAction(cardId: string): Promise<ApiSimilarCard[]> {
  return apiCallSafe<ApiSimilarCard[]>(`/api/v1/cards/${cardId}/similar`, z.array(ApiSimilarCardSchema), {}, [])
}

export async function updateCardAction(cardId: string, payload: UpdateCardPayload): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/cards/${cardId}`,
    voidResponseSchema,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update card',
  )
}

export async function generateSentencesAction(
  cardId: string,
  count?: number,
): Promise<GeneratedSentences> {
  return apiCall<GeneratedSentences>(
    '/api/v1/ai/generate-sentences',
    GeneratedSentencesSchema,
    {
      method: 'POST',
      body:   JSON.stringify(count !== undefined ? { cardId, count } : { cardId }),
    },
    'Failed to regenerate sentences',
  )
}

export async function generateMnemonicAction(cardId: string): Promise<GeneratedMnemonic> {
  return apiCall<GeneratedMnemonic>(
    '/api/v1/ai/generate-mnemonic',
    GeneratedMnemonicSchema,
    { method: 'POST', body: JSON.stringify({ cardId }) },
    'Failed to regenerate mnemonic',
  )
}

export async function deleteCardAction(cardId: string): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/cards/${cardId}`,
    voidResponseSchema,
    { method: 'DELETE' },
    'Failed to delete card',
  )
}
