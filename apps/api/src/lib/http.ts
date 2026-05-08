import type { Response } from 'express'
import { z } from 'zod'

import { AppError } from '../middleware/errorHandler.ts'

/**
 * Sets a `Cache-Control` header for a cacheable GET response. Express's default
 * weak ETag handling is on (no `app.set('etag', false)` in app.ts), so the ETag
 * is generated automatically from the JSON body and conditional 304s work
 * out of the box once `Cache-Control` is present.
 *
 * Defaults to `private` because every cached endpoint we have is per-user
 * authenticated. Use `'public'` only for resources that are truly shared
 * across all authenticated callers.
 *
 * @param res     Express response.
 * @param maxAge  Seconds. The browser may serve from cache without a network
 *                round-trip up to this long; once stale it issues an
 *                `If-None-Match` revalidation against the ETag.
 * @param scope   `'private'` (default) or `'public'`.
 */
export function cacheControl(res: Response, maxAge: number, scope: 'private' | 'public' = 'private'): void {
  res.setHeader('Cache-Control', `${scope}, max-age=${maxAge}, must-revalidate`)
}

const ifMatchVersionSchema = z.coerce.number().int().min(1)

/**
 * Parses the `If-Match` header into a positive integer version for optimistic
 * concurrency on PATCH endpoints (cards, decks, profile).
 *
 * Missing → 428 Precondition Required (RFC 6585).
 * Malformed (non-integer, ≤ 0) → 400.
 */
export function parseIfMatchVersion(rawHeader: string | undefined): number {
  if (rawHeader === undefined) {
    throw new AppError(428, 'If-Match header required', { code: 'IF_MATCH_REQUIRED' })
  }
  const result = ifMatchVersionSchema.safeParse(rawHeader)
  if (!result.success) {
    throw new AppError(400, 'If-Match must be a positive integer version', { code: 'IF_MATCH_INVALID' })
  }
  return result.data
}

// ─── Pagination cursor (opaque) ──────────────────────────────────────────────
//
// Cursors are encoded as base64url(JSON.stringify(payload)). The wire format
// is deliberately opaque: clients must round-trip the value unchanged, so the
// server is free to evolve what's encoded inside (additional sort keys,
// tiebreakers, version markers) without breaking pagination contracts.
// Returning a bare UUID would invite callers to construct cursors from
// primary keys themselves and couple the wire format to the storage schema.
//
// Each list service defines its own cursor schema (typically `{ id }`) and
// passes it to `decodeCursor` for validation. The schema-as-source pattern
// keeps the encoded shape grep-able and lets a future evolution (e.g. adding
// a `sortAt` field) surface as a clean ZodError rather than a silent
// type mismatch.

/**
 * Encodes any JSON-serializable value as a URL-safe base64 cursor. The
 * caller decides what to put inside; clients treat the result as opaque
 * and round-trip it unchanged.
 */
export function encodeCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

/**
 * Decodes an opaque cursor and validates it against the caller's schema.
 * Throws AppError(400, code: 'CURSOR_INVALID') on any decode/validation
 * failure — a malformed cursor is unrecoverable for the client without
 * restarting from the first page, so a clean 400 with a stable code is
 * more useful than silently treating the cursor as null.
 */
export function decodeCursor<T>(opaque: string, schema: z.ZodType<T>): T {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(opaque, 'base64url').toString('utf8'))
  } catch {
    throw new AppError(400, 'Invalid pagination cursor', { code: 'CURSOR_INVALID' })
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new AppError(400, 'Invalid pagination cursor', { code: 'CURSOR_INVALID' })
  }
  return result.data
}
