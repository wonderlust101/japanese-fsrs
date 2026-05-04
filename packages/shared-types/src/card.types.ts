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

export const RegisterTag = {
  Casual: 'casual',
  Formal: 'formal',
  Written: 'written',
  Archaic: 'archaic',
  Slang: 'slang',
  Gendered: 'gendered',
  Neutral: 'neutral',
} as const
export type RegisterTag = typeof RegisterTag[keyof typeof RegisterTag]

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

export interface Card extends FsrsCardState {
  id: string
  deckId: string
  /** NULL for premade deck source cards; personal copies always have a userId. */
  userId: string | null

  word: string
  reading: string | null
  meaning: string
  partOfSpeech: string | null

  jlptLevel: JLPTLevel
  frequencyRank: number | null
  register: RegisterTag

  exampleSentences: ExampleSentence[]
  kanjiBreakdown: KanjiBreakdown[]
  pitchAccent: string | null
  mnemonics: Mnemonic[]
  collocations: string[]
  homophones: string[]
  tags: string[]

  cardType: CardType
  parentCardId: string | null

  /**
   * Whether this card is suspended (excluded from review queues).
   * Orthogonal to FSRS `state` — a card in any state can be suspended.
   */
  isSuspended: boolean

  /**
   * URL to the cached audio file (Supabase Storage or CDN).
   * NULL until audio is generated or sourced; the API generates TTS on demand
   * and backfills this field once the file is stored (PRD AUD-01).
   */
  audioUrl: string | null

  /** 1536-dimension vector for pgvector cosine similarity search. */
  embedding: number[] | null

  createdAt: Date
  updatedAt: Date
}

export type { CardType, FsrsCardState }
