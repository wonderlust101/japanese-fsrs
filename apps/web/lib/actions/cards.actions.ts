'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'

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
