/**
 * Zod schemas for every wire-format type the API returns to the web.
 * The TS types in `api.types.ts`, `review.types.ts`, and `user.types.ts`
 * are derived from these schemas via `z.infer` — schema-as-source so the
 * validator and the type cannot drift.
 */

import { z } from 'zod'

import { State } from 'ts-fsrs'

import { JLPTLevel, LayoutType } from '../card.types.ts'
import { DeckType } from '../deck.types.ts'
import { FieldsDataSchema } from './field-shapes.schema.ts'

// ─── Enum schemas (mirroring the const objects in shared-types) ───────────────

const layoutTypeSchema = z.enum(Object.values(LayoutType) as [LayoutType, ...LayoutType[]])
const jlptLevelSchema  = z.enum(Object.values(JLPTLevel)  as [JLPTLevel,  ...JLPTLevel[]])
const deckTypeSchema   = z.enum(Object.values(DeckType)   as [DeckType,   ...DeckType[]])
// ts-fsrs's State is a numeric enum — z.nativeEnum accepts numeric enums directly.
const stateSchema      = z.nativeEnum(State)

// ─── Cards ────────────────────────────────────────────────────────────────────

export const ApiCardSchema = z.object({
  id:             z.string(),
  userId:         z.string().nullable(),
  deckId:         z.string().nullable(),
  premadeDeckId:  z.string().nullable(),
  layoutType:     layoutTypeSchema,
  fieldsData:     FieldsDataSchema,
  parentCardId:   z.string().nullable(),
  tags:           z.array(z.string()),
  jlptLevel:      jlptLevelSchema.nullable(),
  state:          stateSchema,
  isSuspended:    z.boolean(),
  due:            z.string(),
  stability:      z.number(),
  difficulty:     z.number(),
  elapsedDays:    z.number(),
  scheduledDays:  z.number(),
  learningSteps:  z.number(),
  reps:           z.number(),
  lapses:         z.number(),
  lastReview:     z.string().nullable(),
  createdAt:      z.string(),
  updatedAt:      z.string(),
  // Optimistic-concurrency version. Bumped on every PATCH; sent back as
  // `If-Match: <version>` to gate the next update. List / due projections
  // intentionally omit this field — only the detail view drives PATCH.
  version:        z.number(),
})

export const ApiDueCardSchema = ApiCardSchema.pick({
  id:         true,
  deckId:     true,
  jlptLevel:  true,
  state:      true,
  due:        true,
  fieldsData: true,
  layoutType: true,
})

export const ApiCardListItemSchema = ApiCardSchema.pick({
  id:          true,
  fieldsData:  true,
  layoutType:  true,
  jlptLevel:   true,
  state:       true,
  isSuspended: true,
  due:         true,
  tags:        true,
})

// ─── Cross-deck card list ─────────────────────────────────────────────────────
//
// Powers `GET /api/v1/cards/cross-deck` (the /cards browser). Adds the
// joined `deckId` + `deckName` so the table can render a deck column
// without an N+1 deck-list lookup, and `lapses` so the sort=lapses option
// can show the metric directly in the row.

export const ApiCrossDeckCardListItemSchema = ApiCardListItemSchema.extend({
  deckId:   z.string(),
  deckName: z.string(),
  lapses:   z.number().int().nonnegative(),
})

// ─── Bulk mutation result ─────────────────────────────────────────────────────
//
// Bulk endpoints (`POST /api/v1/cards/bulk/*`) return per-id outcomes so
// the UI can show partial-success states. `failed` is empty on the
// happy path; populated when ownership checks reject some ids.

export const ApiBulkCardMutationResultSchema = z.object({
  succeeded: z.array(z.string()),
  failed:    z.array(z.object({
    id:    z.string(),
    error: z.string(),
    code:  z.string().optional(),
  })),
})

export const ApiSimilarCardSchema = z.object({
  id:         z.string(),
  deckId:     z.string(),
  layoutType: layoutTypeSchema,
  fieldsData: FieldsDataSchema,
  tags:       z.array(z.string()),
  jlptLevel:  jlptLevelSchema.nullable(),
  similarity: z.number(),
})

// ─── Decks ────────────────────────────────────────────────────────────────────

