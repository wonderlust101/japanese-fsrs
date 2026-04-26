import { createBrowserClient } from '@supabase/ssr'

/**
 * Returns a Supabase client configured for use in browser (Client Component)
 * contexts. Uses the public anon key — never the service role key.
 *
 * `createBrowserClient` is safe to call multiple times: @supabase/ssr
 * memoises the client instance using the URL + key pair as the cache key,
 * so there is never more than one GoTrue listener active at a time.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
  )
}
