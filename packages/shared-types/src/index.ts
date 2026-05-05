export { State, CardType, isCardType } from './fsrs.types.ts'

export { JLPTLevel, LayoutType, isJlptLevel } from './card.types.ts'
export type { ExampleSentence, KanjiBreakdown } from './card.types.ts'

export { DeckType, isDeckType } from './deck.types.ts'

export { ReviewRating } from './review.types.ts'
export type { SessionLeech, SessionSummary } from './review.types.ts'

export type { Profile } from './user.types.ts'

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
  ApiReviewedCard,
  ApiAuthTokens,
  ApiSignUpResult,
} from './api.types.ts'

// JSONB content shape for ApiCard.fieldsData. Consumers narrow via
// `getWordFields` / `getVocabularyFields` instead of widening.
export type { FieldsData, WordFields } from './field-shapes.ts'
export { getWordFields, getVocabularyFields } from './field-shapes.ts'

// API response schemas — apps validate every API response body against these.
export {
  ApiCardSchema, ApiDueCardSchema, ApiCardListItemSchema, ApiSimilarCardSchema,
  ApiDeckSchema, ApiDeckWithStatsSchema,
  ApiPremadeDeckSchema, ApiPremadeSubscriptionSchema, ApiSubscribeResultSchema,
  ApiForecastDaySchema, ApiBatchResultSchema,
  ApiHeatmapDaySchema, ApiLayoutAccuracySchema, ApiStreakStatsSchema,
  ApiJlptGapSchema, ApiMilestoneForecastSchema,
  ApiReviewedCardSchema, ApiReviewSubmitResponseSchema,
  SessionSummarySchema,
  ProfileSchema,
  voidResponseSchema,
} from './schemas/api.schema.ts'

// ─── Validation schemas ───────────────────────────────────────────────────────
// Zod schemas + their inferred types are the single source of truth for
// request/response shapes that cross the API ↔ web boundary.

export {
  cardTypeEnum, jlptLevelEnum,
  createCardSchema, updateCardSchema,
  cardIdParamSchema, nestedDeckIdParamSchema,
  listCardsQuerySchema,
} from './schemas/card.schema.ts'
export type {
  CreateCardPayload,
  UpdateCardInput, UpdateCardPayload,
  CardStatusFilter,
} from './schemas/card.schema.ts'

export { deckTypeEnum, createDeckSchema, updateDeckSchema, deckIdParamSchema } from './schemas/deck.schema.ts'
export type {
  CreateDeckInput, CreateDeckPayload,
  UpdateDeckInput,
} from './schemas/deck.schema.ts'

export {
  GeneratedCardDataSchema, GeneratedSentencesSchema, GeneratedMnemonicSchema,
  generateCardInputSchema, generateSentencesInputSchema, generateMnemonicInputSchema,
} from './schemas/ai.schema.ts'
export type {
  GeneratedCardData, GeneratedSentences, GeneratedMnemonic,
} from './schemas/ai.schema.ts'

export { updateProfileSchema } from './schemas/profile.schema.ts'
export type { UpdateProfileInput } from './schemas/profile.schema.ts'

export {
  reviewRatingEnum, submitReviewSchema, batchReviewSchema, sessionSummaryParamsSchema,
} from './schemas/review.schema.ts'
export type { SubmitReviewInput, UserRating } from './schemas/review.schema.ts'

export {
  signupSchema, loginSchema, refreshSchema,
  cancelSignupSchema, verifyOtpSchema, resendOtpSchema,
} from './schemas/auth.schema.ts'
export type {
  SignupInput, LoginInput, RefreshInput,
  CancelSignupInput, VerifyOtpInput, ResendOtpInput,
} from './schemas/auth.schema.ts'

// ─── Sanitization primitive ───────────────────────────────────────────────────
// Only `sanitizeForPrompt` has external consumers; the lower-level helpers
// (stripHtml, looksLikeHtml, safeShortText, etc.) are used internally by the
// schemas above and stay accessible via deep import inside the package.

export { sanitizeForPrompt } from './sanitize.ts'
