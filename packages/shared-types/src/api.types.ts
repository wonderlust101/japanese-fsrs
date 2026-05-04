/**
 * Wire-format types for the Express API (camelCase). These describe the JSON
 * shape that crosses the API → frontend boundary, derived from the API's
 * service-layer row types.
 *
 * Distinct from the richer `Card` / `Deck` types in card.types.ts and
 * deck.types.ts, which model the idealised domain. API types are the source
 * of truth for what HTTP responses actually contain today.
 */

export interface ApiCard {
  id:            string
  userId:        string
  deckId:        string
  layoutType:    string
  fieldsData:    Record<string, unknown>
  cardType:      string
  parentCardId:  string | null
  tags:          string[] | null
  jlptLevel:     string | null
  status:        string
  due:           string
  stability:     number
  difficulty:    number
  elapsedDays:   number
  scheduledDays: number
  reps:          number
  lapses:        number
  lastReview:    string | null
  createdAt:     string
  updatedAt:     string
}

/** Subset of ApiCard returned by /reviews/due — content-only fields the UI needs. */
export type ApiDueCard = Pick<
  ApiCard,
  'id' | 'deckId' | 'cardType' | 'jlptLevel' | 'status' | 'due' | 'fieldsData'
>

/** Subset of ApiCard returned by /decks/:id/cards (card list). */
export type ApiCardListItem = Pick<
  ApiCard,
  'id' | 'fieldsData' | 'layoutType' | 'cardType' | 'jlptLevel' | 'status' | 'due' | 'tags'
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
