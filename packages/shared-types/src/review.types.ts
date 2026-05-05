import type { ApiCard } from './api.types.ts'

export const ReviewRating = {
  Manual: 'manual', // forget / reschedule operations; never a user-facing rating
  Again:  'again',
  Hard:   'hard',
  Good:   'good',
  Easy:   'easy',
} as const
export type ReviewRating = typeof ReviewRating[keyof typeof ReviewRating]

export interface ReviewLog {
  id: string
  cardId: string
  userId: string
  rating: ReviewRating
  reviewTimeMs: number | null
  stabilityAfter: number
  difficultyAfter: number
  dueAfter: Date
  scheduledDaysAfter: number
  reviewedAt: Date
  // Before-snapshot — null on logs written before migration 20260502000001;
  // those logs are not eligible for rollback.
  stateBefore:         number | null
  stabilityBefore:     number | null
  difficultyBefore:    number | null
  dueBefore:           Date | null
  scheduledDaysBefore: number | null
  learningStepsBefore: number | null
  elapsedDaysBefore:   number | null
  lastReviewBefore:    Date | null
  repsBefore:          number | null
  lapsesBefore:        number | null
}

/** Entry in the Zustand session `completed` array after a card is rated. */
export interface ReviewResult {
  card: ApiCard
  rating: ReviewRating
}

export interface Leech {
  id: string
  cardId: string
  userId: string
  diagnosis: string
  prescription: string
  resolved: boolean
  resolvedAt: Date | null
  createdAt: Date
}

export interface SessionLeech {
  leechId:      string
  cardId:       string
  deckId:       string
  word:         string
  reading:      string | null
  diagnosis:    string | null
  prescription: string | null
  resolved:     boolean
  createdAt:    string
}

export interface SessionSummary {
  sessionId:   string
  totalCards:  number
  totalTimeMs: number
  accuracyPct: number
  nextDueAt:   string | null
  ratingBreakdown: {
    again: number
    hard:  number
    good:  number
    easy:  number
  }
  leeches: SessionLeech[]
}
