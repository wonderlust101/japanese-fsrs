export const CardStatus = {
  New: 'new',
  Learning: 'learning',
  Review: 'review',
  Relearning: 'relearning',
  Suspended: 'suspended',
} as const
export type CardStatus = typeof CardStatus[keyof typeof CardStatus]

export const CardType = {
  Recognition: 'recognition',
  Production: 'production',
  Reading: 'reading',
  Audio: 'audio',
  Grammar: 'grammar',
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
  reps: number
  lapses: number
  lastReview: Date | null
  /** FSRS internal state integer: 0=New 1=Learning 2=Review 3=Relearning */
  state: number
}
