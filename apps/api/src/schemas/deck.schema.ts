import { z } from 'zod'

import { DeckType } from '@fsrs-japanese/shared-types'

import { safeShortText } from '../lib/sanitize.ts'

// Derived from the canonical DeckType const in shared-types.
export const deckTypeEnum = z.enum(Object.values(DeckType) as [DeckType, ...DeckType[]])

export const createDeckSchema = z.object({
  name:        safeShortText(100, 1),
  description: safeShortText(500).optional(),
  deck_type:   deckTypeEnum.default('vocabulary'),
}).strict()

// Every field is optional — only present keys are written (true PATCH semantics).
export const updateDeckSchema = z.object({
  name:        safeShortText(100, 1).optional(),
  description: safeShortText(500).nullable().optional(),
  deck_type:   deckTypeEnum.optional(),
  is_public:   z.boolean().optional(),
}).strict()

// Validates the :id route parameter is a well-formed UUID.
export const deckIdParamSchema = z.object({
  id: z.string().uuid('Invalid deck ID'),
})

export type CreateDeckInput   = z.infer<typeof createDeckSchema>
export type UpdateDeckInput   = z.infer<typeof updateDeckSchema>
