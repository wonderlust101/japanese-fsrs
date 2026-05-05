'use server'

import type { Profile, UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { apiCall, apiCallSafe } from '@/lib/api/client'

export async function getProfileAction(): Promise<Profile | null> {
  return apiCallSafe<Profile | null>('/api/v1/profile', {}, null)
}

export async function updateProfileAction(payload: UpdateProfileInput): Promise<void> {
  await apiCall<unknown>(
    '/api/v1/profile',
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update profile',
  )
}
