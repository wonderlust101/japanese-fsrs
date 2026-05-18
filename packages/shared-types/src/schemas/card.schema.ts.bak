import { z } from 'zod'

import { JLPTLevel, LayoutType } from '../card.types.ts'

import { deepHasMarkup, deepHasOversizedString, safeShortText } from '../sanitize.ts'

// ─── Enums ────────────────────────────────────────────────────────────────────
// Derived from the canonical `as const` objects in shared-types so a value
// added there propagates here automatically — no second source of truth.

export const layoutTypeEnum = z.enum(Object.values(LayoutType) as [LayoutType, ...LayoutType[]])
export const jlptLevelEnum  = z.enum(Object.values(JLPTLevel)  as [JLPTLevel,  ...JLPTLevel[]])

// ─── Shared field-validation primitives ───────────────────────────────────────

// fields_data is heterogeneous (different card layouts store different shapes),
// so we cannot enumerate every leaf type. Instead we accept arbitrary JSON-like
// values but reject markup and oversized strings recursively. Top-level keys
// are also length-bounded.
const fieldsDataSchema = z.record(z.string().min(1).max(50), z.unknown())
  .refine((v) => !deepHasMarkup(v), 'Field values cannot contain HTML or script-like content')
  .refine((v) => !deepHasOversizedString(v, 2000), 'Field values must each be at most 2000 characters')

const tagsSchema = z.array(safeShortText(50, 1)).max(20)

// ─── Shared metadata fields ───────────────────────────────────────────────────

const cardMetaFields = {
  layoutType:   layoutTypeEnum.default('vocabulary'),
  tags:         tagsSchema.optional(),
  jlptLevel:    jlptLevelEnum.optional(),
  parentCardId: z.string().uuid('Invalid parent card ID').optional(),
}

// ─── Create schemas ───────────────────────────────────────────────────────────

// AI path: client sends a word; controller calls ai.service.generateCard.
const aiCreateSchema = z.object({
  mode: z.literal('ai'),
  word: safeShortText(50, 1),
  ...cardMetaFields,
}).strict()

// Manual path: client supplies fieldsData directly.
const manualCreateSchema = z.object({
  mode: z.literal('manual'),
  fieldsData: fieldsDataSchema,
  ...cardMetaFields,
}).strict()

// Tagged union on `mode`. The previous z.union narrowed structurally on the
// presence of `word` vs `fieldsData`, which was already safe due to .strict()
// on both branches (a body with both keys 400'd). The explicit discriminator
// makes the intent of every payload self-evident on the wire and forecloses
// any future schema-evolution mishap that might re-introduce overlapping
// fields between the two branches.
export const createCardSchema = z.discriminatedUnion('mode', [
  aiCreateSchema,
  manualCreateSchema,
])

// ─── Update schema ────────────────────────────────────────────────────────────

// All fields optional — only present keys are written (true PATCH semantics).
export const updateCardSchema = z.object({
  fieldsData: fieldsDataSchema.optional(),
  layoutType: layoutTypeEnum.optional(),
  tags:       tagsSchema.optional(),
  jlptLevel:  jlptLevelEnum.nullable().optional(),
}).strict()

// ─── Param / query schemas ────────────────────────────────────────────────────

export const cardIdParamSchema      = z.object({ id:     z.string().uuid('Invalid card ID') })
/** Validates the nested-route :deckId param (e.g. /decks/:deckId/cards). Distinct
 *  from deck.schema.ts's deckIdParamSchema, which validates the top-level :id param. */
export const nestedDeckIdParamSchema = z.object({ deckId: z.string().uuid('Invalid deck ID') })

export const cardStatusFilterEnum = z.enum(['all', 'new', 'learning', 'review', 'suspended'])

export const listCardsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  // Opaque base64url-encoded cursor (see lib/http.ts:encodeCursor). Length is
  // bounded loosely; precise shape validation happens at decode time and a
  // malformed value surfaces as a 400 with code 'CURSOR_INVALID'.
  cursor: z.string().min(1).max(512).optional(),
  status: cardStatusFilterEnum.optional(),
}).strict()

// ─── Types ────────────────────────────────────────────────────────────────────
//
// `*Input` is `z.infer` (post-parse) — defaults are filled, required fields all present.
//   Server-side use: validates inputs and returns the canonical shape.
// `*Payload` is `z.input` (pre-parse) — defaults are optional, matching what callers
//   are allowed to send over the wire.
//   Client-side use: typing the request body before serialization.

export type CreateCardInput    = z.infer<typeof createCardSchema>
export type CreateCardPayload  = z.input<typeof createCardSchema>
export type UpdateCardInput    = z.infer<typeof updateCardSchema>
export type UpdateCardPayload  = z.input<typeof updateCardSchema>
export type ListCardsQuery     = z.infer<typeof listCardsQuerySchema>
export type CardStatusFilter   = z.infer<typeof cardStatusFilterEnum>
