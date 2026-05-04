import 'server-only'

import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Shared helper for server actions that call the Express API.
 *
 * Reads the user's Supabase session from cookies, attaches a Bearer token,
 * and returns the parsed JSON body. JSON Content-Type is set automatically
 * when an `init.body` is supplied.
 *
 * Throws `Error('Not authenticated')` when no session is present.
 * Throws `Error(<api error message>)` when the API returns a non-2xx status.
 */
export async function apiCall<T>(
  path:        string,
  init:        RequestInit = {},
  errorPrefix: string,
): Promise<T> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) throw new Error('Not authenticated')

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store',
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? errorPrefix)
  }

  // 204 No Content (and other empty bodies) — caller types T as void/unknown.
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

/**
 * Variant that returns `fallback` instead of throwing when no session exists
 * or the API returns a non-2xx status. Use for non-critical reads where the
 * caller would rather render an empty state than surface an error.
 */
export async function apiCallSafe<T>(
  path:     string,
  init:     RequestInit = {},
  fallback: T,
): Promise<T> {
  const supabase = await createSupabaseServerClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (session === null) return fallback

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${session.access_token}`)
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store',
  })

  if (!res.ok) {
    // Log to server output so the failure isn't invisible in production.
    const body = await res.json().catch(() => ({})) as { error?: string }
    console.warn(`[apiCallSafe] ${path} → ${res.status}: ${body.error ?? '(no body)'}`)
    return fallback
  }
  if (res.status === 204) return fallback
  return res.json() as Promise<T>
}
