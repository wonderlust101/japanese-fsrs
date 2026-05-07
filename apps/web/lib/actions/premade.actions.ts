'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiPremadeDeckSchema,
  ApiPremadeSubscriptionSchema,
  ApiSubscribeResultSchema,
  apiListEnvelope,
  voidResponseSchema,
  type ApiList,
  type ApiPremadeDeck,
  type ApiPremadeSubscription,
  type ApiSubscribeResult,
} from '@fsrs-japanese/shared-types'

const EMPTY_PREMADE_PAGE: ApiList<ApiPremadeDeck>          = { items: [], nextCursor: null, hasMore: false }
const EMPTY_SUBS_PAGE:    ApiList<ApiPremadeSubscription> = { items: [], nextCursor: null, hasMore: false }

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

export async function listMySubscriptionsAction(): Promise<ApiList<ApiPremadeSubscription>> {
  return apiCallSafe<ApiList<ApiPremadeSubscription>>(
    '/api/v1/premade-decks/subscriptions/me',
    apiListEnvelope(ApiPremadeSubscriptionSchema),
    {},
    EMPTY_SUBS_PAGE,
  )
}

export async function subscribeToPremadeDeckAction(
  premadeDeckId: string,
): Promise<ApiSubscribeResult> {
  const key = crypto.randomUUID()
  return apiCall<ApiSubscribeResult>(
    `/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    ApiSubscribeResultSchema,
    {
      method:  'POST',
      headers: { 'Idempotency-Key': key },
    },
    'Failed to subscribe',
  )
}

export async function unsubscribeFromPremadeDeckAction(
  premadeDeckId: string,
): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    voidResponseSchema,
    { method: 'DELETE' },
    'Failed to unsubscribe',
  )
}
