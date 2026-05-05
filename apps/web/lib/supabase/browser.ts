import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/lib/env'

/**
 * Returns a Supabase client configured for use in browser (Client Component)
 * contexts. Uses the public anon key — never the service role key.
 *
 * The client is intentionally untyped against the `Database` schema. Per
 * CLAUDE.md the browser only ever uses auth methods on this client; raw
 * queries go through the Express API. Keeping the DB schema out of the web
 * bundle is a privacy/leak-prevention guarantee.
 *
 * `createBrowserClient` is safe to call multiple times: @supabase/ssr
 * memoises the client instance using the URL + key pair as the cache key,
 * so there is never more than one GoTrue listener active at a time.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
