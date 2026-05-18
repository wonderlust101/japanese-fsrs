export { State } from './fsrs.types.ts'

export { JLPTLevel, LayoutType, isJlptLevel } from './card.types.ts'
export type { ExampleSentence, KanjiBreakdown } from './card.types.ts'

export { DeckType, isDeckType } from './deck.types.ts'

export { ReviewRating } from './review.types.ts'
export type { SessionWeakSpot, SessionSummary } from './review.types.ts'

export type {
  ApiWeakSpotListItem,
  ApiWeakSpotListResponse,
  ApiWeakSpotDrillCard,
  ApiWeakSpotDrillSession,
  ApiWeakSpotDrillSessionStatus,
  ApiWeakSpotDrillSessionDetailCard,
  ApiWeakSpotDrillSessionDetail,
  ApiWeakSpotDrillAttemptResult,
  ApiWeakSpotDrillAttempt,
} from './weak-spot.types.ts'

export type { Profile } from './user.types.ts'

export type {
  ApiCard,
  ApiDueCard,
  ApiCardListItem,
  ApiCrossDeckCardListItem,
  ApiBulkCardMutationResult,
  ApiDeck,
  ApiDeckWithStats,
  ApiPremadeDeck,
  ApiCopyPremadeDeckResult,
  ApiTomoNote,
  ApiCardQualityIssue,
  ApiMaturitySnapshot,
  ApiSimilarCard,
  ApiForecastDay,
  ApiBatchResult,
  ApiList,
  ApiHeatmapDay,
  ApiLayoutAccuracy,
  ApiJlptGap,
  ApiMilestoneForecast,
  ApiAnalyticsDashboard,
  ApiAnswerRatingDistribution,
  ApiHistogramBucket,
  ApiInsightsDistributions,
  ApiReviewSubmitResponse,
  ApiReviewedCard,
  ApiAuthTokens,
  ApiSignUpResult,
} from './api.types.ts'

// JSONB content shape for ApiCard.fieldsData. Consumers narrow via
// `getWordFields` / `getVocabularyFields` / `getSentenceFrontBack` instead of widening.
export type { FieldsData, WordFields } from './field-shapes.ts'
export { getWordFields, getVocabularyFields, getSentenceFrontBack } from './field-shapes.ts'

// Field-shapes Zod schemas. Re-exported so service code can validate
// `fields_data` JSONB at the API boundary without falling back to a loose
// `z.record(z.string(), z.unknown())` that would lose union narrowing.
// `SentenceBreakdownTokenSchema` is the per-token piece of the sentence-
// layout `breakdown` array (Backend Completion Plan Stage 12).
export {
  WordFieldsSchema,
  VocabularyFieldsDataSchema,
  GrammarFieldsDataSchema,
  SentenceFieldsDataSchema,
  SentenceBreakdownTokenSchema,
  ExampleSentenceSchema,
  KanjiBreakdownSchema,
  FieldsDataSchema,
} from './schemas/field-shapes.schema.ts'

// API response schemas — apps validate every API response body against these.
export {
  ApiCardSchema, ApiDueCardSchema, ApiCardListItemSchema,
  ApiCrossDeckCardListItemSchema, ApiBulkCardMutationResultSchema,
  ApiSimilarCardSchema,
  ApiDeckSchema, ApiDeckWithStatsSchema,
  ApiPremadeDeckSchema, ApiCopyPremadeDeckResultSchema,
  ApiTomoNoteSchema, ApiTomoNoteKindSchema,
  ApiCardQualityIssueSchema, ApiCardQualityIssueTypeSchema,
  ApiMaturitySnapshotSchema, ApiMaturityHistoryDaysSchema,
  ApiForecastDaySchema, ApiBatchResultSchema, apiListEnvelope,
  ApiHeatmapDaySchema, ApiLayoutAccuracySchema,
  ApiJlptGapSchema, ApiMilestoneForecastSchema, ApiAnalyticsDashboardSchema,
  ApiAnswerRatingDistributionSchema, ApiHistogramBucketSchema, ApiInsightsDistributionsSchema,
  ApiReviewedCardSchema, ApiReviewSubmitResponseSchema,
  SessionSummarySchema,
  ApiWeakSpotListItemSchema, ApiWeakSpotListResponseSchema,
  ApiWeakSpotDrillCardSchema, ApiWeakSpotDrillSessionSchema, ApiWeakSpotDrillSessionStatusSchema,
  ApiWeakSpotDrillSessionDetailCardSchema, ApiWeakSpotDrillSessionDetailSchema,
  ApiWeakSpotDrillAttemptResultSchema, ApiWeakSpotDrillAttemptSchema,
  ProfileSchema,
  voidResponseSchema,
} from './schemas/api.schema.ts'

