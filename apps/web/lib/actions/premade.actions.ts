'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiPremadeDeckSchema,
  ApiCopyPremadeDeckResultSchema,
  apiListEnvelope,
  type ApiList,
  type ApiPremadeDeck,
  type ApiCopyPremadeDeckResult,
} from '@fsrs-japanese/shared-types'

const EMPTY_PREMADE_PAGE: ApiList<ApiPremadeDeck> = { items: [], nextCursor: null, hasMore: false }

export async function listPremadeDecksAction(
  options: { limit?: number; cursor?: string } = {},
): Promise<ApiList<ApiPremadeDeck>> {
  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined) params.set('cursor', options.cursor)

  return apiCallSafe<ApiList<ApiPremadeDeck>>(
    `/api/v1/premade-decks?${params.toString()}`,
    apiListEnvelope(ApiPremadeDeckSchema),
    {},
    EMPTY_PREMADE_PAGE,
  )
}

/**
 * Backend Completion Plan Stage 4 (copy model). Replaces the prior
 * `subscribeToPremadeDeckAction` and `unsubscribeFromPremadeDeckAction`
 * actions and the `listMySubscriptionsAction` reader.
 *
 * Duplicates are allowed by design — a fresh `Idempotency-Key` per click
 * is generated here so a deliberate "copy again" produces a new deck. To
 * coalesce double-clicks, callers should debounce the mutation at the UI
 * layer rather than reusing keys.
 */
export async function copyPremadeDeckAction(
  premadeDeckId: string,
): Promise<ApiCopyPremadeDeckResult> {
  const key = crypto.randomUUID()
  return apiCall<ApiCopyPremadeDeckResult>(
    `/api/v1/premade-decks/${premadeDeckId}/copy`,
    ApiCopyPremadeDeckResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
    },
    'Failed to copy premade deck',
  )
}
