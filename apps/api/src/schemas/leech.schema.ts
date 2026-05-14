import { z } from 'zod'

import { cardTypeEnum, jlptLevelEnum } from '@fsrs-japanese/shared-types'

// ─── Filters / sort ───────────────────────────────────────────────────────────

export const leechStatusEnum = z.enum(['unresolved', 'resolved'])
export type LeechStatusFilter = z.infer<typeof leechStatusEnum>

/** MVP sort options for the leeches list. `mostRecent` is the default and uses
 *  the (created_at DESC, id DESC) tuple cursor — both columns are immutable on
 *  `leeches`, so the cursor is stable across concurrent UPDATEs (resolve flips
 *  do not move a row in the index). `mostLapses` and `deckOrder` use head sort
 *  keys on the joined `cards` row (`cards.lapses`, `cards.deck_id`), so cursor
 *  pagination over those sorts is intentionally disabled in the service layer
 *  until an RPC can express the tuple comparison atomically. */
export const leechSortEnum = z.enum([
  'mostRecent',
  'oldestUnresolved',
  'mostLapses',
  'deckOrder',
])
export type LeechSortOrder = z.infer<typeof leechSortEnum>

/** Diagnosis filter dimension for the leeches list. The spec's third arm,
 *  "not included in plan," was an entitlement-tier signal — Stage 7 removed
 *  the tier model (all features are free for the MVP), so this enum stays at
 *  the two column-based arms. The arm can be reintroduced if monetization
 *  ever returns. */
export const leechDiagnosisFilterEnum = z.enum(['available', 'missing'])
export type LeechDiagnosisFilter = z.infer<typeof leechDiagnosisFilterEnum>

// ─── Query / param schemas ────────────────────────────────────────────────────

export const listLeechesQuerySchema = z.object({
  status:     leechStatusEnum.default('unresolved'),
  deckId:     z.string().uuid('Invalid deck ID').optional(),
  jlptLevel:  jlptLevelEnum.optional(),
  cardType:   cardTypeEnum.optional(),
  diagnosis:  leechDiagnosisFilterEnum.optional(),
  sort:       leechSortEnum.default('mostRecent'),
  limit:      z.coerce.number().int().min(1).max(100).default(50),
  // Opaque base64url-encoded cursor. Same length budget as the cards/decks
  // list endpoints; precise shape validation happens at decode time and a
  // malformed value surfaces as a 400 with code 'CURSOR_INVALID'.
  cursor:     z.string().min(1).max(512).optional(),
}).strict()

export type ListLeechesQuery = z.infer<typeof listLeechesQuerySchema>

export const leechIdParamSchema = z.object({
  id: z.string().uuid('Invalid leech ID'),
}).strict()

/** URL param schema for `GET /api/v1/leeches/drill-sessions/:sessionId`. */
export const drillSessionIdParamSchema = z.object({
  sessionId: z.string().uuid('Invalid drill session ID'),
}).strict()

// ─── Drill attempts (Stage 5) ─────────────────────────────────────────────────

export const leechDrillAttemptResultEnum = z.enum(['missed', 'hesitated', 'remembered'])
export type LeechDrillAttemptResult = z.infer<typeof leechDrillAttemptResultEnum>

/** Body schema for `POST /api/v1/leeches/drill-sessions/:sessionId/attempts`.
 *
 *  - `eventId` is the client-generated domain idempotency key. The DB's
 *    `UNIQUE (user_id, event_id)` enforces exactly-once delivery: retrying
 *    with the same eventId returns the original attempt's row.
 *  - `cardId` and `leechId` are OPTIONAL consistency assertions. If present,
 *    they must match the canonical values on the session-card row, or the
 *    RPC rejects the attempt with 422 LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH.
 *    The wire INSERT always uses the canonical values, never the body's.
 */
export const recordDrillAttemptSchema = z.object({
  eventId:        z.string().uuid('Invalid event ID'),
  sessionCardId:  z.string().uuid('Invalid session card ID'),
  leechId:        z.string().uuid('Invalid leech ID').optional(),
  cardId:         z.string().uuid('Invalid card ID').optional(),
  result:         leechDrillAttemptResultEnum,
  localSequence:  z.number().int().nonnegative().optional(),
  responseTimeMs: z.number().int().nonnegative().optional(),
  shownAt:        z.string().datetime().optional(),
  answeredAt:     z.string().datetime().optional(),
}).strict()