export const ApiDeckSchema = z.object({
  id:              z.string(),
  name:            z.string(),
  description:     z.string().nullable(),
  deckType:        deckTypeSchema,
  cardCount:       z.number(),
  // `sourcePremadeId` is attribution only — non-null means "this deck was
  // started from a premade catalogue entry". Backend Completion Plan
  // Stage 4 (copy model) dropped the companion `is_premade_fork` boolean:
  // under the new model all decks are owned, standalone, and delete via
  // the same path regardless of origin.
  sourcePremadeId: z.string().nullable(),
  version:         z.number(),
  createdAt:       z.string(),
  updatedAt:       z.string(),
  /**
   * ISO 8601 timestamp the user archived the deck, or `null` when the deck
   * is active. Archived decks are excluded from the default `GET /decks`
   * listing, the `/reviews/due` queue, the review forecast, and every
   * write path except `DELETE /decks/:id` and `POST /decks/:id/unarchive`.
   */
  archivedAt:      z.string().nullable(),
})

export const ApiDeckWithStatsSchema = ApiDeckSchema.extend({
  /** Cards currently due (interval expired) and not suspended. */
  dueCount:       z.number(),
  /** Cards in state=New (never reviewed). Snapshot of the entire deck, not "new today". */
  newCount:       z.number(),
  /** Cards that have reached graduated maturity: state=Review AND scheduled_days >= 21 (Anki convention). */
  matureCount:    z.number(),
  /** Subset of dueCount: due cards in state=New. */
  dueNewCount:    z.number(),
  /** Subset of dueCount: due cards in state != New (Review / Learning / Relearning). */
  dueReviewCount: z.number(),
  /**
   * Timestamp (ISO 8601) of the most recent review across any card in the
   * deck — `MAX(cards.last_review)` server-side. `null` when no card in the
   * deck has been reviewed yet (semantically distinct from a 0 count). Added
   * by the `list_decks_paginated` rollup migration (Backend Completion Plan
   * Stage 3) and surfaced on both GET /decks and GET /decks/:id.
   */
  lastReviewedAt: z.string().nullable(),
})

// ─── Premade decks ────────────────────────────────────────────────────────────

export const ApiPremadeDeckSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().nullable(),
  deckType:    deckTypeSchema,
  jlptLevel:   jlptLevelSchema.nullable(),
  domain:      z.string().nullable(),
  cardCount:   z.number(),
  // `version` removed in Backend Completion Plan Stage 4 (copy model) —
  // there is no version drift to track once a user has copied; refreshing
  // content means deleting the deck and copying again.
  isActive:    z.boolean(),
  createdAt:   z.string(),
  updatedAt:   z.string(),
})

/**
 * Result of `POST /api/v1/premade-decks/:id/copy` — Backend Completion Plan
 * Stage 4 (copy model). The user-facing response carries only the
 * newly-created deck id and the count of cards cloned into it; everything
 * else lives on the deck itself and is reachable via `GET /api/v1/decks/:id`.
 *
 * Replaces the prior `ApiSubscribeResult` shape: the subscription junction
 * (and therefore `subscriptionId` / `alreadyExisted`) no longer exists.
 * Duplicates are intentional under the copy model — two consecutive copies
 * of the same premade deck produce two independent `deckId` values.
 */
export const ApiCopyPremadeDeckResultSchema = z.object({
  deckId:    z.string(),
  cardCount: z.number(),
})

/**
 * Result of `POST /api/v1/decks/:id/copy` — duplicates a user-owned deck
 * into a new standalone deck. Same wire shape as the premade copy result;
 * we keep them as separate types because the two routes have different
 * semantics (this one rejects premade source rows, doesn't carry
 * `source_premade_id`, and resolves a server-side default name).
 *
 * Duplicates are intentional under the copy model: repeated calls produce
 * independent decks. The controller's idempotency-key guards against
 * accidental double-clicks; deliberate duplicates use distinct keys.
 */
export const ApiCopyDeckResultSchema = z.object({
  deckId:    z.string(),
  cardCount: z.number(),
})

