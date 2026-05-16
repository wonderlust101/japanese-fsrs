import type { IncomingMessage, ServerResponse } from 'node:http'
import { pinoHttp } from 'pino-http'

import { env }    from '../lib/env.ts'
import { logger } from '../lib/logger.ts'

const isDev = env.NODE_ENV === 'development'

/**
 * Pino-HTTP request logger. Emits an INFO entry log on every incoming
 * request and a level-by-status-code completion log when the response
 * finishes. Decorates `req` with `req.log` (a child logger tagged with
 * `reqId`) so downstream middleware and handlers can attach
 * request-correlated structured fields without re-deriving the id.
 *
 * In dev, pino-http's default serializers run — full headers, query, remote
 * address, etc. surface for debugging. In production, the trimmed serializers
 * below keep payloads tight and let the redact config in lib/logger.ts gate
 * the rest.
 */
export const requestLogger = pinoHttp({
  logger,

  // Honor an incoming X-Request-ID for distributed correlation; otherwise
  // mint a fresh UUID. Echo the resolved id back as the response header so
  // the frontend can surface it in error UI ("Error code: …") for support.
  genReqId(req: IncomingMessage, res: ServerResponse): string {
    const incoming = req.headers['x-request-id']
    const id = typeof incoming === 'string' && incoming.length > 0
      ? incoming
      : crypto.randomUUID()
    res.setHeader('X-Request-ID', id)
    return id
  },

  // Status-driven level so 5xx surfaces as ERROR, 4xx as WARN, 2xx/3xx as INFO.
  // pino-http's default treats every response as INFO regardless of status —
  // override so log filters / alerting see real signal.
  customLogLevel(_req, res, err): 'error' | 'warn' | 'info' {
    if (err !== undefined || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },

  // Trim the auto-serialized req/res so log payloads stay tight in both
  // environments. pino-http's defaults emit full headers (including the
  // Authorization JWT) and the entire res block on every line; that's
  // noise in dev and a redact-config liability in prod.
  //
  // Dev keeps the querystring on `url` so route debugging stays easy; prod
  // strips it because pino's `redact` matches by field name and cannot
  // scrub substrings inside a URL string. If a future route ever accepts a
  // token in the querystring (OAuth callback, password-reset link, etc.)
  // the raw `req.url` would carry it into every log line.
  //
  // For deeper detail in dev, attach structured fields explicitly via
  // `req.log.debug({ ... }, 'message')` inside the handler.
  serializers: {
    req(req): { id: unknown; method: unknown; url: unknown } {
      const url = typeof req.url === 'string'
        ? (isDev ? req.url : req.url.split('?')[0])
        : req.url
      return { id: req.id, method: req.method, url }
    },
    res(res): { statusCode: number } {
      return { statusCode: res.statusCode }
    },
  },
})
