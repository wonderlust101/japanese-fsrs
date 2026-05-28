/**
 * Zod schemas for every wire-format type the API returns to the web.
 * The TS types in `api.types.ts`, `review.types.ts`, and `user.types.ts`
 * are derived from these schemas via `z.infer` — schema-as-source so the
 * validator and the type cannot drift.
 *
 * Split into domain modules: api-core (enum bridges + generic envelope
 * helpers), api-card, api-deck, and api-weak-spot. This module keeps the
 * insights / content / reviews / analytics / auth / profile schemas inline
 * and re-exports the domain modules so existing ./api.schema import sites
 * (including the shared-types barrel in ../index.ts) keep resolving.
 */

import { z } from "zod";

import { apiListEnvelope, jlptLevelSchema, layoutTypeSchema, stateSchema } from "./api-core.schema.ts";

export * from "./api-card.schema.ts";
export { ApiBatchResultSchema, apiListEnvelope } from "./api-core.schema.ts";
export * from "./api-deck.schema.ts";
export * from "./api-weak-spot.schema.ts";

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

export const ApiMaturityHistoryDaysSchema = z.enum(["90", "180", "365"]);

export const ApiMaturitySnapshotSchema = z.object({
	/** ISO YYYY-MM-DD in the learner's local timezone. */
	date: z.string(),
	newCount: z.number().int().nonnegative(),
	learningCount: z.number().int().nonnegative(),
	reviewCount: z.number().int().nonnegative(),
	relearningCount: z.number().int().nonnegative(),
	matureCount: z.number().int().nonnegative(),
	/**
	 * Suspended cards (not in the pipeline). Historical rows predate this and
	 *  read 0; today's row is computed live. Powers the maturity-flow bar's
	 *  "Suspended" segment on the Statistics page.
	 */
	suspendedCount: z.number().int().nonnegative(),
});

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
	"missing_reading",
	"missing_meaning",
	"missing_example",
	"missing_mnemonic",
	"missing_picture",
	"missing_nuance",
]);

export const ApiCardQualityIssueSchema = z.object({
	issueType: ApiCardQualityIssueTypeSchema,
	/** Number of the user's vocabulary+grammar cards that exhibit this issue. */
	count: z.number().int().nonnegative(),
});

// ─── Tomo daily note ──────────────────────────────────────────────────────────
//
// `GET /api/v1/tomo/note` returns one learner-scoped, learner-day-scoped
// note. The frontend hook was retired in the dead-code sweep, but the
// backend service still composes this shape internally — the wire types
// stay defined here so the API layer doesn't fork its own copy.

export const ApiTomoNoteKindSchema = z.enum(["insight", "idiom"]);

export const ApiTomoNoteSchema = z.object({
	body: z.string(),
	kind: ApiTomoNoteKindSchema,
	dateKey: z.string(),
});

// ─── Day reflection (post-session AI note) ───────────────────────────────────
//
// `GET /api/v1/reviews/day-reflection/:sessionId` returns one Tomo-voice
// reflection on the user's entire review work for the day that contains the
// given session. Aggregates across all sessions on the user's local date;
// regenerates on each new same-day session via session-id fingerprinting.
// `source` tells the client whether the body came from the AI generator or
// from the rule-based fallback (when the AI path is unavailable).

export const ApiDayReflectionSourceSchema = z.enum(["ai", "fallback"]);

export const ApiDayReflectionSchema = z.object({
	body: z.string(),
	source: ApiDayReflectionSourceSchema,
	dateKey: z.string(),
	sessionCount: z.number().int().nonnegative(),
});

// ─── Reviews ──────────────────────────────────────────────────────────────────

/**
 * One outcome of `previewNextStates` for a single rating. `scheduledDays` is
 * the FSRS-computed interval and can be < 1 for fractional days (learning
 * steps). Frontend formats it for display.
 */
export const ApiRatingPreviewSchema = z.object({
	scheduledDays: z.number(),
	due: z.string(),
});

/** Anki-style "what happens if I rate this?" preview for the four ratings. */
export const ApiRatingsPreviewSchema = z.object({
	again: ApiRatingPreviewSchema,
	hard: ApiRatingPreviewSchema,
	good: ApiRatingPreviewSchema,
	easy: ApiRatingPreviewSchema,
});

export const ApiForecastDaySchema = z.object({
	date: z.string(),
	count: z.number(),
	backlogCount: z.number(),
	reviewCount: z.number(),
	newCount: z.number(),
});

