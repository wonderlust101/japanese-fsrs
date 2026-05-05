/**
 * Wire-format types for the Express API (camelCase). These describe the JSON
 * shape that crosses the API → frontend boundary, derived from the API's
 * service-layer row types. Source of truth for HTTP response payloads.
 */

import type { CardType, State } from './fsrs.types.ts'
import type { JLPTLevel, LayoutType } from './card.types.ts'
import type { FieldsData } from './database.types.helpers.ts'

export interface ApiCard {
  id:             string
  /** Null for premade source rows that flow through this DTO. */
  userId:         string | null
  /** Null for premade source rows; XOR with premadeDeckId. */
  deckId:         string | null
  premadeDeckId:  string | null
  layoutType:     LayoutType
  fieldsData:     FieldsData
  cardType:       CardType
  parentCardId:   string | null
  tags:           string[]
  jlptLevel:      JLPTLevel | null
  state:          State
  isSuspended:    boolean
  due:            string
  stability:      number
  difficulty:     number
  elapsedDays:    number
  scheduledDays:  number
  /** ts-fsrs v5+ progress through (re)learning steps within the current phase. */
  learningSteps:  number
  reps:           number
  lapses:         number
  lastReview:     string | null
  createdAt:      string
  updatedAt:      string
}

/** Subset of ApiCard returned by /reviews/due — content-only fields the UI needs.
 *  Due cards are by definition not suspended, so isSuspended is omitted. */
export type ApiDueCard = Pick<
  ApiCard,
  'id' | 'deckId' | 'cardType' | 'jlptLevel' | 'state' | 'due' | 'fieldsData'
>

/** Subset of ApiCard returned by /decks/:id/cards (card list). */
export type ApiCardListItem = Pick<
  ApiCard,
  'id' | 'fieldsData' | 'layoutType' | 'cardType' | 'jlptLevel' | 'state' | 'isSuspended' | 'due' | 'tags'
>

export interface ApiDeck {
  id:              string
  name:            string
  description:     string | null
  deckType:        'vocabulary' | 'grammar' | 'kanji' | 'mixed'
  cardCount:       number
  isPremadeFork:   boolean
  sourcePremadeId: string | null
  createdAt:       string
  updatedAt:       string
}

export interface ApiDeckWithStats extends ApiDeck {
  dueCount: number
  newCount: number
}

export interface ApiPremadeDeck {
  id:          string
  name:        string
  description: string | null
  deckType:    'vocabulary' | 'grammar' | 'kanji' | 'mixed'
  jlptLevel:   string | null
  domain:      string | null
  cardCount:   number
  version:     number
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface ApiPremadeSubscription {
  id:              string
  premadeDeckId:   string
  premadeDeckName: string
  deckId:          string
  cardCount:       number
  subscribedAt:    string
}

export interface ApiSubscribeResult {
  subscriptionId: string
  deckId:         string
  cardCount:      number
  alreadyExisted: boolean
}

export interface ApiForecastDay {
  date:  string
  count: number
}

export interface ApiBatchResult {
  results: unknown[]
  errors:  Array<{ cardId: string; error: string }>
}

/**
 * Wire-format result from /api/v1/cards/:id/similar (find_similar_cards RPC).
 * Mirrors the 8 columns the RPC actually returns — distinct from ApiCard,
 * which would imply 21 columns and was previously the (incorrect) declared
 * return type.
 */
export interface ApiSimilarCard {
  id:         string
  deckId:     string
  layoutType: LayoutType
  cardType:   CardType
  fieldsData: FieldsData
  tags:       string[]
  jlptLevel:  JLPTLevel | null
  similarity: number
}
