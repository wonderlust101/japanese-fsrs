/**
 * Wire-format types for the Express API (camelCase). These describe the JSON
 * shape that crosses the API → frontend boundary. Each type is derived via
 * `z.infer` from a Zod schema in `schemas/api.schema.ts` so the runtime
 * validator and the static type cannot drift.
 */

import type { z } from 'zod'

import type {
  ApiCardSchema,
  ApiDueCardSchema,
  ApiCardListItemSchema,
  ApiCrossDeckCardListItemSchema,
  ApiBulkCardMutationResultSchema,
  ApiSimilarCardSchema,
  ApiDeckSchema,
  ApiDeckWithStatsSchema,
  ApiPremadeDeckSchema,
  ApiCopyPremadeDeckResultSchema,
  ApiCopyDeckResultSchema,
  ApiTomoNoteSchema,
  ApiCardQualityIssueSchema,
  ApiMaturitySnapshotSchema,
  ApiForecastDaySchema,
  ApiHeatmapDaySchema,
  ApiLayoutAccuracySchema,
  ApiJlptGapSchema,
  ApiMilestoneForecastSchema,
  ApiAnalyticsDashboardSchema,
  ApiAnswerRatingDistributionSchema,
  ApiHistogramBucketSchema,
  ApiInsightsDistributionsSchema,
  ApiReviewedCardSchema,
  ApiReviewSubmitResponseSchema,
  ApiAuthTokensSchema,
  ApiSignUpResultSchema,
} from './schemas/api.schema.ts'

export type ApiCard         = z.infer<typeof ApiCardSchema>
/** Subset of ApiCard returned by /reviews/due — content-only fields the UI needs.
 *  Due cards are by definition not suspended, so isSuspended is omitted.
 *  layoutType is included so the UI can narrow fieldsData via field-shapes helpers. */
export type ApiDueCard      = z.infer<typeof ApiDueCardSchema>
/** Subset of ApiCard returned by /decks/:id/cards (card list). */
export type ApiCardListItem = z.infer<typeof ApiCardListItemSchema>

/**
 * Returned by `GET /api/v1/cards/cross-deck` (the /cards browser). Extends
 * `ApiCardListItem` with the joined `deckId` + `deckName` and the `lapses`
 * counter, so the cross-deck table can render a deck column and a lapse
 * sort without a follow-up lookup.
 */
export type ApiCrossDeckCardListItem = z.infer<typeof ApiCrossDeckCardListItemSchema>

/**
 * Returned by bulk-mutation endpoints under `POST /api/v1/cards/bulk/*`.
 * `succeeded` lists the ids that were mutated; `failed` lists per-id
 * rejections (premade-source guards, ownership failures, missing rows) so
 * the UI can show a usable partial-success error.
 */
export type ApiBulkCardMutationResult = z.infer<typeof ApiBulkCardMutationResultSchema>

/**
 * Wire-format result from /api/v1/cards/:id/similar (find_similar_cards RPC).
 * The frontend doesn't currently consume this — the backend service uses the
 * type internally and the endpoint stays live for future surfaces.
 */
export type ApiSimilarCard = z.infer<typeof ApiSimilarCardSchema>

export type ApiDeck          = z.infer<typeof ApiDeckSchema>
export type ApiDeckWithStats = z.infer<typeof ApiDeckWithStatsSchema>

export type ApiPremadeDeck            = z.infer<typeof ApiPremadeDeckSchema>
/**
 * Backend Completion Plan Stage 4 (copy model). Returned by
 * `POST /api/v1/premade-decks/:id/copy`. Replaces the prior
 * `ApiSubscribeResult` shape which carried subscription-junction state.
 */
export type ApiCopyPremadeDeckResult  = z.infer<typeof ApiCopyPremadeDeckResultSchema>

/** Returned by `POST /api/v1/decks/:id/copy`. Same wire shape as the
 *  premade copy result; kept as a distinct type because the two routes
 *  have different ownership semantics and resolve names differently. */
export type ApiCopyDeckResult         = z.infer<typeof ApiCopyDeckResultSchema>

/** Returned by `GET /api/v1/tomo/note`. Backend-internal today; no
 *  frontend consumer. Kept for the API service's response shape. */
export type ApiTomoNote               = z.infer<typeof ApiTomoNoteSchema>

/**
 * Backend Completion Plan Stage 8. One element of the array returned by
 * `GET /api/v1/insights/card-quality`. Six entries are always present
 * (one per known issue type) so consumers can iterate a stable shape.
 */
