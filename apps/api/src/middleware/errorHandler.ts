import type { ErrorRequestHandler } from 'express'
import type { Logger } from 'pino'
import { ZodError } from 'zod'

import { componentLogger } from '../lib/logger.ts'
import { summarizeErr } from '../lib/scrub.ts'

/** Module logger used by `dbError()` (called from services that don't have a
 *  request-scoped logger). The errorHandler middleware below uses `req.log`
 *  via pino-http instead. */
const dbLog = componentLogger('db')
const apiLog = componentLogger('api')

/**
 * ── Stable error codes ────────────────────────────────────────────────────
 * Single source of truth. Every `AppError` throw site that includes a
 * `code` references one of the values below. The frontend branches on
 * `code` rather than parsing English message strings, so this list IS
 * the contract — when adding a new throw with a new code, append a line
 * here (alphabetised within its HTTP-status section). When retiring a
 * throw, remove the corresponding line.
 *
 *   400 Bad Request
 *     CURSOR_INVALID                  Opaque pagination cursor failed decode / shape validation
 *     IDEMPOTENCY_KEY_INVALID         Idempotency-Key header is not a UUID
 *     IDEMPOTENCY_KEY_REQUIRED        Idempotency-Key header missing on retry-able POST
 *     IF_MATCH_INVALID                If-Match header present but malformed
 *     OTP_INVALID                     Signup OTP wrong / expired
 *     OTP_RESEND_FAILED               Supabase rejected resend-OTP request
 *     SIGNUP_FAILED                   Generic signup-flow failure (Supabase)
 *     VALIDATION_ERROR                Zod schema rejection (top-level — see ZodError branch)
 *
 *   401 Unauthorized
 *     AUTH_BEARER_MISSING             Logout-controller defensive re-check
 *     AUTH_CURRENT_PASSWORD_INVALID   Step-up gate (change-password / delete-account)
 *     AUTH_HEADER_MISSING             Authorization header absent / malformed
 *     AUTH_INVALID_CREDENTIALS        Login: email + password didn't match
 *     AUTH_REFRESH_INVALID            Refresh-token expired or revoked
 *     AUTH_SESSION_INVALID            Session lacks email field (defensive)
 *     AUTH_TOKEN_INVALID              Bearer token rejected by Supabase
 *
 *   403 Forbidden
 *     PREMADE_CARD_NOT_RESETTABLE     Tried to forget() a premade source card
 *     PREMADE_CARD_NOT_REVIEWABLE     Tried to processReview() on a premade source card
 *
 *   404 Not Found
 *     CARD_NOT_FOUND                       Card row missing / wrong owner / parent missing
 *     DECK_NOT_FOUND                       Deck row missing / wrong owner
 *     WEAK_SPOT_DRILL_SESSION_CARD_NOT_FOUND   Session card row missing / wrong session / wrong owner
 *     WEAK_SPOT_DRILL_SESSION_NOT_FOUND        Drill session missing / wrong owner
 *     WEAK_SPOT_NOT_FOUND                      WeakSpot row missing / wrong owner
 *     PREMADE_DECK_NOT_FOUND               Premade deck missing or inactive
 *     PROFILE_NOT_FOUND                    Profile row missing (signup-trigger bypassed)
 *     REVIEW_LOG_NOT_FOUND                 Rollback target missing
 *     SESSION_NOT_FOUND                    session_id not present in review_logs
 *
 *   409 Conflict
 *     CARD_SUSPENDED                       Tried to review a suspended card
 *     DB_FK_VIOLATION                      Foreign-key violation (SQLSTATE 23503)
 *     DB_UNIQUE_VIOLATION                  Unique-constraint violation (SQLSTATE 23505)
 *     IDEMPOTENCY_IN_FLIGHT                Same key + same body, prior call still running
 *     WEAK_SPOT_ALREADY_OPEN                   Reopen blocked: another unresolved weakSpot already exists for this card
 *     WEAK_SPOT_DRILL_SESSION_STATE_CONFLICT   Drill session cannot transition from its current state to the target
 *     RESCHEDULE_NO_HISTORY                Reschedule with no eligible review logs
 *     RESCHEDULE_NO_RESULT                 ts-fsrs reschedule() returned no item
 *     ROLLBACK_NOT_AVAILABLE               Pre-migration log lacks before-snapshot
 *
 *   412 Precondition Failed
 *     VERSION_CONFLICT                Optimistic-concurrency mismatch (card / deck / profile)
 *
 *   422 Unprocessable Entity
 *     CARD_FIELDS_INSUFFICIENT             AI-generation target card lacks `word`
 *     DB_CHECK_VIOLATION                   Database CHECK constraint failed (SQLSTATE 23514)
 *     DECK_ARCHIVED                        Review/write attempted on a card in an archived deck
 *     IDEMPOTENCY_KEY_CONFLICT             Same key + different body
 *     WEAK_SPOT_DRILL_ATTEMPT_ASSERTION_MISMATCH  Body cardId/weakSpotId disagrees with the session card
 *
 *   428 Precondition Required
 *     IF_MATCH_REQUIRED               PATCH endpoint missing If-Match header
 *
 *   429 Too Many Requests   (limiter-specific; X-RateLimit-* headers carry quota)
 *     RATE_LIMITED_ACCOUNT_DELETE     3/hour/user
 *     RATE_LIMITED_AI_DAILY           200/24h/user
 *     RATE_LIMITED_AI_MINUTE          20/min/user
 *     RATE_LIMITED_AUTH               5/15min email + 30/15min IP (parallel)
 *     RATE_LIMITED_BATCH              5/5min/user batch flush
 *     RATE_LIMITED_DASHBOARD          120/min/user analytics dashboard
 *     RATE_LIMITED_DEFAULT_USER       240/min/user backstop (every authenticated route)
 *     RATE_LIMITED_OTP_VERIFY         5/hour/email
 *     RATE_LIMITED_PASSWORD_CHANGE    5/15min/user
 *     RATE_LIMITED_RESOURCE_DELETE    120/min/user cascade DELETE
 *     RATE_LIMITED_SIMILAR            120/min/user pgvector search
 *     RATE_LIMITED_SUBMIT             60/min/user single-review submit
 *     RATE_LIMITED_SUBSCRIBE          15/15min/user premade fork
 *     RATE_LIMITED_UNSUBSCRIBE        10/hour/user
 *
 *   500 Internal Server Error
 *     FSRS_MANUAL_RATING_BUG          Zod let `rating: 'manual'` through (regression marker)
 *     FSRS_UNKNOWN_RATING_BUG         review_logs.rating held an unknown string (corruption marker)
 *     IDEMPOTENCY_CLAIM_FAILED        DB error claiming idempotency key
 *     INTERNAL_SERVER_ERROR           Fallthrough — unexpected error (no AppError mapping)
 *     LOGOUT_FAILED                   Supabase admin signOut errored
 *     OPENAI_KEY_MISSING              OPENAI_API_KEY env var unset at AI throw site
 *     PREMADE_SUBSCRIBE_RPC_EMPTY     subscribe_to_premade_deck RPC returned no row
 *
 *   502 Bad Gateway   (upstream returned HTTP 200 with malformed content)
 *     OPENAI_EMPTY_RESPONSE           Chat-completion content was null/undefined
 *     OPENAI_NO_EMBEDDING_DATA        Embeddings response had no data array
 *
 *   503 Service Unavailable   (carries `Retry-After`; uses lowercase code)
 *     service_unavailable             Circuit breaker open OR inline upstream failure
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Typed application error. Throw this from services and route handlers;
 * the global error handler converts it to the appropriate HTTP response.
 *
 * @example
 * throw new AppError(404, 'Card not found')
 * throw new AppError(409, 'A card for this word already exists')
 */
