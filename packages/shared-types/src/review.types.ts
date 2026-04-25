import type { Card } from './card.types.ts'

export const ReviewRating = {
  Again: 'again',
  Hard: 'hard',
  Good: 'good',
  Easy: 'easy',
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
}

/** Entry in the Zustand session `completed` array after a card is rated. */
export interface ReviewResult {
  card: Card
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
