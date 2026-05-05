'use server'

import {
  ProfileSchema,
  voidResponseSchema,
  type Profile,
  type UpdateProfileInput,
} from '@fsrs-japanese/shared-types'
import { apiCall, apiCallSafe } from '@/lib/api/client'

export async function getProfileAction(): Promise<Profile | null> {
  return apiCallSafe<Profile | null>('/api/v1/profile', ProfileSchema.nullable(), {}, null)
}

export async function updateProfileAction(payload: UpdateProfileInput): Promise<void> {
  await apiCall<unknown>(
    '/api/v1/profile',
    voidResponseSchema,
    { method: 'PATCH', body: JSON.stringify(payload) },
    'Failed to update profile',
  )
}
