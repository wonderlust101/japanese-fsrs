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

// ─── Card detail types ────────────────────────────────────────────────────────

export interface CardDetail {
  id:            string
  deckId:        string
  layoutType:    string
  cardType:      string
  fieldsData:    Record<string, unknown>
  jlptLevel:     string | null
  tags:          string[] | null
  status:        string
  state:         number
  due:           string
  stability:     number
  difficulty:    number
  elapsedDays:   number
  scheduledDays: number
  reps:          number
  lapses:        number
  lastReview:    string | null
  createdAt:     string
  updatedAt:     string
}

export async function getCardAction(deckId: string, cardId: string): Promise<CardDetail | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return null

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/decks/${deckId}/cards/${cardId}`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
  )
  if (!res.ok) return null
  return res.json() as Promise<CardDetail>
}

export async function getSimilarCardsAction(cardId: string): Promise<CardItem[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return []

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/cards/${cardId}/similar`,
    { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  return res.json() as Promise<CardItem[]>
}

// ─── Card edit / delete actions ───────────────────────────────────────────────

export interface UpdateCardPayload {
  fields_data?: Record<string, unknown>
  jlpt_level?:  string | null
  tags?:        string[]
}

export async function updateCardAction(cardId: string, payload: UpdateCardPayload): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/cards/${cardId}`,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body:    JSON.stringify(payload),
    },
  )
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to update card')
  }
}

export interface RegeneratedSentences {
  sentences: { ja: string; en: string; furigana: string }[]
}

export async function generateSentencesAction(
  cardId: string,
  count?: number,
): Promise<RegeneratedSentences> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/ai/generate-sentences`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(count !== undefined ? { cardId, count } : { cardId }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to regenerate sentences')
  }
  return res.json() as Promise<RegeneratedSentences>
}

export interface RegeneratedMnemonic {
  mnemonic: string
}

export async function generateMnemonicAction(cardId: string): Promise<RegeneratedMnemonic> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/ai/generate-mnemonic`,
    {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ cardId }),
    },
  )
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? 'Failed to regenerate mnemonic')
  }
  return res.json() as Promise<RegeneratedMnemonic>
}

export async function deleteCardAction(cardId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/cards/${cardId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${session.access_token}` } },
  )
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to delete card')
  }
}
