import type { IncomingMessage, ServerResponse } from 'node:http'
import { pinoHttp } from 'pino-http'

import { logger } from '../lib/logger.ts'

/**
 * Pino-HTTP request logger. Emits an INFO entry log on every incoming
 * request and a level-by-status-code completion log when the response
 * finishes. Decorates `req` with `req.log` (a child logger tagged with
 * `reqId`) so downstream middleware and handlers can attach
 * request-correlated structured fields without re-deriving the id.
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

  // Trim the auto-serialized req/res so log payloads stay tight. The redact
  // config in lib/logger.ts also strips authorization + cookie headers; the
  // explicit shape below removes everything else by default.
  serializers: {
    req(req): { id: unknown; method: unknown; url: unknown; hasAuth: boolean } {
      return {
        id:      req.id,
        method:  req.method,
        url:     req.url,
        hasAuth: req.headers?.authorization !== undefined,
      }
    },
    res(res): { statusCode: number } {
      return { statusCode: res.statusCode }
    },
  },
})
