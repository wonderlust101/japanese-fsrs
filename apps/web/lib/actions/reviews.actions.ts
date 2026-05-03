'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ReviewRating } from '@fsrs-japanese/shared-types'

/** Shape of a card as returned by the Express API (content in fieldsData). */
export interface DueCard {
  id:         string
  deckId:     string
  cardType:   string
  jlptLevel:  string | null
  status:     string
  due:        string
  state:      number
  fieldsData: Record<string, unknown>
}

export interface ForecastDay {
  date:  string
  count: number
}

export interface BatchResult {
  results: unknown[]
  errors:  Array<{ cardId: string; error: string }>
}

export async function getDueCardsAction(): Promise<DueCard[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/reviews/due`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to fetch due cards')
  }
  return res.json() as Promise<DueCard[]>
}

export async function submitReviewAction(
  cardId:       string,
  rating:       ReviewRating,
  reviewTimeMs?: number,
): Promise<{ card: DueCard }> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/reviews/submit`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ cardId, rating, reviewTimeMs }),
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to submit review')
  }
  return res.json() as Promise<{ card: DueCard }>
}

export async function submitBatchAction(
  reviews: Array<{ cardId: string; rating: ReviewRating; reviewTimeMs?: number }>,
): Promise<BatchResult> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/reviews/batch`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ reviews }),
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to submit batch')
  }
  return res.json() as Promise<BatchResult>
}

export async function getReviewForecastAction(): Promise<ForecastDay[]> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/api/v1/reviews/forecast`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to fetch forecast')
  }
  return res.json() as Promise<ForecastDay[]>
}
