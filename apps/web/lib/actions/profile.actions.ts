'use server'

import type { UpdateProfileInput } from '@fsrs-japanese/shared-types'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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
