import type { JLPTLevel } from './card.types.ts'

export const DeckType = {
  Vocabulary: 'vocabulary',
  Grammar: 'grammar',
  Kanji: 'kanji',
  Mixed: 'mixed',
} as const
export type DeckType = typeof DeckType[keyof typeof DeckType]

const DECK_TYPE_VALUES = Object.values(DeckType) as readonly string[]
export const isDeckType = (v: unknown): v is DeckType =>
  typeof v === 'string' && DECK_TYPE_VALUES.includes(v)

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
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
}

export interface UserPremadeSubscription {
  id: string
  userId: string
  premadeDeckId: string
  subscribedAt: string
  lastSeenVersion: number
}
