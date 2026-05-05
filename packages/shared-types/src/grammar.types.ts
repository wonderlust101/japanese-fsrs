import type { FsrsCardState } from './fsrs.types.ts'
import type { ExampleSentence, JLPTLevel } from './card.types.ts'

export interface GrammarPattern extends FsrsCardState {
  id: string
  userId: string
  deckId: string
  pattern: string
  meaning: string
  /** Nullable in the schema; `null` for patterns not pinned to a JLPT level. */
  jlptLevel: JLPTLevel | null
  exampleSentences: ExampleSentence[]
  notes: string | null
  /**
   * Whether this pattern is suspended (excluded from review queues).
   * Orthogonal to FSRS `state` — a pattern in any state can be suspended.
   */
  isSuspended: boolean
  createdAt: string
  updatedAt: string
}
