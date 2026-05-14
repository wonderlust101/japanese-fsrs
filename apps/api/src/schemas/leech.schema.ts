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

/** Diagnosis filter dimension for the leeches list. The third spec arm —
 *  "not included in plan" — is intentionally omitted here because it is a
 *  paid-tier entitlement signal, not a column filter. When entitlements ship,
 *  add a third arm in this enum and a matching branch in the service. */
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

export const leechDrillSourceEnum       = z.enum(['unresolvedLeeches', 'deckScoped'])
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
}).strict().refine(
  (val) => val.source !== 'deckScoped' || val.deckId !== undefined,
  { message: 'deckId is required when source is "deckScoped"', path: ['deckId'] },
)

export type CreateDrillSessionInput = z.infer<typeof createDrillSessionSchema>
