import type { RequestHandler } from 'express'
import { timingSafeEqual } from 'node:crypto'

import { AppError } from './errorHandler.ts'

/**
 * Requires `X-Admin-Token: <token>` matching the ADMIN_TOKEN env var.
 *
 * Used by ops-only endpoints (e.g. premade embedding backfill) that should
 * not be exposed via user JWT auth. Fails closed if ADMIN_TOKEN is unset
 * server-side — the env must be configured to enable any admin route.
 *
 * Comparison is constant-time so token presence/length cannot be probed
 * via response timing.
 */
export const adminTokenMiddleware: RequestHandler = (req, _res, next): void => {
  try {
    const expected = process.env['ADMIN_TOKEN']
    if (expected === undefined || expected.length === 0) {
      throw new AppError(503, 'Admin endpoint disabled (ADMIN_TOKEN not configured)')
    }

    const received = req.headers['x-admin-token']
    if (typeof received !== 'string' || received.length === 0) {
      throw new AppError(401, 'Missing X-Admin-Token header')
    }

    const a = Buffer.from(expected)
    const b = Buffer.from(received)
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AppError(401, 'Invalid admin token')
    }

    next()
  } catch (err) {
    next(err)
  }
}