// ─── Insights — maturity-pipeline history (Stage 9) ──────────────────────────
//
// Backend Completion Plan Stage 9. `GET /api/v1/insights/maturity-history?days=…`
// returns up to N days of `(date, new_count, learning_count, review_count,
// relearning_count, mature_count)`. Powers the Progress page's stacked-area
// maturity-pipeline chart.
//
// Historical rows are populated by a daily cron writing into the
// `card_state_snapshots` table; today's row is always computed live from
// the cards table so the chart reflects the current moment between cron
// runs. See `supabase/migrations/20260610000000_card_state_snapshots.sql`.

export const ApiMaturityHistoryDaysSchema = z.enum(['90', '180', '365'])

export const ApiMaturitySnapshotSchema = z.object({
  /** ISO YYYY-MM-DD in the learner's local timezone. */
  date:            z.string(),
  newCount:        z.number().int().nonnegative(),
  learningCount:   z.number().int().nonnegative(),
  reviewCount:     z.number().int().nonnegative(),
  relearningCount: z.number().int().nonnegative(),
  matureCount:     z.number().int().nonnegative(),
})

// ─── Insights — card-quality issue counts (Stage 8) ──────────────────────────
//
// Backend Completion Plan Stage 8. `GET /api/v1/insights/card-quality`
// returns one row per issue type, surfacing how many of the user's
// vocabulary+grammar cards are missing a given content field. Sentence-
// layout cards are excluded — their fields_data shape is intentionally
// open and doesn't carry these keys.
//
// The enum mirrors the SQL RPC's `issue_type` values exactly. The
// frontend `CardsQualityBars` component currently uses a different
// (kebab-case) enum — that mismatch is a known frontend follow-up; the
// backend ships the plan's six types as-is.

export const ApiCardQualityIssueTypeSchema = z.enum([
  'missing_reading',
  'missing_meaning',
  'missing_example',
  'missing_mnemonic',
  'missing_picture',
  'missing_nuance',
])

export const ApiCardQualityIssueSchema = z.object({
  issueType: ApiCardQualityIssueTypeSchema,
  /** Number of the user's vocabulary+grammar cards that exhibit this issue. */
  count:     z.number().int().nonnegative(),
})

// ─── Tomo daily note ──────────────────────────────────────────────────────────
//
// `GET /api/v1/tomo/note` returns one learner-scoped, learner-day-scoped
// note. The frontend hook was retired in the dead-code sweep, but the
// backend service still composes this shape internally — the wire types
// stay defined here so the API layer doesn't fork its own copy.

export const ApiTomoNoteKindSchema = z.enum(['insight', 'idiom'])

export const ApiTomoNoteSchema = z.object({
  body:    z.string(),
  kind:    ApiTomoNoteKindSchema,
  dateKey: z.string(),
})

// ─── Reviews ──────────────────────────────────────────────────────────────────

export const ApiForecastDaySchema = z.object({
  date:         z.string(),
  count:        z.number(),
  backlogCount: z.number(),
  reviewCount:  z.number(),
  newCount:     z.number(),
})

/** Generic batch result — caller passes the per-item schema. */
export const ApiBatchResultSchema = <T>(
  item: z.ZodType<T>,
): z.ZodObject<{
  results: z.ZodArray<z.ZodType<T>>
  errors:  z.ZodArray<z.ZodObject<{ cardId: z.ZodString; error: z.ZodString }>>
}> =>
  z.object({
    results: z.array(item),
    errors:  z.array(z.object({ cardId: z.string(), error: z.string() })),
  })

/**
 * Universal list response envelope. Every endpoint that returns a list of
 * resources wraps its items in this shape. `nextCursor` is null and
 * `hasMore` is false on endpoints that aren't actually cursor-paginated
 * (bounded responses, fixed-dimension analytics arrays); the shape stays
 * uniform so adding pagination later is non-breaking.
 */
export const apiListEnvelope = <T>(
  item: z.ZodType<T>,
): z.ZodObject<{
  items:      z.ZodArray<z.ZodType<T>>
  nextCursor: z.ZodNullable<z.ZodString>
  hasMore:    z.ZodBoolean
  totalCount: z.ZodOptional<z.ZodNumber>
}> =>
  z.object({
    items:      z.array(item),
    nextCursor: z.string().nullable(),
    hasMore:    z.boolean(),
    totalCount: z.number().optional(),
  })

