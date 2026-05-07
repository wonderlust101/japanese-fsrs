import type { User } from '@supabase/supabase-js'

/**
 * Returns the user's preferred display name from supabase-js's user_metadata.
 * Prefers explicit `display_name` (set during signup) over OAuth-provider
 * `full_name`. Returns undefined if neither is a non-empty string.
 *
 * Centralises the supabase-js Record<string, unknown> → string narrowing
 * that previously lived at four call sites.
 */
export function getUserDisplayName(user: User | null | undefined): string | undefined {
  const meta = user?.user_metadata
  if (meta == null) return undefined
  const display = meta['display_name']
  if (typeof display === 'string' && display.length > 0) return display
  const full = meta['full_name']
  if (typeof full === 'string' && full.length > 0) return full
  return undefined
}
