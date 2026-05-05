/**
 * Wire-format types for the Express API (camelCase). These describe the JSON
 * shape that crosses the API → frontend boundary, derived from the API's
 * service-layer row types. Source of truth for HTTP response payloads.
 */

import type { CardType, State } from './fsrs.types.ts'
import type { JLPTLevel, LayoutType } from './card.types.ts'
import type { FieldsData } from './field-shapes.ts'

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

// ─── Analytics wire formats ───────────────────────────────────────────────────

/** Single day in the retention heatmap. Days with zero reviews are omitted. */
export interface ApiHeatmapDay {
  date:      string  // YYYY-MM-DD (UTC)
  retention: number  // 0–100, one decimal place
  count:     number  // total reviews that day
}

/** Per-layout (cognitive modality) accuracy rollup. */
export interface ApiLayoutAccuracy {
  layout:      string  // comprehension | production | listening
  total:       number
  successful:  number  // good + easy ratings
  accuracyPct: number  // 0–100, one decimal place
}

/** Current and longest streak plus the last review date (UTC calendar days). */
export interface ApiStreakStats {
  currentStreak:   number
  longestStreak:   number
  lastReviewDate:  string | null  // YYYY-MM-DD or null if no reviews
}

/** Per-JLPT-level total/learned/due counts with progress percentage. */
export interface ApiJlptGap {
  jlptLevel:    string
  total:        number
  learned:      number
  due:          number
  progressPct:  number  // 0–100, one decimal place
}

/** Per-JLPT-level milestone projection from the user's 30-day pace. */
export interface ApiMilestoneForecast {
  jlptLevel:                 string
  total:                     number
  learned:                   number
  dailyPace:                 number
  daysRemaining:             number | null
  projectedCompletionDate:   string | null  // YYYY-MM-DD or null if no projection
}

// ─── Review submit wire format ────────────────────────────────────────────────

/**
 * Response of POST /api/v1/reviews/submit. The card payload is a strict subset
 * of ApiCard — only the fields the client needs to update its local state
 * after a review.
 */
export interface ApiReviewSubmitResponse {
  card: {
    id:            string
    due:           string  // ISO 8601
    stability:     number
    difficulty:    number
    scheduledDays: number
    state:         State
  }
}