export const ApiReviewedCardSchema = z.object({
  id:            z.string(),
  /** UUID of the `review_logs` row this review created.
   *  Nullable for service-internal callers (forget/reschedule/batch flushes)
   *  where surfacing rollback isn't part of the contract today. The submit
   *  path always populates it so the Review Summary can offer per-card
   *  rollback. */
  reviewLogId:   z.string().uuid().nullable(),
  due:           z.string(),
  stability:     z.number(),
  difficulty:    z.number(),
  scheduledDays: z.number(),
  state:         stateSchema,
})

/**
 * Response of POST /api/v1/reviews/submit. The raw reviewed-card shape (no
 * wrapper) — kept as an exported alias so callers that imported the old
 * symbol remain compatible.
 */
export const ApiReviewSubmitResponseSchema = ApiReviewedCardSchema

// ─── Analytics ────────────────────────────────────────────────────────────────

export const ApiHeatmapDaySchema = z.object({
  date:         z.string(),
  retention:    z.number(),
  count:        z.number(),
  /**
   * Total time spent reviewing on this day, in seconds. Derived from
   * `review_logs.review_time_ms` by `get_heatmap_data`; zero if no
   * reviews carried a duration (pre-instrumentation rows COALESCE to 0).
   * Powers the Statistics page's activity-strip total-time figure.
   */
  totalSeconds: z.number().int().nonnegative(),
})

export const ApiLayoutAccuracySchema = z.object({
  layoutType:  layoutTypeSchema,
  total:       z.number(),
  successful:  z.number(),
  accuracyPct: z.number(),
})

export const ApiJlptGapSchema = z.object({
  jlptLevel:   jlptLevelSchema,
  total:       z.number(),
  learned:     z.number(),
  due:         z.number(),
  progressPct: z.number(),
})

export const ApiMilestoneForecastSchema = z.object({
  jlptLevel:               jlptLevelSchema,
  total:                   z.number(),
  learned:                 z.number(),
  dailyPace:               z.number(),
  daysRemaining:           z.number().nullable(),
  projectedCompletionDate: z.string().nullable(),
})

/**
 * Bundled response for GET /api/v1/analytics/dashboard. Combines the four
 * granular analytics responses into one envelope so the analytics page makes
 * a single round-trip instead of four. The granular endpoints remain available
 * for partial refreshes.
 *
 * Stage 8 (migration `20260604000000_remove_legacy_streaks.sql`) dropped the
 * `streak` field — the legacy streak surface was removed end-to-end. The
 * server-side `get_dashboard_data` RPC matches this shape; frontend consumers
 * were updated in the same commit.
 */
export const ApiAnalyticsDashboardSchema = z.object({
  heatmap:    apiListEnvelope(ApiHeatmapDaySchema),
  accuracy:   apiListEnvelope(ApiLayoutAccuracySchema),
  jlptGap:    apiListEnvelope(ApiJlptGapSchema),
  milestones: apiListEnvelope(ApiMilestoneForecastSchema),
  /**
   * Cards added in the learner's current calendar month (tz-aware).
   * Powers the Progress page's "added this month" summary tile.
   * Zero for accounts with no cards or no cards created since the
   * month-boundary.
   */
  cardsAddedThisMonth: z.number().int().nonnegative(),
})

// ─── Insights distributions (Statistics page) ─────────────────────────────────
//
// Bundle endpoint at GET /api/v1/insights/distributions. Mirrors the
// dashboard bundle pattern — four sub-queries, one round-trip, one
// React Query cache entry. Each histogram emits a stable shape
// (server-defined bucket labels) so frontend chart consumers don't
// have to re-derive labels.

export const ApiAnswerRatingDistributionSchema = z.object({
  again: z.number().int().nonnegative(),
  hard:  z.number().int().nonnegative(),
  good:  z.number().int().nonnegative(),
  easy:  z.number().int().nonnegative(),
})

export const ApiHistogramBucketSchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
})

export const ApiInsightsDistributionsSchema = z.object({
  ratings:    ApiAnswerRatingDistributionSchema,
  intervals:  z.array(ApiHistogramBucketSchema),
  stability:  z.array(ApiHistogramBucketSchema),
  difficulty: z.array(ApiHistogramBucketSchema),
})

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const ApiAuthTokensSchema = z.object({
  accessToken:  z.string(),
  refreshToken: z.string(),
  expiresIn:    z.number(),
})

