import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

/**
 * Returns a Supabase client configured for use in browser (Client Component)
 * contexts. Uses the public anon key — never the service role key.
 *
 * `createBrowserClient` is safe to call multiple times: @supabase/ssr
 * memoises the client instance using the URL + key pair as the cache key,
 * so there is never more than one GoTrue listener active at a time.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
