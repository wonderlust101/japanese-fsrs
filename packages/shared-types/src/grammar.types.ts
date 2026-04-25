import type { FsrsCardState } from './fsrs.types.ts'
import type { ExampleSentence, JLPTLevel } from './card.types.ts'

export interface GrammarPattern extends FsrsCardState {
  id: string
  userId: string
  deckId: string
  pattern: string
  meaning: string
  jlptLevel: JLPTLevel
  exampleSentences: ExampleSentence[]
  linkedVocabulary: string[]
  notes: string | null
  createdAt: Date
  updatedAt: Date
}
