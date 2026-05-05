import type { CardType, FsrsCardState } from './fsrs.types.ts'

export const JLPTLevel = {
  N5: 'N5',
  N4: 'N4',
  N3: 'N3',
  N2: 'N2',
  N1: 'N1',
  BeyondJLPT: 'beyond_jlpt',
} as const
export type JLPTLevel = typeof JLPTLevel[keyof typeof JLPTLevel]

export interface ExampleSentence {
  ja: string
  en: string
  furigana: string
}

export interface KanjiBreakdown {
  kanji: string
  radical: string
  meaning: string
  reading: string
}

export interface Mnemonic {
  text: string
  author: 'ai' | 'user'
}

export type { CardType, FsrsCardState }
