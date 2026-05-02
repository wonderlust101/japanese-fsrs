import { z } from 'zod'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const cardTypeEnum   = z.enum(['comprehension', 'production', 'listening'])
export const layoutTypeEnum = z.enum(['vocabulary', 'grammar', 'sentence'])
export const jlptLevelEnum  = z.enum(['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt'])

// ─── Shared metadata fields ───────────────────────────────────────────────────

const cardMetaFields = {
  card_type:      cardTypeEnum.default('comprehension'),
  layout_type:    layoutTypeEnum.default('vocabulary'),
  tags:           z.array(z.string()).optional(),
  jlpt_level:     jlptLevelEnum.optional(),
  parent_card_id: z.string().uuid('Invalid parent card ID').optional(),
}

// ─── Create schemas ───────────────────────────────────────────────────────────

// AI path: client sends a word; controller calls ai.service.generateCard.
const aiCreateSchema = z.object({
  word: z.string().trim().min(1, 'Word is required').max(50, 'Word must be at most 50 characters'),
  ...cardMetaFields,
}).strict()

// Manual path: client supplies fields_data directly.
const manualCreateSchema = z.object({
  fields_data: z.record(z.string(), z.unknown()),
  ...cardMetaFields,
}).strict()

export const createCardSchema = z.union([aiCreateSchema, manualCreateSchema])

// ─── Update schema ────────────────────────────────────────────────────────────

// All fields optional — only present keys are written (true PATCH semantics).
export const updateCardSchema = z.object({
  fields_data: z.record(z.string(), z.unknown()).optional(),
  layout_type: layoutTypeEnum.optional(),
  card_type:   cardTypeEnum.optional(),
  tags:        z.array(z.string()).optional(),
  jlpt_level:  jlptLevelEnum.optional(),
}).strict()

// ─── Param / query schemas ────────────────────────────────────────────────────

export const cardIdParamSchema  = z.object({ id:     z.string().uuid('Invalid card ID') })
export const deckIdParamSchema  = z.object({ deckId: z.string().uuid('Invalid deck ID') })

export const listCardsQuerySchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateCardInput = z.infer<typeof createCardSchema>
export type UpdateCardInput = z.infer<typeof updateCardSchema>
export type ListCardsQuery  = z.infer<typeof listCardsQuerySchema>
export type CardType        = z.infer<typeof cardTypeEnum>
export type LayoutType      = z.infer<typeof layoutTypeEnum>
export type JlptLevel       = z.infer<typeof jlptLevelEnum>
