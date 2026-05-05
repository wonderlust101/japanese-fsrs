export { State } from 'ts-fsrs'
import type { State } from 'ts-fsrs'

export const CardType = {
  Comprehension: 'comprehension',
  Production:    'production',
  Listening:     'listening',
} as const
export type CardType = typeof CardType[keyof typeof CardType]

/** Shared FSRS scheduling fields used by GrammarPattern (wire format).
 *  `state` is the ts-fsrs integer enum (0=New, 1=Learning, 2=Review, 3=Relearning).
 *  Dates are ISO 8601 strings — the algorithm-internal Date objects live in
 *  the API service layer and are serialised before crossing the wire. */
export interface FsrsCardState {
  state: State
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  /** Tracks progress through (re)learning steps within the current phase. Must be persisted. */
  learningSteps: number
  reps: number
  lapses: number
  lastReview: string | null
}
