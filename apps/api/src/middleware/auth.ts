import type { RequestHandler } from 'express'

import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from './errorHandler.ts'

/**
 * Verifies the Supabase JWT in the Authorization header and attaches the
 * authenticated user to req.user. Must be applied to every protected route.
 *
 * Returns 401 when:
 *   - The Authorization header is missing or not in Bearer format
 *   - The token has expired or is otherwise invalid
 */
export const authMiddleware: RequestHandler = async (req, _res, next): Promise<void> => {
  try {
    const authHeader = req.headers.authorization

    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      throw new AppError(401, 'Missing or malformed Authorization header')
    }

    const token = authHeader.slice('Bearer '.length)

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error !== null || user === null) {
      throw new AppError(401, 'Invalid or expired token')
    }

    req.user = user
    next()
  } catch (err) {
    next(err)
  }
}
