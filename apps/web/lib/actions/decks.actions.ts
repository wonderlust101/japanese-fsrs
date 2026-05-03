'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

export interface DeckSummary {
  id:   string
  name: string
}

export interface DeckRow {
  id:              string
  name:            string
  description:     string | null
  deckType:        'vocabulary' | 'grammar' | 'kanji' | 'mixed'
  cardCount:       number
  isPremadeFork:   boolean
  sourcePremadeId: string | null
  createdAt:       string
  updatedAt:       string
}

export interface DeckStats {
  dueCount:  number
  newCount:  number
  cardCount: number
}

export async function listDecksAction(): Promise<DeckRow[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return []

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    },
  )

  if (!res.ok) return []

  return res.json() as Promise<DeckRow[]>
}

export async function getDeckStatsAction(deckId: string): Promise<DeckStats | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return null

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks/${deckId}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    },
  )

  if (!res.ok) return null

  const body = await res.json() as { dueCount: number; newCount: number; cardCount: number }
  return { dueCount: body.dueCount, newCount: body.newCount, cardCount: body.cardCount }
}

export interface CreateDeckPayload {
  name:        string
  description: string | undefined
  deck_type:   'vocabulary' | 'grammar' | 'kanji' | 'mixed'
}

export async function createDeckAction(payload: CreateDeckPayload): Promise<{ id: string; name: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        name:        payload.name,
        description: payload.description,
        deck_type:   payload.deck_type,
      }),
    },
  )

  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to create deck')
  }

  return res.json() as Promise<{ id: string; name: string }>
}

export async function getDeckAction(deckId: string): Promise<DeckSummary | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return null

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks/${deckId}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    },
  )

  if (!res.ok) return null

  const body = await res.json() as { id: string; name: string }
  return { id: body.id, name: body.name }
}
