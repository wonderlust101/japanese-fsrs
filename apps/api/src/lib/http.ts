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
    throw new AppError(428, 'If-Match header required')
  }
  const result = ifMatchVersionSchema.safeParse(rawHeader)
  if (!result.success) {
    throw new AppError(400, 'If-Match must be a positive integer version')
  }
  return result.data
}
