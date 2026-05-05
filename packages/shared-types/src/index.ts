export { State, CardType } from './fsrs.types.ts'
export type { FsrsCardState } from './fsrs.types.ts'

export { JLPTLevel, LayoutType } from './card.types.ts'
export type { ExampleSentence, KanjiBreakdown, Mnemonic } from './card.types.ts'

export { DeckType } from './deck.types.ts'
export type { Deck, PremadeDeck, UserPremadeSubscription } from './deck.types.ts'

export { ReviewRating } from './review.types.ts'
export type { SessionLeech, SessionSummary } from './review.types.ts'

export type { Profile, UpdateProfileInput } from './user.types.ts'

export type { GrammarPattern } from './grammar.types.ts'

export type {
  ApiCard,
  ApiDueCard,
  ApiCardListItem,
  ApiDeck,
  ApiDeckWithStats,
  ApiPremadeDeck,
  ApiPremadeSubscription,
  ApiSimilarCard,
  ApiSubscribeResult,
  ApiForecastDay,
  ApiBatchResult,
  ApiHeatmapDay,
  ApiLayoutAccuracy,
  ApiStreakStats,
  ApiJlptGap,
  ApiMilestoneForecast,
  ApiReviewSubmitResponse,
} from './api.types.ts'

export type { Database, Json } from './database.types.ts'

// JSONB content shape for ApiCard.fieldsData. The discriminated-union
// constituents (WordFields, VocabularyFieldsData, GrammarFieldsData,
// SentenceFieldsData) are intentionally not re-exported — consumers
// widen to Record<string, unknown> at the read site.
export type { FieldsData } from './field-shapes.ts'
