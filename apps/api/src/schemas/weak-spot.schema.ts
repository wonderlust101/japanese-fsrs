import { jlptLevelEnum } from "@fsrs-japanese/shared-types";

import { z } from "zod";

// ─── Filters / sort ───────────────────────────────────────────────────────────

export const weakSpotStatusEnum = z.enum(["unresolved", "resolved"]);
export type WeakSpotStatusFilter = z.infer<typeof weakSpotStatusEnum>;

/**
 * MVP sort options for the weakSpots list. `mostRecent` is the default and uses
 *  the (created_at DESC, id DESC) tuple cursor — both columns are immutable on
 *  `weakSpots`, so the cursor is stable across concurrent UPDATEs (resolve flips
 *  do not move a row in the index). `mostLapses` and `deckOrder` use head sort
 *  keys on the joined `cards` row (`cards.lapses`, `cards.deck_id`), so cursor
 *  pagination over those sorts is intentionally disabled in the service layer
 *  until an RPC can express the tuple comparison atomically.
 */
export const weakSpotSortEnum = z.enum([
	"mostRecent",
	"oldestUnresolved",
	"mostLapses",
	"deckOrder",
]);
export type WeakSpotSortOrder = z.infer<typeof weakSpotSortEnum>;

/**
 * Diagnosis filter dimension for the weakSpots list. The spec's third arm,
 *  "not included in plan," was an entitlement-tier signal — Stage 7 removed
 *  the tier model (all features are free for the MVP), so this enum stays at
 *  the two column-based arms. The arm can be reintroduced if monetization
 *  ever returns.
 */
export const weakSpotDiagnosisFilterEnum = z.enum(["available", "missing"]);
export type WeakSpotDiagnosisFilter = z.infer<typeof weakSpotDiagnosisFilterEnum>;

// ─── Query / param schemas ────────────────────────────────────────────────────

export const listWeakSpotsQuerySchema = z.object({
	status: weakSpotStatusEnum.default("unresolved"),
	deckId: z.string().uuid("Invalid deck ID").optional(),
	jlptLevel: jlptLevelEnum.optional(),
	diagnosis: weakSpotDiagnosisFilterEnum.optional(),
	sort: weakSpotSortEnum.default("mostRecent"),
	// Optional override for the primary sort direction. When omitted, each sort
	// mode uses its natural default (newest / most lapses / first deck). The
	// client splits sort into an axis (this `sort`) plus a direction toggle,
	// mirroring the Cards browser's count-line control.
	sortDir: z.enum(["asc", "desc"]).optional(),
	// Free-text search across the joined card's word / reading / meaning.
	// Trimmed; an all-whitespace value is treated as "no search" by the
	// service. Capped so a pathological query can't bloat the PostgREST filter.
	search: z.string().max(100).optional(),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	// Offset pagination (mirrors the cross-deck cards list as of
	// 20260630000003). The client multiplies the 0-indexed page by the page
	// size; the service translates this to a Supabase `.range()` window. Coerced
	// because it arrives as a query-string value. The `.max()` is a safety guard
	// (not a product limit) against a pathological deep offset (e.g. 1e8) forcing
	// Postgres into a huge scan-and-skip: the weakSpots list is lapse-gated and
	// small, so 10k (≈ page 100 at the 100-row max) is far beyond any real depth.
	offset: z.coerce.number().int().min(0).max(10_000).default(0),
}).strict();

export type ListWeakSpotsQuery = z.infer<typeof listWeakSpotsQuerySchema>;

export const weakSpotIdParamSchema = z.object({
	id: z.string().uuid("Invalid weakSpot ID"),
}).strict();

/** URL param schema for `GET /api/v1/weak-spots/drill-sessions/:sessionId`. */
export const drillSessionIdParamSchema = z.object({
	sessionId: z.string().uuid("Invalid drill session ID"),
}).strict();

// ─── Drill attempts (Stage 5) ─────────────────────────────────────────────────

export const weakSpotDrillAttemptResultEnum = z.enum(["missed", "hesitated", "remembered"]);
export type WeakSpotDrillAttemptResult = z.infer<typeof weakSpotDrillAttemptResultEnum>;

/**
 * Body schema for `POST /api/v1/weak-spots/drill-sessions/:sessionId/attempts`.
 *
 *  - `eventId` is the client-generated domain idempotency key. The DB's
 *    `UNIQUE (user_id, event_id)` enforces exactly-once delivery: retrying
 *    with the same eventId returns the original attempt's row.
 *  - `cardId` and `weakSpotId` are OPTIONAL consistency assertions. If present,
 *    they must match the canonical values on the session-card row, or the
 *    RPC rejects the attempt with 422 WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH.
 *    The wire INSERT always uses the canonical values, never the body's.
 */
export const recordDrillAttemptSchema = z.object({
	eventId: z.string().uuid("Invalid event ID"),
	sessionCardId: z.string().uuid("Invalid session card ID"),
	weakSpotId: z.string().uuid("Invalid weakSpot ID").optional(),
	cardId: z.string().uuid("Invalid card ID").optional(),
	result: weakSpotDrillAttemptResultEnum,
	localSequence: z.number().int().nonnegative().optional(),
	responseTimeMs: z.number().int().nonnegative().optional(),
	shownAt: z.string().datetime().optional(),
	answeredAt: z.string().datetime().optional(),
}).strict();

