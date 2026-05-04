export { State } from 'ts-fsrs'
import type { State } from 'ts-fsrs'

export const CardType = {
  Comprehension: 'comprehension',
  Production:    'production',
  Listening:     'listening',
} as const
export type CardType = typeof CardType[keyof typeof CardType]

/** Shared FSRS scheduling fields — present on both Card and GrammarPattern.
 *  `state` is the ts-fsrs integer enum (0=New, 1=Learning, 2=Review, 3=Relearning).
 *  Suspension is orthogonal to FSRS state and lives on the higher-level Card type. */
export interface FsrsCardState {
  state: State
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
