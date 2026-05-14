import type { z } from 'zod'

import type { ApiLeechListItemSchema, ApiLeechListResponseSchema } from './schemas/api.schema.ts'

export type ApiLeechListItem     = z.infer<typeof ApiLeechListItemSchema>
export type ApiLeechListResponse = z.infer<typeof ApiLeechListResponseSchema>
