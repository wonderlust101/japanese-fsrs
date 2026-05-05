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
  ApiSimilarCardSchema,
  ApiDeckSchema,
  ApiDeckWithStatsSchema,
  ApiPremadeDeckSchema,
  ApiPremadeSubscriptionSchema,
  ApiSubscribeResultSchema,
  ApiForecastDaySchema,
  ApiHeatmapDaySchema,
  ApiLayoutAccuracySchema,
  ApiStreakStatsSchema,
  ApiJlptGapSchema,
  ApiMilestoneForecastSchema,
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
 * Wire-format result from /api/v1/cards/:id/similar (find_similar_cards RPC).
 * Mirrors the 8 columns the RPC actually returns — distinct from ApiCard,
 * which would imply 21 columns.
 */
export type ApiSimilarCard = z.infer<typeof ApiSimilarCardSchema>

export type ApiDeck          = z.infer<typeof ApiDeckSchema>
export type ApiDeckWithStats = z.infer<typeof ApiDeckWithStatsSchema>

export type ApiPremadeDeck         = z.infer<typeof ApiPremadeDeckSchema>
export type ApiPremadeSubscription = z.infer<typeof ApiPremadeSubscriptionSchema>
export type ApiSubscribeResult     = z.infer<typeof ApiSubscribeResultSchema>

export type ApiForecastDay = z.infer<typeof ApiForecastDaySchema>

/** Generic batch result. The element type T is supplied by the caller. */
export interface ApiBatchResult<T = unknown> {
  results: T[]
  errors:  Array<{ cardId: string; error: string }>
}

// ─── Analytics wire formats ───────────────────────────────────────────────────

/** Single day in the retention heatmap. Days with zero reviews are omitted. */
export type ApiHeatmapDay = z.infer<typeof ApiHeatmapDaySchema>

/** Per-layout (cognitive modality) accuracy rollup. */
export type ApiLayoutAccuracy = z.infer<typeof ApiLayoutAccuracySchema>

/** Current and longest streak plus the last review date (UTC calendar days). */
export type ApiStreakStats = z.infer<typeof ApiStreakStatsSchema>

/** Per-JLPT-level total/learned/due counts with progress percentage. */
export type ApiJlptGap = z.infer<typeof ApiJlptGapSchema>

/** Per-JLPT-level milestone projection from the user's 30-day pace. */
export type ApiMilestoneForecast = z.infer<typeof ApiMilestoneForecastSchema>

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
