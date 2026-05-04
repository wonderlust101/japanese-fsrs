import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL      = process.env['NEXT_PUBLIC_SUPABASE_URL']      ?? ''
const SUPABASE_ANON_KEY = process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''

if (SUPABASE_URL === '' || SUPABASE_ANON_KEY === '') {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
}

/**
 * Returns a Supabase client configured for use in browser (Client Component)
 * contexts. Uses the public anon key — never the service role key.
 *
 * `createBrowserClient` is safe to call multiple times: @supabase/ssr
 * memoises the client instance using the URL + key pair as the cache key,
 * so there is never more than one GoTrue listener active at a time.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
