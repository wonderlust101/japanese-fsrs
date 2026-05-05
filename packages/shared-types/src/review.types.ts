export const ReviewRating = {
  Manual: 'manual', // forget / reschedule operations; never a user-facing rating
  Again:  'again',
  Hard:   'hard',
  Good:   'good',
  Easy:   'easy',
} as const
export type ReviewRating = typeof ReviewRating[keyof typeof ReviewRating]

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
