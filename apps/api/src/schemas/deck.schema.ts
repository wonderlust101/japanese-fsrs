import { z } from 'zod'

// Mirrors the deck_type DB enum exactly.
export const deckTypeEnum = z.enum(['vocabulary', 'grammar', 'kanji', 'mixed'])

export const createDeckSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  deck_type:   deckTypeEnum.default('vocabulary'),
}).strict()

// Every field is optional — only present keys are written (true PATCH semantics).
export const updateDeckSchema = z.object({
  name:        z.string().trim().min(1, 'Name is required').max(100).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  deck_type:   deckTypeEnum.optional(),
  is_public:   z.boolean().optional(),
}).strict()

// Validates the :id route parameter is a well-formed UUID.
export const deckIdParamSchema = z.object({
  id: z.string().uuid('Invalid deck ID'),
})

export type DeckType          = z.infer<typeof deckTypeEnum>
export type CreateDeckInput   = z.infer<typeof createDeckSchema>
export type UpdateDeckInput   = z.infer<typeof updateDeckSchema>
