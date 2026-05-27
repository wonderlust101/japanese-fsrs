export type {
	ApiAnalyticsDashboard,
	ApiAnswerRatingDistribution,
	ApiAuthTokens,
	ApiBatchDiagnoseResult,
	ApiBatchResult,
	ApiBulkCardMutationResult,
	ApiCard,
	ApiCardListItem,
	ApiCardQualityIssue,
	ApiCopyDeckResult,
	ApiCopyPremadeDeckResult,
	ApiCrossDeckCardListItem,
	ApiDayReflection,
	ApiDeck,
	ApiDeckWithStats,
	ApiDueCard,
	ApiForecastDay,
	ApiHeatmapDay,
	ApiHistogramBucket,
	ApiInsightsDistributions,
	ApiJlptGap,
	ApiLayoutAccuracy,
	ApiList,
	ApiMaturitySnapshot,
	ApiMilestoneForecast,
	ApiPremadeDeck,
	ApiRatingPreview,
	ApiRatingsPreview,
	ApiReviewedCard,
	ApiReviewSubmitResponse,
	ApiSignUpResult,
	ApiSimilarCard,
	ApiTomoNote,
} from "./api.types.ts";

export { assertNever } from "./assert.ts";
export { isJlptLevel, JLPTLevel, LayoutType } from "./card.types.ts";

export type { ExampleSentence, KanjiBreakdown } from "./card.types.ts";

export { DeckType, isDeckType } from "./deck.types.ts";
// JSONB content shape for ApiCard.fieldsData. Consumers narrow via
// `getWordFields` / `getVocabularyFields` / `getSentenceFrontBack` instead of widening.
export type { FieldsData, WordFields } from "./field-shapes.ts";

export { getSentenceFields, getSentenceFrontBack, getVocabularyFields, getWordFields } from "./field-shapes.ts";
export { State } from "./fsrs.types.ts";

export { ReviewRating } from "./review.types.ts";

export type { SessionSummary, SessionWeakSpot } from "./review.types.ts";

// Only `classifySession` is part of the public surface. Its threshold
// constants (NO_PATTERN_MIN_CARDS, WEAK_SPOT_MIN_COUNT, …) were re-exported
// for "UI copy" that never materialized — confirmed unused across both apps —
// so they stay module-private to classify-session.ts. Re-add here if a
// consumer ever needs the raw values.
export { classifySession } from "./review/classify-session.ts";

export type { PatternInputs, SessionPattern } from "./review/classify-session.ts";
export { sanitizeForPrompt } from "./sanitize.ts";

export {
	generateCardInputSchema,
	GeneratedCardDataSchema,
	GeneratedMnemonicSchema,
	GeneratedSentenceCardSchema,
	GeneratedSentencesSchema,
	GeneratedTomoNoteSchema,
	GeneratedWeakSpotDiagnosisSchema,
	generateMnemonicInputSchema,
	generateSentencesInputSchema,
} from "./schemas/ai.schema.ts";

export type {
	GeneratedCardData,
	GeneratedMnemonic,
	GeneratedSentenceCard,
	GeneratedSentences,
	GeneratedTomoNote,
	GeneratedWeakSpotDiagnosis,
} from "./schemas/ai.schema.ts";

// ─── Validation schemas ───────────────────────────────────────────────────────
// Zod schemas + their inferred types are the single source of truth for
// request/response shapes that cross the API ↔ web boundary.

// API response schemas — apps validate every API response body against these.
export {
	ApiAnalyticsDashboardSchema,
	ApiAnswerRatingDistributionSchema,
	ApiBatchDiagnoseResultSchema,
	ApiBatchResultSchema,
	ApiBulkCardMutationResultSchema,
	ApiCardListItemSchema,
	ApiCardQualityIssueSchema,
	ApiCardQualityIssueTypeSchema,
	ApiCardSchema,
	ApiCopyDeckResultSchema,
	ApiCopyPremadeDeckResultSchema,
	ApiCrossDeckCardListItemSchema,
	ApiDayReflectionSchema,
	ApiDayReflectionSourceSchema,
	ApiDeckSchema,
	ApiDeckWithStatsSchema,
	ApiDueCardSchema,
	ApiForecastDaySchema,
	ApiHeatmapDaySchema,
	ApiHistogramBucketSchema,
	ApiInsightsDistributionsSchema,
	ApiJlptGapSchema,
	ApiLayoutAccuracySchema,
	apiListEnvelope,
	ApiMaturityHistoryDaysSchema,
	ApiMaturitySnapshotSchema,
	ApiMilestoneForecastSchema,
	ApiPremadeDeckSchema,
	ApiRatingPreviewSchema,
	ApiRatingsPreviewSchema,
	ApiReviewedCardSchema,
	ApiReviewSubmitResponseSchema,
	ApiSimilarCardSchema,
	ApiTomoNoteKindSchema,
	ApiTomoNoteSchema,
	ApiWeakSpotDrillAttemptResultSchema,
	ApiWeakSpotDrillAttemptSchema,
	ApiWeakSpotDrillCardSchema,
	ApiWeakSpotDrillSessionDetailCardSchema,
	ApiWeakSpotDrillSessionDetailSchema,
	ApiWeakSpotDrillSessionSchema,
	ApiWeakSpotDrillSessionStatusSchema,
	ApiWeakSpotListItemSchema,
	ApiWeakSpotListResponseSchema,
	ProfileSchema,
	SessionSummarySchema,
	voidResponseSchema,
} from "./schemas/api.schema.ts";
export {
	cancelSignupSchema,
	changePasswordSchema,
	deleteAccountSchema,
	loginSchema,
	passwordResetRequestSchema,
	passwordSchema,
	refreshSchema,
	resendOtpSchema,
	signupSchema,
	verifyOtpSchema,
} from "./schemas/auth.schema.ts";

