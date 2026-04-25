import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

/**
 * Typed application error. Throw this from services and route handlers;
 * the global error handler converts it to the appropriate HTTP response.
 *
 * @example
 * throw new AppError(404, 'Card not found')
 * throw new AppError(409, 'A card for this word already exists')
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

/**
 * Global Express error handler. Must be registered last — after all routes.
 *
 * Handles:
 *   AppError  → status from the error, message forwarded verbatim
 *   ZodError  → 400 with the issues array for client-side field highlighting
 *   Anything else → 500 with a generic message (details logged server-side)
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation error', details: err.issues })
    return
  }

  // Log unexpected errors but never leak internals to the client.
  console.error('[API] Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error' })
}