// ─── Validation schemas ───────────────────────────────────────────────────────
// Zod schemas + their inferred types are the single source of truth for
// request/response shapes that cross the API ↔ web boundary.

export {
  jlptLevelEnum, layoutTypeEnum,
  createCardSchema, updateCardSchema,
  cardIdParamSchema, nestedDeckIdParamSchema,
  listCardsQuerySchema,
  crossDeckListCardsQuerySchema, crossDeckJlptFilterEnum,
  cardMissingFieldEnum, cardSortFieldEnum,
  moveCardBodySchema, copyCardBodySchema, suspendCardBodySchema,
  bulkMoveCardsBodySchema, bulkSuspendCardsBodySchema,
  bulkUnsuspendCardsBodySchema, bulkDeleteCardsBodySchema,
  bulkTagCardsBodySchema,
} from './schemas/card.schema.ts'
export type {
  CreateCardPayload,
  UpdateCardInput, UpdateCardPayload,
  CardStatusFilter,
  CrossDeckListCardsQuery, CrossDeckJlptFilter,
  CardMissingField, CardSortField,
  MoveCardBody, CopyCardBody, SuspendCardBody,
  BulkMoveCardsBody, BulkSuspendCardsBody,
  BulkUnsuspendCardsBody, BulkDeleteCardsBody,
  BulkTagCardsBody,
} from './schemas/card.schema.ts'

export {
  deckTypeEnum, createDeckSchema, updateDeckSchema, deckIdParamSchema,
  listDecksQuerySchema,
} from './schemas/deck.schema.ts'
export type {
  CreateDeckInput, CreateDeckPayload,
  UpdateDeckInput, UpdateDeckPayload,
  ListDecksQuery,
} from './schemas/deck.schema.ts'

export {
  GeneratedCardDataSchema, GeneratedSentencesSchema, GeneratedMnemonicSchema,
  GeneratedWeakSpotDiagnosisSchema, GeneratedTomoNoteSchema,
  GeneratedSentenceCardSchema,
  generateCardInputSchema, generateSentencesInputSchema, generateMnemonicInputSchema,
} from './schemas/ai.schema.ts'
export type {
  GeneratedCardData, GeneratedSentences, GeneratedMnemonic, GeneratedWeakSpotDiagnosis,
  GeneratedTomoNote,
  GeneratedSentenceCard,
} from './schemas/ai.schema.ts'

export { updateProfileSchema } from './schemas/profile.schema.ts'
export type { UpdateProfileInput } from './schemas/profile.schema.ts'

export {
  reviewRatingEnum, submitReviewSchema, batchReviewSchema, sessionSummaryParamsSchema,
  rollbackReviewParamSchema, forgetCardBodySchema,
} from './schemas/review.schema.ts'
export type {
  SubmitReviewInput, UserRating,
  RollbackReviewParam, ForgetCardBody,
} from './schemas/review.schema.ts'

export {
  signupSchema, loginSchema, refreshSchema,
  cancelSignupSchema, verifyOtpSchema, resendOtpSchema,
  changePasswordSchema, deleteAccountSchema,
} from './schemas/auth.schema.ts'
export type {
  SignupInput, LoginInput, RefreshInput,
  CancelSignupInput, VerifyOtpInput, ResendOtpInput,
  ChangePasswordInput, DeleteAccountInput,
} from './schemas/auth.schema.ts'

// ─── Sanitization primitive ───────────────────────────────────────────────────
// Only `sanitizeForPrompt` has external consumers; the lower-level helpers
// (stripHtml, looksLikeHtml, safeShortText, etc.) are used internally by the
// schemas above and stay accessible via deep import inside the package.

export { sanitizeForPrompt } from './sanitize.ts'
