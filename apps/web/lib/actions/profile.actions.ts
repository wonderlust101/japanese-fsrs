'use server'

import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { apiCall, apiCallSafe } from '@/lib/api/client'

export interface ProfileResponse {
  id:                    string
  native_language:       string
  jlpt_target:           string | null
  study_goal:            string | null
  interests:             string[]
  daily_new_cards_limit: number
  daily_review_limit:    number
  retention_target:      number
  timezone:              string
  created_at:            string
  updated_at:            string
}

export async function getProfileAction(): Promise<ProfileResponse | null> {
  return apiCallSafe<ProfileResponse | null>('/api/v1/profile', {}, null)
}

export async function updateProfileAction(payload: UpdateProfileInput): Promise<void> {
  await apiCall<unknown>(
    '/api/v1/profile',
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update profile',
  )
}
