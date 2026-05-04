'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface PremadeDeckRow {
  id:          string
  name:        string
  description: string | null
  deckType:    'vocabulary' | 'grammar' | 'kanji' | 'mixed'
  jlptLevel:   string | null
  domain:      string | null
  cardCount:   number
  version:     number
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface SubscriptionRow {
  id:              string
  premadeDeckId:   string
  premadeDeckName: string
  deckId:          string
  cardCount:       number
  subscribedAt:    string
}

export interface SubscribeResult {
  subscriptionId: string
  deckId:         string
  cardCount:      number
  alreadyExisted: boolean
}

async function bearer(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export async function listPremadeDecksAction(): Promise<PremadeDeckRow[]> {
  const token = await bearer()
  if (token === null) return []

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/premade-decks`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  return res.json() as Promise<PremadeDeckRow[]>
}

export async function listMySubscriptionsAction(): Promise<SubscriptionRow[]> {
  const token = await bearer()
  if (token === null) return []

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/premade-decks/subscriptions/me`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  return res.json() as Promise<SubscriptionRow[]>
}

export async function subscribeToPremadeDeckAction(
  premadeDeckId: string,
): Promise<SubscribeResult> {
  const token = await bearer()
  if (token === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to subscribe')
  }

  return res.json() as Promise<SubscribeResult>
}

export async function unsubscribeFromPremadeDeckAction(
  premadeDeckId: string,
): Promise<void> {
  const token = await bearer()
  if (token === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/premade-decks/${premadeDeckId}/subscribe`,
    {
      method:  'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to unsubscribe')
  }
}