export const ApiSignUpResultSchema = z.object({
  email: z.string(),
  // Null when the email is already registered — the API surfaces a generic
  // success shape to avoid leaking account existence to anonymous callers.
  userId: z.string().nullable(),
  // Server-issued one-time secret, paired with userId, required by /cancel-signup.
  // Null on the duplicate-email path (mirrors userId) so wire-level enumeration
  // surfaces only what userId already does.
  cancellationToken: z.string().nullable(),
})

// ─── Sessions / weakSpots (live in review.types.ts; cross the wire) ─────────────

export const SessionWeakSpotSchema = z.object({
  weakSpotId:      z.string(),
  cardId:       z.string(),
  deckId:       z.string(),
  word:         z.string(),
  reading:      z.string().nullable(),
  diagnosis:    z.string().nullable(),
  prescription: z.string().nullable(),
  resolved:     z.boolean(),
  createdAt:    z.string(),
})

export const SessionSummarySchema = z.object({
  sessionId:   z.string(),
  totalCards:  z.number(),
  totalTimeMs: z.number(),
  accuracyPct: z.number(),
  nextDueAt:   z.string().nullable(),
  ratingBreakdown: z.object({
    again: z.number(),
    hard:  z.number(),
    good:  z.number(),
    easy:  z.number(),
  }),
  weakSpots: z.array(SessionWeakSpotSchema),
})

// ─── WeakSpots list (read-only feature surface) ─────────────────────────────────
//
// Distinct from SessionWeakSpotSchema above: that schema lives in the post-review
// summary payload and intentionally carries only what the session UI shows.
// The dedicated /api/v1/weak-spots read path needs richer joined context (deck
// name, FSRS counters, due/last-review timestamps, resolved metadata), so the
// list shape is its own schema rather than overloading the session shape.
//
// Every joined field is nullable because `weakSpots.card_id` may be NULL after
// the underlying card row is deleted — the partial unique index on
// (card_id, user_id) WHERE resolved=FALSE permits this orphan state by
// design (migration 20260425000001).

export const ApiWeakSpotListItemSchema = z.object({
  id:           z.string().uuid(),
  cardId:       z.string().uuid().nullable(),
  deckId:       z.string().uuid().nullable(),
  deckName:     z.string().nullable(),
  word:         z.string().nullable(),
  reading:      z.string().nullable(),
  meaning:      z.string().nullable(),
  layoutType:   layoutTypeSchema.nullable(),
  jlptLevel:    jlptLevelSchema.nullable(),
  lapses:       z.number().int().nonnegative().nullable(),
  reps:         z.number().int().nonnegative().nullable(),
  due:          z.string().nullable(),
  lastReview:   z.string().nullable(),
  diagnosis:    z.string().nullable(),
  prescription: z.string().nullable(),
  resolved:     z.boolean(),
  resolvedAt:   z.string().nullable(),
  createdAt:    z.string(),
})

export const ApiWeakSpotListResponseSchema = z.object({
  items:      z.array(ApiWeakSpotListItemSchema),
  nextCursor: z.string().nullable(),
  hasMore:    z.boolean(),
})

// ─── Drill sessions (Stage 3) ─────────────────────────────────────────────────
//
// `POST /api/v1/weak-spots/drill-sessions` returns the session envelope plus the
// ordered queue. Each card carries its own `sessionCardId` — Stage 5's attempt
// endpoint will reference this ID (not the weakSpot or card IDs directly) so the
// composite FK against (id, session_id) on weak_spot_drill_session_cards makes
// cross-session attempt forgery structurally impossible.
//
// Card-derived fields are non-nullable on this shape — the RPC's WHERE clause
// already excluded orphan weakSpots (card_id NULL) and suspended cards before
// the snapshot was written.

export const ApiWeakSpotDrillCardSchema = z.object({
  sessionCardId: z.string().uuid(),
  weakSpotId:       z.string().uuid(),
  cardId:        z.string().uuid(),
  ordinal:       z.number().int().nonnegative(),
  layoutType:    layoutTypeSchema,
  fieldsData:    FieldsDataSchema,
  lapses:        z.number().int().nonnegative(),
})

