'use server'

import { apiCall, apiCallSafe, ApiHttpError } from '@/lib/api/client'
import { z } from 'zod'
import {
  ApiCardSchema,
  ApiCardListItemSchema,
  ApiCrossDeckCardListItemSchema,
  ApiBulkCardMutationResultSchema,
  ApiReviewedCardSchema,
  GeneratedCardDataSchema,
  GeneratedSentencesSchema,
  GeneratedMnemonicSchema,
  apiListEnvelope,
  voidResponseSchema,
  type ApiBulkCardMutationResult,
  type ApiCard,
  type ApiCardListItem,
  type ApiCrossDeckCardListItem,
  type ApiList,
  type ApiReviewedCard,
  type CardMissingField,
  type CardPresentField,
  type PitchPattern,
  type CardSortField,
  type CardStatusFilter,
  type CreateCardPayload,
  type CrossDeckJlptFilter,
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

/**
 * Saves a manually-edited card to the user's deck. Returns the freshly-
 * inserted `ApiCard` so callers can capture `id` and (for the /add/review
 * iteration flow) switch follow-up regenerations to the cheaper dedicated
 * endpoints (`generateSentencesAction`, `generateMnemonicAction`) which
 * are cardId-keyed.
 *
 * Idempotency: a fresh `Idempotency-Key` is generated per call. A network
 * retry replays the original 201; a deliberate "create the same card
 * again" is a separate user gesture that produces a new key, so the
 * action layer doesn't try to dedupe across submissions.
 */
export async function saveCardAction(
  deckId:  string,
  payload: ManualCreateCardPayload,
): Promise<ApiCard> {
  const key = crypto.randomUUID()
  return apiCall<ApiCard>(
    `/api/v1/decks/${deckId}/cards`,
    ApiCardSchema,
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

/**
 * Fetches a card via the flat `/api/v1/cards/:id` mount. The deck-scoped
 * mount validates that the card belongs to a specific deck; the flat mount
 * simply checks user ownership. Use this from `/cards/[cardId]` routes where
 * the deck id isn't known up front.
 */
export async function getCardByIdAction(cardId: string): Promise<ApiCard | null> {
  return apiCallSafe<ApiCard | null>(
    `/api/v1/cards/${cardId}`,
    ApiCardSchema.nullable(),
    {},
    null,
  )
}

/**
 * Result type for `updateCardAction`. The 412 If-Match conflict is a *normal*
 * outcome of optimistic concurrency — not an exceptional one — so it surfaces
 * as a discriminated result rather than a thrown error. This crosses the
 * Server-Action boundary cleanly (Next.js can't carry a typed error class
 * from server to client). All other failures still throw via `apiCall`.
 */
export type UpdateCardResult =
  | { ok: true;  card: ApiCard }
  | { ok: false; conflict: true }

export async function updateCardAction(
  cardId:  string,
  version: number,
  payload: UpdateCardPayload,
): Promise<UpdateCardResult> {
  try {
    const card = await apiCall<ApiCard>(
      `/api/v1/cards/${cardId}`,
      ApiCardSchema,
      {
        method:  'PATCH',
        headers: { 'If-Match': String(version) },
        body:    JSON.stringify(payload),
      },
      'Failed to update card',
    )
    return { ok: true, card }
  } catch (err: unknown) {
    if (err instanceof ApiHttpError && err.status === 412) {
      return { ok: false, conflict: true }
    }
    throw err
  }
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

/**
 * Move a card to another deck. Siblings in other decks stay put — only the
 * targeted row's deck_id changes. Backed by `POST /api/v1/cards/:id/move`,
 * which atomically adjusts both decks' card_count.
 */
export async function moveCardAction(cardId: string, targetDeckId: string): Promise<ApiCard> {
  return apiCall<ApiCard>(
    `/api/v1/cards/${cardId}/move`,
    ApiCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ deckId: targetDeckId }),
    },
    'Failed to move card',
  )
}

// ─── Cross-deck list + browser mutations ──────────────────────────────────────

/** Query params for the cross-deck list. Mirrors the backend Zod schema. */
export interface CrossDeckCardsActionOptions {
  limit?:        number
  cursor?:       string
  search?:       string
  deckId?:       string
  jlptLevel?:    CrossDeckJlptFilter
  status?:       CardStatusFilter
  missingField?: CardMissingField
  presentField?: CardPresentField
  pitchPattern?: PitchPattern
  sort?:         CardSortField
}

const EMPTY_CROSS_DECK_PAGE: ApiList<ApiCrossDeckCardListItem> & { totalCount: number } = {
  items: [], nextCursor: null, hasMore: false, totalCount: 0,
}

const CrossDeckListResultSchema = z.object({
  items:      z.array(ApiCrossDeckCardListItemSchema),
  nextCursor: z.string().nullable(),
  hasMore:    z.boolean(),
  totalCount: z.number().int().nonnegative(),
})

export type CrossDeckListResult = z.infer<typeof CrossDeckListResultSchema>

export async function listCardsCrossDeckAction(
  options: CrossDeckCardsActionOptions = {},
): Promise<CrossDeckListResult> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 25))
  if (options.cursor       !== undefined)                                       params.set('cursor',       options.cursor)
  if (options.search       !== undefined && options.search.length > 0)          params.set('search',       options.search)
  if (options.deckId       !== undefined)                                       params.set('deckId',       options.deckId)
  if (options.jlptLevel    !== undefined && options.jlptLevel    !== 'all')     params.set('jlptLevel',    options.jlptLevel)
  if (options.status       !== undefined && options.status       !== 'all')     params.set('status',       options.status)
  if (options.missingField !== undefined)                                       params.set('missingField', options.missingField)
  if (options.presentField !== undefined)                                       params.set('presentField', options.presentField)
  if (options.pitchPattern !== undefined)                                       params.set('pitchPattern', options.pitchPattern)
  if (options.sort         !== undefined)                                       params.set('sort',         options.sort)

  return apiCallSafe<CrossDeckListResult>(
    `/api/v1/cards/cross-deck?${params.toString()}`,
    CrossDeckListResultSchema,
    {},
    EMPTY_CROSS_DECK_PAGE,
  )
}

