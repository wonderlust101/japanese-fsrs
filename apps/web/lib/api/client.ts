import 'server-only'

import { z } from 'zod'

import { env } from '@/lib/env'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Shared helper for server actions that call the Express API.
 *
 * Reads the user's Supabase session from cookies, attaches a Bearer token,
 * fetches the path, and validates the JSON response against the supplied
 * schema. JSON Content-Type is set automatically when an `init.body` is
 * supplied.
 *
 * Throws `Error('Not authenticated')` when no session is present.
 * Throws `Error(<api error message>)` when the API returns a non-2xx status.
 * Throws `ZodError` when the response body doesn't match the schema —
 * surfacing a real contract drift instead of letting it propagate as a
 * mistyped value through the UI.
 */

/** Tiny schema for the API's standard error envelope. Used at error paths. */
const apiErrorBodySchema = z.object({ error: z.string() }).partial()

export async function apiCall<T>(
  path:           string,
  responseSchema: z.ZodType<T>,
  init:           RequestInit = {},
  errorPrefix:    string = 'Request failed',
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
    const raw = await res.json().catch(() => ({}))
    const body = apiErrorBodySchema.safeParse(raw).data ?? {}
    throw new Error(body.error ?? errorPrefix)
  }

  // 204 No Content — for void responses, callers pass `voidResponseSchema`.
  if (res.status === 204) return responseSchema.parse(undefined)
  const body = await res.json()
  return responseSchema.parse(body)
}

/**
 * Variant that returns `fallback` instead of throwing when no session exists,
 * the API returns a non-2xx status, or the response body fails schema parse.
 * Use for non-critical reads where the caller would rather render an empty
 * state than surface an error.
 */
export async function apiCallSafe<T>(
  path:           string,
  responseSchema: z.ZodType<T>,
  init:           RequestInit = {},
  fallback:       T,
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
    const raw = await res.json().catch(() => ({}))
    const body = apiErrorBodySchema.safeParse(raw).data ?? {}
    console.warn(`[apiCallSafe] ${path} → ${res.status}: ${body.error ?? '(no body)'}`)
    return fallback
  }
  if (res.status === 204) return fallback
  const body = await res.json()
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) {
    console.warn(`[apiCallSafe] ${path} response failed schema validation:`, parsed.error.message)
    return fallback
  }
  return parsed.data
}