export type ApiCardQualityIssue       = z.infer<typeof ApiCardQualityIssueSchema>

/**
 * Backend Completion Plan Stage 9. One day's slice of the maturity
 * pipeline. Returned by `GET /api/v1/insights/maturity-history?days=…`.
 */
export type ApiMaturitySnapshot       = z.infer<typeof ApiMaturitySnapshotSchema>

export type ApiForecastDay = z.infer<typeof ApiForecastDaySchema>

/**
 * Generic batch result. Hand-written because Zod can't cleanly produce a
 * generic schema/type pair — the runtime validator is the factory
 * `ApiBatchResultSchema(item)` in `schemas/api.schema.ts`. Keep this interface
 * and that factory in sync; both must accept the same shape.
 */
export interface ApiBatchResult<T = unknown> {
  results: T[]
  errors:  Array<{ cardId: string; error: string }>
}

/**
 * Universal list-response envelope. Hand-written for the same reason as
 * `ApiBatchResult` — runtime validator is the factory `apiListEnvelope(item)`
 * in `schemas/api.schema.ts`. Endpoints that aren't actually cursor-paginated
 * (bounded responses, fixed-dimension analytics arrays) set
 * `nextCursor: null` and `hasMore: false`; the shape stays uniform.
 */
export interface ApiList<T = unknown> {
  items:       T[]
  nextCursor:  string | null
  hasMore:     boolean
  /**
   * Total count of items matching the current filter, when the endpoint can
   * provide it cheaply. Optional — analytics arrays and other bounded
   * responses that don't compute a count simply omit this field. The
   * explicit `| undefined` is required for exactOptionalPropertyTypes
   * compatibility with Zod's `.optional()` output.
   */
  totalCount?: number | undefined
}

// ─── Analytics wire formats ───────────────────────────────────────────────────

/** Single day in the retention heatmap. Days with zero reviews are omitted. */
export type ApiHeatmapDay = z.infer<typeof ApiHeatmapDaySchema>

/** Per-layout (cognitive modality) accuracy rollup. */
export type ApiLayoutAccuracy = z.infer<typeof ApiLayoutAccuracySchema>

/** Per-JLPT-level total/learned/due counts with progress percentage. */
export type ApiJlptGap = z.infer<typeof ApiJlptGapSchema>

/** Per-JLPT-level milestone projection from the user's 30-day pace. */
export type ApiMilestoneForecast = z.infer<typeof ApiMilestoneForecastSchema>

/** Bundled analytics response for the dashboard view (one round-trip). */
export type ApiAnalyticsDashboard = z.infer<typeof ApiAnalyticsDashboardSchema>

/**
 * Per-rating histogram returned by `GET /api/v1/insights/distributions`.
 * Always four numeric fields — server zero-fills empty buckets so the
 * consumer renders a stable shape.
 */
export type ApiAnswerRatingDistribution = z.infer<typeof ApiAnswerRatingDistributionSchema>

/**
 * One bar in a histogram (interval / stability / difficulty). Labels are
 * defined server-side so the wire shape stays stable and the frontend
 * doesn't have to re-derive bucket boundaries.
 */
export type ApiHistogramBucket = z.infer<typeof ApiHistogramBucketSchema>

/**
 * Bundled response for `GET /api/v1/insights/distributions`. One
 * round-trip covers the four Statistics-page histograms that aren't on
 * the analytics dashboard: rating distribution, interval distribution,
 * FSRS stability distribution, and FSRS difficulty distribution.
 */
export type ApiInsightsDistributions = z.infer<typeof ApiInsightsDistributionsSchema>

// ─── Review submit wire format ────────────────────────────────────────────────

/**
 * Strict subset of ApiCard returned by FSRS write operations and embedded in
 * the /reviews/submit response — only the fields the client needs to update
 * its local state after a review.
 */
export type ApiReviewedCard = z.infer<typeof ApiReviewedCardSchema>

/** Response of POST /api/v1/reviews/submit. */
export type ApiReviewSubmitResponse = z.infer<typeof ApiReviewSubmitResponseSchema>

// ─── Auth wire formats ────────────────────────────────────────────────────────

export type ApiAuthTokens   = z.infer<typeof ApiAuthTokensSchema>
export type ApiSignUpResult = z.infer<typeof ApiSignUpResultSchema>
