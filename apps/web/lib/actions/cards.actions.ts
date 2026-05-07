'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiCardSchema,
  ApiCardListItemSchema,
  ApiSimilarCardSchema,
  GeneratedCardDataSchema,
  GeneratedSentencesSchema,
  GeneratedMnemonicSchema,
  apiListEnvelope,
  voidResponseSchema,
  type ApiCard,
  type ApiCardListItem,
  type ApiList,
  type ApiSimilarCard,
  type CardStatusFilter,
  type CreateCardPayload,
  type UpdateCardPayload,
  type GeneratedCardData,
  type GeneratedSentences,
  type GeneratedMnemonic,
} from '@fsrs-japanese/shared-types'

// ─── Card list ────────────────────────────────────────────────────────────────

const EMPTY_PAGE: ApiList<ApiCardListItem> = { items: [], nextCursor: null, hasMore: false }

export async function listCardsAction(
  deckId:  string,
  options: { limit?: number; cursor?: string; status?: CardStatusFilter },
): Promise<ApiList<ApiCardListItem>> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined)                             params.set('cursor', options.cursor)
  if (options.status !== undefined && options.status !== 'all') params.set('status', options.status)

  return apiCallSafe<ApiList<ApiCardListItem>>(
    `/api/v1/decks/${deckId}/cards?${params.toString()}`,
    apiListEnvelope(ApiCardListItemSchema),
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

/** Save payload: the web only ever uses the manual (fieldsData) branch of
 *  CreateCardPayload, never the AI (word) branch — that flow goes through
 *  generateCardPreviewAction first. */
type ManualCreateCardPayload = Extract<CreateCardPayload, { fieldsData: unknown }>

export async function saveCardAction(deckId: string, payload: ManualCreateCardPayload): Promise<void> {
  const key = crypto.randomUUID()
  await apiCall<unknown>(
    `/api/v1/decks/${deckId}/cards`,
    voidResponseSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
      body:    JSON.stringify(payload),
    },
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

export async function getSimilarCardsAction(cardId: string): Promise<ApiList<ApiSimilarCard>> {
  return apiCallSafe<ApiList<ApiSimilarCard>>(
    `/api/v1/cards/${cardId}/similar`,
    apiListEnvelope(ApiSimilarCardSchema),
    {},
    { items: [], nextCursor: null, hasMore: false },
  )
}

export async function updateCardAction(
  cardId:  string,
  version: number,
  payload: UpdateCardPayload,
): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/cards/${cardId}`,
    voidResponseSchema,
    {
      method:  'PATCH',
      headers: { 'If-Match': String(version) },
      body:    JSON.stringify(payload),
    },
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