export class AppError extends Error {
  /** Stable machine-readable identifier (e.g. 'CARD_NOT_FOUND'). Lets the
   *  frontend branch on intent rather than parsing English message strings,
   *  which would break under copy edits or i18n. Optional — many AppError
   *  throws are status-distinct enough that the HTTP status is sufficient. */
  public readonly code: string | undefined

  constructor(
    public readonly statusCode: number,
    message: string,
    options?: { cause?: unknown; code?: string },
  ) {
    super(message, options)
    this.name = 'AppError'
    this.code = options?.code
  }
}

/**
 * 503 Service Unavailable. Thrown when an external dependency (OpenAI chat
 * or embeddings) is degraded and the circuit breaker opened, OR when an AI
 * call failed inline and we want to surface "transient — retry" semantics
 * instead of the previous generic 502.
 *
 * The global error handler emits a `Retry-After` header and a structured
 * body `{ error, code: 'service_unavailable', retryAfterSeconds }` so the
 * frontend can branch on `code` rather than parsing free-text messages.
 */
export class ServiceUnavailableError extends AppError {
  constructor(
    message: string,
    public readonly retryAfterSeconds: number,
    options?: { cause?: unknown },
  ) {
    super(503, message, options)
    this.name = 'ServiceUnavailableError'
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
  // Distinguish client-induced constraint conflicts from genuine 500s.
  // Without this branch, a unique-key violation surfaces as a generic
  // "Failed to <action>" 500 — the caller can't tell "you tried to create
  // a duplicate" from "the DB is on fire", and the metric inflates server
  // error rates with what are actually 4xx user errors.
  if (err !== null && typeof err === 'object' && 'code' in err) {
    const sqlstate = (err as { code: unknown }).code
    if (sqlstate === '23505') {
      return new AppError(409, 'Resource already exists',           { cause: err, code: 'DB_UNIQUE_VIOLATION' })
    }
    if (sqlstate === '23503') {
      return new AppError(409, 'Referenced resource does not exist', { cause: err, code: 'DB_FK_VIOLATION' })
    }
    if (sqlstate === '23514') {
      return new AppError(422, 'Constraint violation',              { cause: err, code: 'DB_CHECK_VIOLATION' })
    }
  }
  return new AppError(500, `Failed to ${action}`, { cause: err })
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
  // for the rare case where the error fires before requestLogger ran. The
  // optional widening lives in apps/api/src/types/express.d.ts.
  const log: Logger = req.log ?? apiLog

  // pino-http's genReqId populated this on the same request; matches the
  // X-Request-ID response header. Surfacing in the body too lets the
  // frontend show "Reference: <id>" in error UI without forcing the
  // consumer to read response headers (which several fetch wrappers hide).
  const requestId = typeof req.id === 'string' ? req.id : undefined

  if (err instanceof ServiceUnavailableError) {
    // Set the standards-compliant Retry-After header (RFC 7231) AND mirror
    // it in the body so callers using a JSON parser (most browser fetch
    // wrappers) can read the same number without sniffing headers.
    res.setHeader('Retry-After', String(err.retryAfterSeconds))
    log.error(
      { err: summarizeErr(err), statusCode: err.statusCode, retryAfterSeconds: err.retryAfterSeconds },
      'ServiceUnavailableError',
    )
    res.status(503).json({
      error:             err.message,
      code:              'service_unavailable',
      retryAfterSeconds: err.retryAfterSeconds,
      requestId,
    })
    return
  }

  if (err instanceof AppError) {
    // 4xx are expected client errors; log at WARN so future Sentry hooks
    // don't fire alerts on validation / auth / not-found.
    if (err.statusCode >= 500) {
      log.error({ err: summarizeErr(err), statusCode: err.statusCode, code: err.code }, 'AppError')
    } else {
      log.warn({ err: summarizeErr(err), statusCode: err.statusCode, code: err.code }, 'AppError')
    }
    const body: Record<string, unknown> = { error: err.message, requestId }
    if (err.code !== undefined) body['code'] = err.code
    res.status(err.statusCode).json(body)
    return
  }

  if (err instanceof ZodError) {
    // Wire shape: { error, code: 'VALIDATION_ERROR', details: SafeIssue[], requestId }.
    //
    // The top-level `code` is intentionally generic — callers branch on
    // `details[].code`, which carries Zod's `ZodIssue.code`:
    //   'invalid_type'        wrong type (string vs number etc.)
    //   'invalid_string'      failed regex / email / URL / uuid refinement
    //   'too_small'           below minLength / minimum
    //   'too_big'             above maxLength / maximum
    //   'invalid_enum_value'  value not in enum
    //   'unrecognized_keys'   extra keys when schema is .strict()
    //   'custom'              .refine() / .superRefine() failure
    // Pair `details[].code` with `details[].path` (JSONPath to the failing
    // field, e.g. `['email']` or `['cards', 0, 'reading']`) for field-level UX.
    //
    // `received` / `expected` / `input` are stripped: Zod echoes user input
    // into them on type mismatches, so leaking would be a PII risk.
    const safeIssues = err.issues.map(({ code, path, message }) => ({ code, path, message }))
    log.warn({ err: { name: 'ZodError' }, issues: safeIssues }, 'Validation error')
    res.status(400).json({ error: 'Validation error', code: 'VALIDATION_ERROR', details: safeIssues, requestId })
    return
  }

  // summarizeErr scrubs key-shaped substrings from `message` + `stack` and
  // walks one level of `cause` so a wrapped failure (e.g. an OpenAI APIError
  // sitting under a ServiceUnavailableError) surfaces in this single log
  // line. Bounded depth (one level) keeps cyclic cause chains harmless.
  log.error({ err: summarizeErr(err) }, 'Unhandled error')
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_SERVER_ERROR', requestId })
}
