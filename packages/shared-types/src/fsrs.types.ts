export const CardStatus = {
  New: 'new',
  Learning: 'learning',
  Review: 'review',
  Relearning: 'relearning',
  Suspended: 'suspended',
} as const
export type CardStatus = typeof CardStatus[keyof typeof CardStatus]

export const CardType = {
  Comprehension: 'comprehension',
  Production:    'production',
  Listening:     'listening',
} as const
export type CardType = typeof CardType[keyof typeof CardType]

/** Shared FSRS scheduling fields — present on both Card and GrammarPattern. */
export interface FsrsCardState {
  status: CardStatus
  due: Date
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  /** Tracks progress through (re)learning steps within the current phase. Must be persisted. */
  learningSteps: number
  reps: number
  lapses: number
  lastReview: Date | null
}
