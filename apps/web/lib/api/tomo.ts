'use client'

import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { queryKeys }  from './queryKeys'
import { staleTimes } from './config'
import { getTomoNoteAction } from '../actions/tomo.actions'
import type { ApiTomoNote } from '@fsrs-japanese/shared-types'

/**
 * Backend Completion Plan Stage 6. One Tomo daily note per learner; the
 * server caches per learner-local day and substitutes a curated idiom
 * fallback whenever the AI path is unavailable, so this hook never
 * surfaces an error envelope to the UI under normal operation. A null
 * return means "no profile / not signed in" (rare) — the consumer
 * renders the existing empty-state copy.
 */
export function useTomoNote(): UseQueryResult<ApiTomoNote | null, Error> {
  return useQuery({
    queryKey:  queryKeys.tomo.note(),
    queryFn:   getTomoNoteAction,
    staleTime: staleTimes.tomoNote,
  })
}
