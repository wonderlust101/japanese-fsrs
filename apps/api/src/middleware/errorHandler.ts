import type { ErrorRequestHandler } from 'express'
import { ZodError } from 'zod'

import { componentLogger } from '../lib/logger.ts'

/** Module logger used by `dbError()` (called from services that don't have a
 *  request-scoped logger). The errorHandler middleware below uses `req.log`
 *  via pino-http instead. */
const dbLog = componentLogger('db')
const apiLog = componentLogger('api')

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
 * Wrap a Supabase / external-SDK error into a generic 500 AppError, logging
 * the underlying error server-side. Use at every DB error site to keep
 * Postgres internals (table names, error codes, SQL hints) out of client
 * responses.
 *
 * @example
 * if (error !== null) throw dbError('list cards', error)
 */
export function dbError(action: string, err: unknown): AppError {
  dbLog.error({ action, err: summarizeDbError(err) }, `${action} failed`)
  return new AppError(500, `Failed to ${action}`)
}

/**
 * Extract loggable fields from an unknown thrown value. Supabase's
 * PostgrestError is a plain object (not an Error instance) shaped as
 * { message, code, details, hint } — `instanceof Error` returns false,
 * so a naive logger drops all of it.
 *
 * Deliberately drops `details` and `hint`. Postgres echoes user-supplied
 * values into those fields for unique-violation / check-violation errors
 * (e.g. `details: "Key (email)=(...) already exists."`), which would leak
 * PII to whatever log sink the deployment routes to. The remaining triple
 * (name, code, message) is sufficient for incident triage.
 */
function summarizeDbError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { name: err.name, message: err.message }
  }
  if (err !== null && typeof err === 'object') {
    const e = err as Record<string, unknown>
    return {
      message: e['message'],
      code:    e['code'],
    }
  }
  return { detail: String(err) }
}

/**
 * Global Express error handler. Must be registered last — after all routes.
 *
 * Handles:
 *   AppError  → status from the error, message forwarded verbatim
 *   ZodError  → 400 with a sanitized issues array (no echoed input values)
 *   Anything else → 500 with a generic message (sanitized triple logged)
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  // pino-http decorates `req.log` per request; fall back to the module logger
  // for the rare case where the error fires before requestLogger ran.
  const log = (req.log as ReturnType<typeof componentLogger> | undefined) ?? apiLog

  if (err instanceof AppError) {
    // 4xx are expected client errors; log at WARN so future Sentry hooks
    // don't fire alerts on validation / auth / not-found.
    if (err.statusCode >= 500) {
      log.error({ err: { name: err.name, message: err.message }, statusCode: err.statusCode }, 'AppError')
    } else {
      log.warn({ err: { name: err.name, message: err.message }, statusCode: err.statusCode }, 'AppError')
    }
    res.status(err.statusCode).json({ error: err.message })
    return
  }

  if (err instanceof ZodError) {
    // Strip received/expected/input fields — they may echo user input or
    // leak schema internals.
    const safeIssues = err.issues.map(({ code, path, message }) => ({ code, path, message }))
    log.warn({ err: { name: 'ZodError' }, issues: safeIssues }, 'Validation error')
    res.status(400).json({ error: 'Validation error', details: safeIssues })
    return
  }

  // Log only the minimal triple. Full err objects can carry err.cause,
  // err.response (with auth headers), Supabase internals, etc.
  log.error({
    err: {
      name:    err instanceof Error ? err.name    : 'Unknown',
      message: err instanceof Error ? err.message : String(err),
      stack:   err instanceof Error ? err.stack   : undefined,
    },
  }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error' })
}
