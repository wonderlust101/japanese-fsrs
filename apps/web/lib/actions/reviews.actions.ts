'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ReviewRating, SessionSummary } from '@fsrs-japanese/shared-types'

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

// ─── Internal helper ──────────────────────────────────────────────────────────

async function apiCall<T>(
  path:        string,
  init:        RequestInit | undefined,
  errorPrefix: string,
): Promise<T> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const headers = new Headers(init?.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json')

  const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}${path}`, { ...init, headers })
  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? errorPrefix)
  }
  return res.json() as Promise<T>
}

// ─── Server actions ───────────────────────────────────────────────────────────

export async function getDueCardsAction(): Promise<DueCard[]> {
  return apiCall<DueCard[]>('/api/v1/reviews/due', undefined, 'Failed to fetch due cards')
}

export async function submitReviewAction(
  cardId:        string,
  rating:        ReviewRating,
  reviewTimeMs?: number,
  sessionId?:    string,
): Promise<{ card: DueCard }> {
  return apiCall<{ card: DueCard }>(
    '/api/v1/reviews/submit',
    { method: 'POST', body: JSON.stringify({ cardId, rating, reviewTimeMs, sessionId }) },
    'Failed to submit review',
  )
}

export async function getSessionSummaryAction(
  sessionId: string,
): Promise<SessionSummary> {
  return apiCall<SessionSummary>(
    `/api/v1/reviews/session-summary/${encodeURIComponent(sessionId)}`,
    undefined,
    'Failed to fetch session summary',
  )
}

export async function submitBatchAction(
  reviews: Array<{ cardId: string; rating: ReviewRating; reviewTimeMs?: number }>,
): Promise<BatchResult> {
  return apiCall<BatchResult>(
    '/api/v1/reviews/batch',
    { method: 'POST', body: JSON.stringify({ reviews }) },
    'Failed to submit batch',
  )
}

export async function getReviewForecastAction(): Promise<ForecastDay[]> {
  return apiCall<ForecastDay[]>('/api/v1/reviews/forecast', undefined, 'Failed to fetch forecast')
}
