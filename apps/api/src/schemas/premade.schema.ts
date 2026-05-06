import { z } from 'zod'

import { deckTypeEnum, jlptLevelEnum } from '@fsrs-japanese/shared-types'

export const listPremadeDecksQuerySchema = z.object({
  deckType:  deckTypeEnum.optional(),
  jlptLevel: jlptLevelEnum.optional(),
  domain:    z.string().trim().min(1).max(50).optional(),
  limit:     z.coerce.number().int().min(1).max(100).default(50),
  cursor:    z.string().uuid().optional(),
}).strict()

export const premadeDeckIdParamSchema = z.object({
  id: z.string().uuid('Invalid premade deck ID'),
})

export type ListPremadeDecksQuery = z.infer<typeof listPremadeDecksQuerySchema>
