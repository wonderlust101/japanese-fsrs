'use server'

import { z } from 'zod'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import {
  ApiPremadeDeckSchema,
  ApiPremadeSubscriptionSchema,
  ApiSubscribeResultSchema,
  voidResponseSchema,
  type ApiPremadeDeck,
  type ApiPremadeSubscription,
  type ApiSubscribeResult,
} from '@fsrs-japanese/shared-types'

export async function listPremadeDecksAction(): Promise<ApiPremadeDeck[]> {
  return apiCallSafe<ApiPremadeDeck[]>('/api/v1/premade-decks', z.array(ApiPremadeDeckSchema), {}, [])
}

export async function listMySubscriptionsAction(): Promise<ApiPremadeSubscription[]> {
  return apiCallSafe<ApiPremadeSubscription[]>(
    '/api/v1/premade-decks/subscriptions/me',
    z.array(ApiPremadeSubscriptionSchema),
    {},
    [],
  )
}

export async function subscribeToPremadeDeckAction(
  premadeDeckId: string,
): Promise<ApiSubscribeResult> {
  return apiCall<ApiSubscribeResult>(
    `/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    ApiSubscribeResultSchema,
    { method: 'POST' },
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