/** Clone the card into another deck with fresh FSRS state. Returns the new card. */
export async function copyCardAction(cardId: string, targetDeckId: string): Promise<ApiCard> {
  return apiCall<ApiCard>(
    `/api/v1/cards/${cardId}/copy`,
    ApiCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ deckId: targetDeckId }),
    },
    'Failed to copy card',
  )
}

export async function suspendCardAction(cardId: string): Promise<ApiCard> {
  return apiCall<ApiCard>(
    `/api/v1/cards/${cardId}/suspend`,
    ApiCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({}),
    },
    'Failed to suspend card',
  )
}

/**
 * Reset FSRS scheduling on a card and re-queue it as new.
 *
 * `resetCount=true` also zeroes lifetime reps + lapses; the default
 * preserves those for the user's analytics history. Backed by
 * `POST /api/v1/cards/:id/forget`, which writes a manual review log so
 * the forget itself can be rolled back if needed.
 */
export async function forgetCardAction(
  cardId:  string,
  options: { resetCount?: boolean } = {},
): Promise<ApiReviewedCard> {
  const body: Record<string, unknown> = {}
  if (options.resetCount === true) body['resetCount'] = true
  return apiCall<ApiReviewedCard>(
    `/api/v1/cards/${cardId}/forget`,
    ApiReviewedCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify(body),
    },
    'Failed to forget card',
  )
}

/**
 * Replay the card's full review history and recompute its FSRS state
 * from scratch. Useful after a long absence or after FSRS weights
 * change. Backed by `POST /api/v1/cards/:id/reschedule`; the original
 * review log entries are preserved.
 */
export async function rescheduleCardAction(cardId: string): Promise<ApiReviewedCard> {
  return apiCall<ApiReviewedCard>(
    `/api/v1/cards/${cardId}/reschedule`,
    ApiReviewedCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({}),
    },
    'Failed to reschedule card',
  )
}

export async function unsuspendCardAction(cardId: string): Promise<ApiCard> {
  return apiCall<ApiCard>(
    `/api/v1/cards/${cardId}/unsuspend`,
    ApiCardSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({}),
    },
    'Failed to unsuspend card',
  )
}

// ─── Bulk mutations ──────────────────────────────────────────────────────────

export async function bulkMoveCardsAction(
  ids: readonly string[],
  targetDeckId: string,
): Promise<ApiBulkCardMutationResult> {
  return apiCall<ApiBulkCardMutationResult>(
    '/api/v1/cards/bulk/move',
    ApiBulkCardMutationResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ ids, deckId: targetDeckId }),
    },
    'Failed to move cards',
  )
}

export async function bulkSuspendCardsAction(
  ids: readonly string[],
): Promise<ApiBulkCardMutationResult> {
  return apiCall<ApiBulkCardMutationResult>(
    '/api/v1/cards/bulk/suspend',
    ApiBulkCardMutationResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ ids }),
    },
    'Failed to suspend cards',
  )
}

export async function bulkUnsuspendCardsAction(
  ids: readonly string[],
): Promise<ApiBulkCardMutationResult> {
  return apiCall<ApiBulkCardMutationResult>(
    '/api/v1/cards/bulk/unsuspend',
    ApiBulkCardMutationResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ ids }),
    },
    'Failed to unsuspend cards',
  )
}

export async function bulkDeleteCardsAction(
  ids: readonly string[],
): Promise<ApiBulkCardMutationResult> {
  return apiCall<ApiBulkCardMutationResult>(
    '/api/v1/cards/bulk/delete',
    ApiBulkCardMutationResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify({ ids }),
    },
    'Failed to delete cards',
  )
}

export async function bulkTagCardsAction(
  ids: readonly string[],
  options: { addTags?: readonly string[]; removeTags?: readonly string[] },
): Promise<ApiBulkCardMutationResult> {
  const body: Record<string, unknown> = { ids }
  if (options.addTags    !== undefined && options.addTags.length > 0)    body['addTags']    = options.addTags
  if (options.removeTags !== undefined && options.removeTags.length > 0) body['removeTags'] = options.removeTags

  return apiCall<ApiBulkCardMutationResult>(
    '/api/v1/cards/bulk/tag',
    ApiBulkCardMutationResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': crypto.randomUUID() },
      body:    JSON.stringify(body),
    },
    'Failed to tag cards',
  )
}