export const ApiWeakSpotDrillSessionStatusSchema = z.enum(['active', 'finished', 'aborted'])

export const ApiWeakSpotDrillSessionSchema = z.object({
  sessionId: z.string().uuid(),
  status:    ApiWeakSpotDrillSessionStatusSchema,
  cards:     z.array(ApiWeakSpotDrillCardSchema),
})

// ─── Drill session resume (Stage 4) ───────────────────────────────────────────
//
// Distinct from ApiWeakSpotDrillCardSchema/ApiWeakSpotDrillSessionSchema (the
// create-time response) because resume carries:
//   • orphan rows where the underlying card was deleted post-snapshot
//     (cardId IS NULL on the wire, layoutType/fieldsData/lapses null too
//     because nothing remains to read from `cards`).
//   • per-row isStale and isOrphaned flags so the client doesn't need to
//     cross-reference cardIds against the top-level staleCards array.
//   • a top-level isCanonicalStateStale boolean and a staleCards array.
//
// Orphans never appear in staleCards — there's nothing to compare to, so
// staleness is meaningless for them. The frontend distinguishes orphan
// (card-deleted) from stale (card-reviewed-elsewhere) via the per-row flags.

export const ApiWeakSpotDrillSessionDetailCardSchema = z.object({
  sessionCardId: z.string().uuid(),
  weakSpotId:       z.string().uuid().nullable(),
  cardId:        z.string().uuid().nullable(),
  ordinal:       z.number().int().nonnegative(),
  layoutType:    layoutTypeSchema.nullable(),
  fieldsData:    FieldsDataSchema.nullable(),
  lapses:        z.number().int().nonnegative().nullable(),
  isOrphaned:    z.boolean(),
  isStale:       z.boolean(),
})

export const ApiWeakSpotDrillSessionDetailSchema = z.object({
  sessionId:             z.string().uuid(),
  status:                ApiWeakSpotDrillSessionStatusSchema,
  isCanonicalStateStale: z.boolean(),
  staleCards:            z.array(z.string().uuid()),
  cards:                 z.array(ApiWeakSpotDrillSessionDetailCardSchema),
})

// ─── Drill attempts (Stage 5) ─────────────────────────────────────────────────
//
// Immutable per-answer event. The DB's UNIQUE (user_id, event_id) makes
// `eventId` the structural idempotency identifier — a retry with the same
// eventId returns the original attempt's row, never duplicates.
//
// `weakSpotId`/`cardId` are nullable on the wire to mirror the orphan semantics
// of `weak_spot_drill_session_cards`: if the underlying weakSpot or card is deleted
// after an attempt is recorded, those references go NULL but the attempt
// itself stays inspectable as historical learning data.

export const ApiWeakSpotDrillAttemptResultSchema = z.enum(['missed', 'hesitated', 'remembered'])

export const ApiWeakSpotDrillAttemptSchema = z.object({
  attemptId:      z.string().uuid(),
  eventId:        z.string().uuid(),
  sessionId:      z.string().uuid(),
  sessionCardId:  z.string().uuid(),
  weakSpotId:        z.string().uuid().nullable(),
  cardId:         z.string().uuid().nullable(),
  result:         ApiWeakSpotDrillAttemptResultSchema,
  localSequence:  z.number().int().nonnegative().nullable(),
  responseTimeMs: z.number().int().nonnegative().nullable(),
  shownAt:        z.string().nullable(),
  answeredAt:     z.string(),
  createdAt:      z.string(),
})

// ─── User profile (lives in user.types.ts; crosses the wire) ──────────────────

export const ProfileSchema = z.object({
  id:                 z.string(),
  nativeLanguage:     z.string(),
  jlptTarget:         jlptLevelSchema.nullable(),
  studyGoal:          z.string().nullable(),
  interests:          z.array(z.string()),
  dailyNewCardsLimit: z.number(),
  dailyReviewLimit:   z.number(),
  retentionTarget:    z.number(),
  timezone:           z.string(),
  version:            z.number(),
  createdAt:          z.string(),
  updatedAt:          z.string(),
})

// ─── Helpers for void responses ──────────────────────────────────────────────

/** For 204 No Content / DELETE / PATCH endpoints that don't return a body. */
export const voidResponseSchema = z.unknown()
