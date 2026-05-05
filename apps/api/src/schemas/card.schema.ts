import { z } from 'zod'

import { CardType, JLPTLevel, LayoutType } from '@fsrs-japanese/shared-types'

import { deepHasMarkup, deepHasOversizedString, safeShortText } from '../lib/sanitize.ts'

// ─── Enums ────────────────────────────────────────────────────────────────────
// Derived from the canonical `as const` objects in shared-types so a value
// added there propagates here automatically — no second source of truth.

export const cardTypeEnum   = z.enum(Object.values(CardType)   as [CardType,   ...CardType[]])
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
  card_type:      cardTypeEnum.default('comprehension'),
  layout_type:    layoutTypeEnum.default('vocabulary'),
  tags:           tagsSchema.optional(),
  jlpt_level:     jlptLevelEnum.optional(),
  parent_card_id: z.string().uuid('Invalid parent card ID').optional(),
}

// ─── Create schemas ───────────────────────────────────────────────────────────

// AI path: client sends a word; controller calls ai.service.generateCard.
const aiCreateSchema = z.object({
  word: safeShortText(50, 1),
  ...cardMetaFields,
}).strict()

// Manual path: client supplies fields_data directly.
const manualCreateSchema = z.object({
  fields_data: fieldsDataSchema,
  ...cardMetaFields,
}).strict()

export const createCardSchema = z.union([aiCreateSchema, manualCreateSchema])

// ─── Update schema ────────────────────────────────────────────────────────────

// All fields optional — only present keys are written (true PATCH semantics).
export const updateCardSchema = z.object({
  fields_data: fieldsDataSchema.optional(),
  layout_type: layoutTypeEnum.optional(),
  card_type:   cardTypeEnum.optional(),
  tags:        tagsSchema.optional(),
  jlpt_level:  jlptLevelEnum.nullable().optional(),
}).strict()

// ─── Param / query schemas ────────────────────────────────────────────────────

export const cardIdParamSchema  = z.object({ id:     z.string().uuid('Invalid card ID') })
export const deckIdParamSchema  = z.object({ deckId: z.string().uuid('Invalid deck ID') })

export const cardStatusFilterEnum = z.enum(['all', 'new', 'learning', 'review', 'suspended'])

export const listCardsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().uuid().optional(),
  status: cardStatusFilterEnum.optional(),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateCardInput    = z.infer<typeof createCardSchema>
export type UpdateCardInput    = z.infer<typeof updateCardSchema>
export type ListCardsQuery     = z.infer<typeof listCardsQuerySchema>
export type CardStatusFilter   = z.infer<typeof cardStatusFilterEnum>