export const ApiReviewedCardSchema = z.object({
	id: z.string(),
	/**
	 * UUID of the `review_logs` row this review created.
	 *  Nullable for service-internal callers (forget/reschedule/batch flushes)
	 *  where surfacing rollback isn't part of the contract today. The submit
	 *  path always populates it so the Review Summary can offer per-card
	 *  rollback.
	 */
	reviewLogId: z.string().uuid().nullable(),
	due: z.string(),
	stability: z.number(),
	difficulty: z.number(),
	scheduledDays: z.number(),
	state: stateSchema,
});

/**
 * Response of POST /api/v1/reviews/submit. The raw reviewed-card shape (no
 * wrapper) — kept as an exported alias so callers that imported the old
 * symbol remain compatible.
 */
export const ApiReviewSubmitResponseSchema = ApiReviewedCardSchema;

// ─── Analytics ────────────────────────────────────────────────────────────────

export const ApiHeatmapDaySchema = z.object({
	date: z.string(),
	retention: z.number(),
	count: z.number(),
	/**
	 * Total time spent reviewing on this day, in seconds. Derived from
	 * `review_logs.review_time_ms` by `get_heatmap_data`; zero if no
	 * reviews carried a duration (pre-instrumentation rows COALESCE to 0).
	 * Powers the Statistics page's activity-strip total-time figure.
	 */
	totalSeconds: z.number().int().nonnegative(),
});

export const ApiLayoutAccuracySchema = z.object({
	layoutType: layoutTypeSchema,
	total: z.number(),
	successful: z.number(),
	accuracyPct: z.number(),
});

export const ApiJlptGapSchema = z.object({
	jlptLevel: jlptLevelSchema,
	total: z.number(),
	learned: z.number(),
	due: z.number(),
	progressPct: z.number(),
});

export const ApiMilestoneForecastSchema = z.object({
	jlptLevel: jlptLevelSchema,
	total: z.number(),
	learned: z.number(),
	dailyPace: z.number(),
	daysRemaining: z.number().nullable(),
	projectedCompletionDate: z.string().nullable(),
});

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
	heatmap: apiListEnvelope(ApiHeatmapDaySchema),
	accuracy: apiListEnvelope(ApiLayoutAccuracySchema),
	jlptGap: apiListEnvelope(ApiJlptGapSchema),
	milestones: apiListEnvelope(ApiMilestoneForecastSchema),
	/**
	 * Cards added in the learner's current calendar month (tz-aware).
	 * Powers the Progress page's "added this month" summary tile.
	 * Zero for accounts with no cards or no cards created since the
	 * month-boundary.
	 */
	cardsAddedThisMonth: z.number().int().nonnegative(),
});

// ─── Insights distributions (Statistics page) ─────────────────────────────────
//
// Bundle endpoint at GET /api/v1/insights/distributions. Mirrors the
// dashboard bundle pattern — four sub-queries, one round-trip, one
// React Query cache entry. Each histogram emits a stable shape
// (server-defined bucket labels) so frontend chart consumers don't
// have to re-derive labels.

export const ApiAnswerRatingDistributionSchema = z.object({
	again: z.number().int().nonnegative(),
	hard: z.number().int().nonnegative(),
	good: z.number().int().nonnegative(),
	easy: z.number().int().nonnegative(),
});

export const ApiHistogramBucketSchema = z.object({
	label: z.string(),
	count: z.number().int().nonnegative(),
});

export const ApiInsightsDistributionsSchema = z.object({
	ratings: ApiAnswerRatingDistributionSchema,
	intervals: z.array(ApiHistogramBucketSchema),
	stability: z.array(ApiHistogramBucketSchema),
	difficulty: z.array(ApiHistogramBucketSchema),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const ApiAuthTokensSchema = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	expiresIn: z.number(),
});

export const ApiSignUpResultSchema = z.object({
	email: z.string(),
	// Null when the email is already registered — the API surfaces a generic
	// success shape to avoid leaking account existence to anonymous callers.
	userId: z.string().nullable(),
	// Server-issued one-time secret, paired with userId, required by /cancel-signup.
	// Null on the duplicate-email path (mirrors userId) so wire-level enumeration
	// surfaces only what userId already does.
	cancellationToken: z.string().nullable(),
});

// ─── User profile (lives in user.types.ts; crosses the wire) ──────────────────

export const ProfileSchema = z.object({
	id: z.string(),
	nativeLanguage: z.string(),
	jlptTarget: jlptLevelSchema.nullable(),
	studyGoal: z.string().nullable(),
	interests: z.array(z.string()),
	dailyNewCardsLimit: z.number(),
	dailyReviewLimit: z.number(),
	retentionTarget: z.number(),
	timezone: z.string(),
	version: z.number(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

// ─── Helpers for void responses ──────────────────────────────────────────────

/** For 204 No Content / DELETE / PATCH endpoints that don't return a body. */
export const voidResponseSchema = z.unknown();
