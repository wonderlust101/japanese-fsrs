'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

// ─── Card list types ──────────────────────────────────────────────────────────

export interface CardItem {
  id:          string
  fieldsData:  Record<string, unknown>
  layoutType:  string
  cardType:    string
  jlptLevel:   string | null
  status:      string
  state:       number
  due:         string
  tags:        string[] | null
}

export interface CardListPage {
  items:      CardItem[]
  nextCursor: string | null
  hasMore:    boolean
}

export async function listCardsAction(
  deckId:  string,
  options: { limit?: number; cursor?: string; status?: string },
): Promise<CardListPage> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return { items: [], nextCursor: null, hasMore: false }

  const params = new URLSearchParams()
  params.set('limit', String(options.limit ?? 50))
  if (options.cursor !== undefined)                           params.set('cursor', options.cursor)
  if (options.status !== undefined && options.status !== 'all') params.set('status', options.status)

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks/${deckId}/cards?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    },
  )

  if (!res.ok) return { items: [], nextCursor: null, hasMore: false }

  const body = await res.json() as {
    items: Array<{
      id: string; fieldsData: Record<string, unknown>; layoutType: string
      cardType: string; jlptLevel: string | null; status: string
      state: number; due: string; tags: string[] | null
    }>
    nextCursor: string | null
    hasMore: boolean
  }

  return {
    items:      body.items,
    nextCursor: body.nextCursor,
    hasMore:    body.hasMore,
  }
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
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/ai/generate-card`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ word }),
    },
  )

  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to generate card')
  }

  return res.json() as Promise<GeneratedCardData>
}

export async function saveCardAction(deckId: string, payload: SaveCardPayload): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks/${deckId}/cards`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        fields_data: payload.fields_data,
        layout_type: payload.layout_type ?? 'vocabulary',
        card_type:   payload.card_type   ?? 'comprehension',
        jlpt_level:  payload.jlpt_level,
        tags:        payload.tags,
      }),
    },
  )

  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to save card')
  }
}
