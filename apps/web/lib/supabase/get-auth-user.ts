import { cache } from 'react'
import { createSupabaseServerClient } from './server'

/**
 * Returns the authenticated Supabase user for the current request.
 *
 * React.cache() deduplicates calls within the same Server Component render:
 * layout.tsx and dashboard/page.tsx both invoke this, but only one JWT
 * round-trip to Supabase is made per request.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