export type {
	CancelSignupInput,
	ChangePasswordInput,
	DeleteAccountInput,
	LoginInput,
	PasswordResetRequestInput,
	RefreshInput,
	ResendOtpInput,
	SignupInput,
	VerifyOtpInput,
} from "./schemas/auth.schema.ts";
export {
	bulkDeleteCardsBodySchema,
	bulkMoveCardsBodySchema,
	bulkSuspendCardsBodySchema,
	bulkUnsuspendCardsBodySchema,
	cardIdParamSchema,
	cardMissingFieldEnum,
	cardPresentFieldEnum,
	cardSortDirEnum,
	cardSortFieldEnum,
	copyCardBodySchema,
	createCardSchema,
	crossDeckJlptFilterEnum,
	crossDeckListCardsQuerySchema,
	jlptLevelEnum,
	layoutTypeEnum,
	listCardsQuerySchema,
	moveCardBodySchema,
	nestedDeckIdParamSchema,
	partOfSpeechEnum,
	pitchPatternEnum,
	suspendCardBodySchema,
	updateCardSchema,
} from "./schemas/card.schema.ts";

export type {
	BulkDeleteCardsBody,
	BulkMoveCardsBody,
	BulkSuspendCardsBody,
	BulkUnsuspendCardsBody,
	CardMissingField,
	CardPresentField,
	CardSortDir,
	CardSortField,
	CardStatusFilter,
	CopyCardBody,
	CreateCardPayload,
	CrossDeckJlptFilter,
	CrossDeckListCardsQuery,
	MoveCardBody,
	PartOfSpeech,
	PitchPattern,
	SuspendCardBody,
	UpdateCardInput,
	UpdateCardPayload,
} from "./schemas/card.schema.ts";
export {
	archiveDeckSchema,
	copyDeckSchema,
	createDeckSchema,
	deckIdParamSchema,
	decksViewEnum,
	deckTypeEnum,
	listDecksQuerySchema,
	updateDeckSchema,
} from "./schemas/deck.schema.ts";

export type {
	CopyDeckInput,
	CopyDeckPayload,
	CreateDeckInput,
	CreateDeckPayload,
	DecksView,
	ListDecksQuery,
	UpdateDeckInput,
	UpdateDeckPayload,
} from "./schemas/deck.schema.ts";
// Field-shapes Zod schemas. Re-exported so service code can validate
// `fields_data` JSONB at the API boundary without falling back to a loose
// `z.record(z.string(), z.unknown())` that would lose union narrowing.
// `SentenceBreakdownTokenSchema` is the per-token piece of the sentence-
// layout `breakdown` array (Backend Completion Plan Stage 12).
export {
	ExampleSentenceSchema,
	FieldsDataSchema,
	GrammarFieldsDataSchema,
	KanjiBreakdownSchema,
	SentenceBreakdownTokenSchema,
	SentenceFieldsDataSchema,
	VocabularyFieldsDataSchema,
	WordFieldsSchema,
} from "./schemas/field-shapes.schema.ts";

export { updateProfileSchema } from "./schemas/profile.schema.ts";
export type { UpdateProfileInput } from "./schemas/profile.schema.ts";

export {
	batchReviewSchema,
	forgetCardBodySchema,
	previewRatingsParamSchema,
	reviewRatingEnum,
	rollbackReviewParamSchema,
	sessionSummaryParamsSchema,
	submitReviewSchema,
} from "./schemas/review.schema.ts";
export type {
	ForgetCardBody,
	RollbackReviewParam,
	SubmitReviewInput,
	UserRating,
} from "./schemas/review.schema.ts";

// ─── Sanitization primitive ───────────────────────────────────────────────────
// Only `sanitizeForPrompt` has external consumers; the lower-level helpers
// (stripHtml, looksLikeHtml, safeShortText, etc.) are used internally by the
// schemas above and stay accessible via deep import inside the package.

export type { Profile } from "./user.types.ts";

// ─── Exhaustiveness guard ─────────────────────────────────────────────────────
// `assertNever` is the single home for the discriminated-union exhaustiveness
// check that was previously open-coded as `const _x: never = value` across
// both apps. Use it in the `default` branch of a switch over a closed union.

export type {
	ApiWeakSpotDrillAttempt,
	ApiWeakSpotDrillAttemptResult,
	ApiWeakSpotDrillCard,
	ApiWeakSpotDrillSession,
	ApiWeakSpotDrillSessionDetail,
	ApiWeakSpotDrillSessionDetailCard,
	ApiWeakSpotDrillSessionStatus,
	ApiWeakSpotListItem,
	ApiWeakSpotListResponse,
} from "./weak-spot.types.ts";