export type RecordDrillAttemptInput = z.infer<typeof recordDrillAttemptSchema>

// ─── Cursor payloads ──────────────────────────────────────────────────────────
//
// One schema per sort mode. The encoded cursor carries both keys of the sort
// tuple so the SQL can keyset-paginate without re-scanning skipped rows.

export const leechCreatedAtCursorSchema = z.object({
  createdAt: z.string().datetime(),
  id:        z.string().uuid(),
})
export type LeechCreatedAtCursor = z.infer<typeof leechCreatedAtCursorSchema>

export const leechLapsesCursorSchema = z.object({
  lapses:    z.number().int().nonnegative().nullable(),
  createdAt: z.string().datetime(),
  id:        z.string().uuid(),
})
export type LeechLapsesCursor = z.infer<typeof leechLapsesCursorSchema>

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
export const leechDrillSourceEnum = z.enum([
  'unresolvedLeeches',
  'deckScoped',
  'highLapseCandidates',
  'manualSelection',
  'currentCard',
])
export const leechDrillModeEnum         = z.enum(['practice', 'timed'])
export const leechDrillRepeatPolicyEnum = z.enum(['none', 'missedAfterLag'])

export type LeechDrillSource       = z.infer<typeof leechDrillSourceEnum>
export type LeechDrillMode         = z.infer<typeof leechDrillModeEnum>
export type LeechDrillRepeatPolicy = z.infer<typeof leechDrillRepeatPolicyEnum>

export const createDrillSessionSchema = z.object({
  source:       leechDrillSourceEnum.default('unresolvedLeeches'),
  deckId:       z.string().uuid('Invalid deck ID').optional(),
  jlptLevel:    jlptLevelEnum.optional(),
  cardType:     cardTypeEnum.optional(),
  // manualSelection-only: explicit list of card IDs to drill. Bounded 1-50
  // to match the per-session drill limit cap.
  cardIds:      z.array(z.string().uuid('Invalid card ID')).min(1).max(50).optional(),
  // currentCard-only: single card ID.
  cardId:       z.string().uuid('Invalid card ID').optional(),
  // highLapseCandidates-only: lapse threshold for "near-leech" candidates.
  // Default 3 is applied server-side in the RPC if omitted; bounded here so
  // callers can't request 0 (every card matches) or absurdly large values.
  minLapses:    z.number().int().min(1).max(20).optional(),
  // Reuse the list endpoint's sort enum so frontends only learn one vocabulary.
  order:        leechSortEnum.default('mostLapses'),
  // Drill caps tighter than the list endpoint (max 100) — a focused session
  // is meaningfully different from a management list view.
  limit:        z.number().int().min(1).max(50).default(20),
  mode:         leechDrillModeEnum.default('practice'),
  repeatPolicy: leechDrillRepeatPolicyEnum.default('missedAfterLag'),
  // Reserved for Stage 4+ (timed-mode stop conditions). Accepted as an opaque
  // object today; the DB CHECK guarantees `jsonb_typeof(stop_rule) = 'object'`.
  stopRule:     z.record(z.string(), z.unknown()).default({}),
}).strict().superRefine((val, ctx) => {
  // Per-source required-field assertions. Each rule emits a field-targeted
  // issue so the frontend can highlight the right input.
  if (val.source === 'deckScoped' && val.deckId === undefined) {
    ctx.addIssue({
      code: 'custom', path: ['deckId'],
      message: 'deckId is required when source is "deckScoped"',
    })
  }
  if (val.source === 'manualSelection' && (val.cardIds === undefined || val.cardIds.length === 0)) {
    ctx.addIssue({
      code: 'custom', path: ['cardIds'],
      message: 'cardIds is required and non-empty when source is "manualSelection"',
    })
  }
  if (val.source === 'currentCard' && val.cardId === undefined) {
    ctx.addIssue({
      code: 'custom', path: ['cardId'],
      message: 'cardId is required when source is "currentCard"',
    })
  }
})

export type CreateDrillSessionInput = z.infer<typeof createDrillSessionSchema>

/** Strict-empty body schema for any POST endpoint where the URL path encodes
 *  the entire intent (`/finish`, `/abort`, `/diagnose`). The `.strict()` keeps
 *  unknown body keys from being silently accepted: any future feature that
 *  wants to add a body field has to bump the per-endpoint schema explicitly,
 *  which forces the design decision into view rather than allowing drift. */
export const emptyBodySchema = z.object({}).strict()
