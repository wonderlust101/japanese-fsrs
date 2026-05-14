import type { z } from 'zod'

import type {
  ApiLeechListItemSchema,
  ApiLeechListResponseSchema,
  ApiLeechDrillCardSchema,
  ApiLeechDrillSessionSchema,
  ApiLeechDrillSessionStatusSchema,
} from './schemas/api.schema.ts'

export type ApiLeechListItem     = z.infer<typeof ApiLeechListItemSchema>
export type ApiLeechListResponse = z.infer<typeof ApiLeechListResponseSchema>

export type ApiLeechDrillCard          = z.infer<typeof ApiLeechDrillCardSchema>
export type ApiLeechDrillSession       = z.infer<typeof ApiLeechDrillSessionSchema>
export type ApiLeechDrillSessionStatus = z.infer<typeof ApiLeechDrillSessionStatusSchema>
