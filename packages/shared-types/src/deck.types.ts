import type { JLPTLevel } from './card.types.ts'

export const DeckType = {
  Vocabulary: 'vocabulary',
  Grammar: 'grammar',
  Kanji: 'kanji',
  Mixed: 'mixed',
} as const
export type DeckType = typeof DeckType[keyof typeof DeckType]

export interface Deck {
  id: string
  userId: string
  name: string
  description: string | null
  deckType: DeckType
  isPublic: boolean
  isPremadeFork: boolean
  sourcePremadeId: string | null
  cardCount: number
  createdAt: Date
  updatedAt: Date
}

export interface PremadeDeck {
  id: string
  name: string
  description: string | null
  deckType: DeckType
  /** NULL for multi-level or domain decks. */
  jlptLevel: JLPTLevel | null
  /** e.g. 'business', 'anime', 'travel'. NULL for JLPT-keyed decks. */
  domain: string | null
  cardCount: number
  version: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UserPremadeSubscription {
  id: string
  userId: string
  premadeDeckId: string
  subscribedAt: Date
  lastSeenVersion: number
}
