// Weak-spot, drill-session, and review-session wire-format schemas. Lifted out
// of api.schema.ts; re-exported from there.

import { z } from "zod";

import { jlptLevelSchema, layoutTypeSchema } from "./api-core.schema.ts";
import { FieldsDataSchema } from "./field-shapes.schema.ts";

// ─── Sessions / weakSpots (live in review.types.ts; cross the wire) ─────────────

export const SessionWeakSpotSchema = z.object({
	weakSpotId: z.string(),
	cardId: z.string(),
	deckId: z.string(),
	word: z.string(),
	reading: z.string().nullable(),
	diagnosis: z.string().nullable(),
	prescription: z.string().nullable(),
	resolved: z.boolean(),
	createdAt: z.string(),
	// Lapse count from the parent card. Optional so legacy summary payloads
	// (and the backend until it ships the join) keep parsing. When present,
	// the summary surface renders a HealthBadge-style chip showing the
	// count, matching the cards-table treatment.
	lapses: z.number().int().nonnegative().optional(),
	// ISO timestamp of the most recent lapse on the parent card. Optional
	// for the same backwards-compat reason as `lapses`. Surfaced in the
	// summary's weak-spots list as a relative "Nd ago" date so a learner
	// can see at a glance whether each weak spot is fresh or stale.
	lastLapseAt: z.string().optional(),
});

export const SessionSummarySchema = z.object({
	sessionId: z.string(),
	totalCards: z.number(),
	totalTimeMs: z.number(),
	accuracyPct: z.number(),
	nextDueAt: z.string().nullable(),
	ratingBreakdown: z.object({
		again: z.number(),
		hard: z.number(),
		good: z.number(),
		easy: z.number(),
	}),
	weakSpots: z.array(SessionWeakSpotSchema),
	// User's total session count, capped at 2 by the RPC. 1 = first session
	// ever (drives the "First session" copy variant); ≥2 = returning user.
	// Optional for backwards-compat with payloads emitted before migration
	// 2026MMDDHHMMSS_session_summary_extend; once that migration ships and
	// any in-flight responses age out, this becomes effectively required.
	userTotalSessions: z.number().int().nonnegative().optional(),
	// DISTINCT session_id count for the user-local day containing this
	// session. The closure card pluralizes its label ("Today's sessions
	// (N)") when this is > 1. Optional for the same backwards-compat
	// reason as `userTotalSessions`.
	sessionsToday: z.number().int().nonnegative().optional(),
});

// ─── Batch diagnose result ──────────────────────────────────────────────────
//
// `POST /api/v1/reviews/sessions/:sessionId/diagnose-weak-spots` returns a
// summary tally of how many weak spots were freshly diagnosed, skipped
// (already had a diagnosis), or failed (AI path error). The frontend
// re-fetches the session summary on success to pick up the new prose.

export const ApiBatchDiagnoseResultSchema = z.object({
	diagnosed: z.number().int().nonnegative(),
	skipped: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
});

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
	id: z.string().uuid(),
	cardId: z.string().uuid().nullable(),
	deckId: z.string().uuid().nullable(),
	deckName: z.string().nullable(),
	word: z.string().nullable(),
	reading: z.string().nullable(),
	meaning: z.string().nullable(),
	layoutType: layoutTypeSchema.nullable(),
	jlptLevel: jlptLevelSchema.nullable(),
	lapses: z.number().int().nonnegative().nullable(),
	reps: z.number().int().nonnegative().nullable(),
	due: z.string().nullable(),
	lastReview: z.string().nullable(),
	diagnosis: z.string().nullable(),
	prescription: z.string().nullable(),
	resolved: z.boolean(),
	resolvedAt: z.string().nullable(),
	createdAt: z.string(),
});

export const ApiWeakSpotListResponseSchema = z.object({
	items: z.array(ApiWeakSpotListItemSchema),
	// Offset pagination (aligned with the cross-deck cards list). `totalCount`
	// is the full count of rows matching the active filters, independent of the
	// current page window, so the client can render numbered pages and a
	// "Showing X–Y of N" footer. The historic cursor model (`nextCursor` /
	// `hasMore`) was dropped: two of the four sort orders sort on a joined card
	// column and never supported keyset cursors anyway, so a single offset path
	// is both simpler and more capable.
	totalCount: z.number().int().nonnegative(),
});

// ─── Drill sessions (Stage 3) ─────────────────────────────────────────────────
//
// `POST /api/v1/weak-spots/drill-sessions` returns the session envelope plus the
// ordered queue. Each card carries its own `sessionCardId` — Stage 5's attempt
// endpoint will reference this ID (not the weakSpot or card IDs directly) so the
// composite FK against (id, session_id) on weak_spot_drill_session_cards makes
// cross-session attempt forgery structurally impossible.
//
// Card-derived fields (cardId, layoutType, fieldsData, lapses) are non-nullable
// on this shape — the RPC's WHERE clause already excluded orphan weakSpots
// (card_id NULL) and suspended cards before the snapshot was written.
// `weakSpotId` is the exception: the `high_lapse_candidates` source queues cards
// that have no associated weak-spot row yet, so the RPC returns it as null there.

export const ApiWeakSpotDrillCardSchema = z.object({
	sessionCardId: z.string().uuid(),
	weakSpotId: z.string().uuid().nullable(),
	cardId: z.string().uuid(),
	ordinal: z.number().int().nonnegative(),
	layoutType: layoutTypeSchema,
	fieldsData: FieldsDataSchema,
	lapses: z.number().int().nonnegative(),
});

export const ApiWeakSpotDrillSessionStatusSchema = z.enum(["active", "finished", "aborted"]);

export const ApiWeakSpotDrillSessionSchema = z.object({
	sessionId: z.string().uuid(),
	status: ApiWeakSpotDrillSessionStatusSchema,
	cards: z.array(ApiWeakSpotDrillCardSchema),
});

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
	weakSpotId: z.string().uuid().nullable(),
	cardId: z.string().uuid().nullable(),
	ordinal: z.number().int().nonnegative(),
	layoutType: layoutTypeSchema.nullable(),
	fieldsData: FieldsDataSchema.nullable(),
	lapses: z.number().int().nonnegative().nullable(),
	isOrphaned: z.boolean(),
	isStale: z.boolean(),
});

export const ApiWeakSpotDrillSessionDetailSchema = z.object({
	sessionId: z.string().uuid(),
	status: ApiWeakSpotDrillSessionStatusSchema,
	isCanonicalStateStale: z.boolean(),
	staleCards: z.array(z.string().uuid()),
	cards: z.array(ApiWeakSpotDrillSessionDetailCardSchema),
});

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

export const ApiWeakSpotDrillAttemptResultSchema = z.enum(["missed", "hesitated", "remembered"]);

export const ApiWeakSpotDrillAttemptSchema = z.object({
	attemptId: z.string().uuid(),
	eventId: z.string().uuid(),
	sessionId: z.string().uuid(),
	sessionCardId: z.string().uuid(),
	weakSpotId: z.string().uuid().nullable(),
	cardId: z.string().uuid().nullable(),
	result: ApiWeakSpotDrillAttemptResultSchema,
	localSequence: z.number().int().nonnegative().nullable(),
	responseTimeMs: z.number().int().nonnegative().nullable(),
	shownAt: z.string().nullable(),
	answeredAt: z.string(),
	createdAt: z.string(),
});
