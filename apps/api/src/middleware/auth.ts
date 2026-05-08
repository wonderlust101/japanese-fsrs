import { createHash } from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import type { RequestHandler } from 'express'

import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from './errorHandler.ts'

interface CacheEntry { user: User; expiresAt: number }

/**
 * Per-process in-memory cache for verified bearer tokens. Keyed by SHA-256 of
 * the raw token so the JWT itself never lives on the heap as a Map key.
 *
 * TTL of 30 seconds bounds the staleness window: a token revoked in Supabase
 * remains accepted by this process for up to 30s. Acceptable trade-off for the
 * latency win — typical session lifetimes are ~1h and revocations are rare.
 *
 * Bounded at 5000 entries (~ 5000 unique active tokens × ~200B = ~1MB) to keep
 * the cache from growing unbounded under abuse. Eviction drops the oldest
 * insertion (Map iteration order) — adequate for an L1 cache; not a true LRU.
 *
 * Failure-mode interaction with the Supabase circuit breaker: cached entries
 * serve their TTL even when the breaker is open. The fall-through path (cache
 * miss + open breaker) still 503s, so the cache only ever *improves* tail
 * behaviour during outages — it never masks them.
 */
const TOKEN_CACHE_TTL_MS = 30_000
const TOKEN_CACHE_MAX    = 5000
const tokenCache = new Map<string, CacheEntry>()

function pruneIfTooLarge(): void {
  if (tokenCache.size <= TOKEN_CACHE_MAX) return
  const oldestKey = tokenCache.keys().next().value
  if (oldestKey !== undefined) tokenCache.delete(oldestKey)
}

/**
 * Test-only escape hatch. Lets unit tests reset cache state between cases so
 * a stub `auth.getUser()` doesn't get bypassed by a leftover entry. Underscore
 * prefix marks it as internal; production code never calls it.
 */
export function _clearTokenCacheForTests(): void {
  tokenCache.clear()
}

/**
 * Verifies the Supabase JWT in the Authorization header and attaches the
 * authenticated user to req.user. Must be applied to every protected route.
 *
 * Cache: a SHA-256 hash of the bearer token keys a 30s in-memory entry holding
 * the verified user object. On hit the upstream `auth.getUser` call is
 * skipped — this is the hot-path optimization for high-RPM clients. On miss
 * the standard Supabase verification runs and the result is cached.
 *
 * Returns 401 when:
 *   - The Authorization header is missing or not in Bearer format
 *   - The token has expired or is otherwise invalid
 */
export const authMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or malformed Authorization header', { code: 'AUTH_HEADER_MISSING' })
    }

    const token = authHeader.slice('Bearer '.length)

    // Hash, not raw token, lives in the Map key. SHA-256 is sufficient for
    // collision resistance at this scale; cryptographic strength isn't
    // required since the cache is a process-local optimization.
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const cached = tokenCache.get(tokenHash)
    if (cached !== undefined && Date.now() < cached.expiresAt) {
      req.user = cached.user
      next()
      return
    }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error !== null || user === null) {
      throw new AppError(401, 'Invalid or expired token', { code: 'AUTH_TOKEN_INVALID' })
    }

    tokenCache.set(tokenHash, { user, expiresAt: Date.now() + TOKEN_CACHE_TTL_MS })
    pruneIfTooLarge()
    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
