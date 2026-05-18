'use server'

import { apiCallSafe } from '@/lib/api/client'
import {
  ApiTomoNoteSchema,
  type ApiTomoNote,
} from '@fsrs-japanese/shared-types'

/**
 * Backend Completion Plan Stage 6. Fetches the learner's daily Tomo note.
 *
 * The route is built around the invariant that 5xx-on-content-failure
 * never happens — if OpenAI is unavailable, the server substitutes a
 * curated idiom with `kind: 'idiom'`. The only error path that surfaces
 * to the client is a real auth / not-found failure, in which case we fall
 * back to `null` and the consumer renders the existing empty-state copy
 * ("Tomo's notes appear here when there's something worth saying.").
 */
export async function getTomoNoteAction(): Promise<ApiTomoNote | null> {
  return apiCallSafe<ApiTomoNote | null>(
    '/api/v1/tomo/note',
    ApiTomoNoteSchema.nullable(),
    {},
    null,
  )
}
