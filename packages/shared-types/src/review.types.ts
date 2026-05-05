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
  /** Nullable since migration 20260504000004 (C2: ON DELETE SET NULL on cards). */
  cardId: string | null
  userId: string
  rating: ReviewRating
  reviewTimeMs: number | null
  stabilityAfter: number
  difficultyAfter: number
  dueAfter: string
  scheduledDaysAfter: number
  reviewedAt: string
  /** Groups review logs in a single review session; null on legacy rows. */
  sessionId: string | null
  // Before-snapshot — null on logs written before migration 20260502000001;
  // those logs are not eligible for rollback.
  stateBefore:         number | null
  stabilityBefore:     number | null
  difficultyBefore:    number | null
  dueBefore:           string | null
  scheduledDaysBefore: number | null
  learningStepsBefore: number | null
  elapsedDaysBefore:   number | null
  lastReviewBefore:    string | null
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
  /** Filled by ai.service.ts after detection; null until the AI call lands. */
  diagnosis: string | null
  /** Filled by ai.service.ts after detection; null until the AI call lands. */
  prescription: string | null
  resolved: boolean
  resolvedAt: string | null
  createdAt: string
  /** Set when the leech was created during a review session; null for legacy rows. */
  sessionId: string | null
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