export type RecordDrillAttemptInput = z.infer<typeof recordDrillAttemptSchema>;

// ─── Cursor payloads ──────────────────────────────────────────────────────────
//
// One schema per sort mode. The encoded cursor carries both keys of the sort
// tuple so the SQL can keyset-paginate without re-scanning skipped rows.

export const weakSpotCreatedAtCursorSchema = z.object({
	createdAt: z.string().datetime(),
	id: z.string().uuid(),
});
export type WeakSpotCreatedAtCursor = z.infer<typeof weakSpotCreatedAtCursorSchema>;

export const weakSpotLapsesCursorSchema = z.object({
	lapses: z.number().int().nonnegative().nullable(),
	createdAt: z.string().datetime(),
	id: z.string().uuid(),
});
export type WeakSpotLapsesCursor = z.infer<typeof weakSpotLapsesCursorSchema>;

// ─── Drill session creation (Stage 3) ─────────────────────────────────────────
//
// Wire enum values are camelCase per the API conventions (see CLAUDE.md). The
// service-layer mapper translates them to the snake_case CHECK-constraint
// values stored in the database. The DB CHECK admits all five spec source
// values; the TS enum is intentionally narrower until later stages implement
// the remaining sources.

// All five spec source values are now wired through (Stage 6). The DB CHECK
// admits the same five; the service-layer mapper translates camelCase here
// to snake_case for the RPC.
export const weakSpotDrillSourceEnum = z.enum([
	"unresolvedWeakSpots",
	"deckScoped",
	"highLapseCandidates",
	"manualSelection",
	"currentCard",
]);
export const weakSpotDrillModeEnum = z.enum(["practice", "timed"]);
export const weakSpotDrillRepeatPolicyEnum = z.enum(["none", "missedAfterLag"]);

export type WeakSpotDrillSource = z.infer<typeof weakSpotDrillSourceEnum>;
export type WeakSpotDrillMode = z.infer<typeof weakSpotDrillModeEnum>;
export type WeakSpotDrillRepeatPolicy = z.infer<typeof weakSpotDrillRepeatPolicyEnum>;

export const createDrillSessionSchema = z.object({
	source: weakSpotDrillSourceEnum.default("unresolvedWeakSpots"),
	deckId: z.string().uuid("Invalid deck ID").optional(),
	jlptLevel: jlptLevelEnum.optional(),
	// manualSelection-only: explicit list of card IDs to drill. Bounded 1-50
	// to match the per-session drill limit cap.
	cardIds: z.array(z.string().uuid("Invalid card ID")).min(1).max(50).optional(),
	// currentCard-only: single card ID.
	cardId: z.string().uuid("Invalid card ID").optional(),
	// highLapseCandidates-only: lapse threshold for "near-weakSpot" candidates.
	// Default 3 is applied server-side in the RPC if omitted; bounded here so
	// callers can't request 0 (every card matches) or absurdly large values.
	minLapses: z.number().int().min(1).max(20).optional(),
	// Reuse the list endpoint's sort enum so frontends only learn one vocabulary.
	order: weakSpotSortEnum.default("mostLapses"),
	// Drill caps tighter than the list endpoint (max 100) — a focused session
	// is meaningfully different from a management list view.
	limit: z.number().int().min(1).max(50).default(20),
	mode: weakSpotDrillModeEnum.default("practice"),
	repeatPolicy: weakSpotDrillRepeatPolicyEnum.default("missedAfterLag"),
	// Reserved for Stage 4+ (timed-mode stop conditions). Accepted as an opaque
	// object today; the DB CHECK guarantees `jsonb_typeof(stop_rule) = 'object'`.
	stopRule: z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((val, ctx) => {
	// Per-source required-field assertions. Each rule emits a field-targeted
	// issue so the frontend can highlight the right input.
	if (val.source === "deckScoped" && val.deckId === undefined) {
		ctx.addIssue({
			code: "custom",
			path: ["deckId"],
			message: "deckId is required when source is \"deckScoped\"",
		});
	}
	if (val.source === "manualSelection" && (val.cardIds === undefined || val.cardIds.length === 0)) {
		ctx.addIssue({
			code: "custom",
			path: ["cardIds"],
			message: "cardIds is required and non-empty when source is \"manualSelection\"",
		});
	}
	if (val.source === "currentCard" && val.cardId === undefined) {
		ctx.addIssue({
			code: "custom",
			path: ["cardId"],
			message: "cardId is required when source is \"currentCard\"",
		});
	}
});

export type CreateDrillSessionInput = z.infer<typeof createDrillSessionSchema>;

/**
 * Strict-empty body schema for any POST endpoint where the URL path encodes
 *  the entire intent (`/finish`, `/abort`, `/diagnose`). The `.strict()` keeps
 *  unknown body keys from being silently accepted: any future feature that
 *  wants to add a body field has to bump the per-endpoint schema explicitly,
 *  which forces the design decision into view rather than allowing drift.
 */
export const emptyBodySchema = z.object({}).strict();
