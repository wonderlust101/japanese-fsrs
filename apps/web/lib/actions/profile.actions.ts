'use server'

import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return null

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/profile`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache:   'no-store',
    },
  )

  if (!res.ok) return null
  return res.json() as Promise<ProfileResponse>
}

export async function updateProfileAction(payload: UpdateProfileInput): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session === null) {
    throw new Error('Not authenticated')
  }

  const res = await fetch(
    `${process.env['NEXT_PUBLIC_API_URL']}/api/v1/profile`,
    {
      method:  'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    const body = await res.json() as { error?: string }
    throw new Error(body.error ?? 'Failed to update profile')
  }
}
