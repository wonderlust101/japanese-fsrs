'use server'

import { apiCall, apiCallSafe } from '@/lib/api/client'
import type {
  ApiPremadeDeck,
  ApiPremadeSubscription,
  ApiSubscribeResult,
} from '@fsrs-japanese/shared-types'

export type PremadeDeckRow  = ApiPremadeDeck
export type SubscriptionRow = ApiPremadeSubscription
export type SubscribeResult = ApiSubscribeResult

export async function listPremadeDecksAction(): Promise<PremadeDeckRow[]> {
  return apiCallSafe<PremadeDeckRow[]>('/api/v1/premade-decks', {}, [])
}

export async function listMySubscriptionsAction(): Promise<SubscriptionRow[]> {
  return apiCallSafe<SubscriptionRow[]>('/api/v1/premade-decks/subscriptions/me', {}, [])
}

export async function subscribeToPremadeDeckAction(
  premadeDeckId: string,
): Promise<SubscribeResult> {
  return apiCall<SubscribeResult>(
    `/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    { method: 'POST' },
    'Failed to subscribe',
  )
}

export async function unsubscribeFromPremadeDeckAction(
  premadeDeckId: string,
): Promise<void> {
  await apiCall<unknown>(
    `/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    { method: 'DELETE' },
    'Failed to unsubscribe',
  )
}
