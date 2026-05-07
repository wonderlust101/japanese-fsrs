import { pino, type Logger, type LoggerOptions } from 'pino'

import { env } from './env.ts'

const isDev = env.NODE_ENV === 'development'

/**
 * Paths that pino's `redact` walks on every log line, removing the matched
 * field before serialization. This is the safety net — every per-call-site
 * fix in the codebase is the primary defence; this is what catches the
 * accidental future regression. Wildcards match any depth (one segment).
 *
 * Anything user-identifiable, secret, or session-bearing belongs here.
 * Add to this list when introducing a new sensitive field rather than
 * trusting downstream code to scrub it.
 */
const REDACT_PATHS = [
  '*.email',
  '*.password',
  '*.passwordHash',
  '*.token',
  '*.access_token',
  '*.accessToken',
  '*.refresh_token',
  '*.refreshToken',
  '*.idempotencyKey',
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
]

const options: LoggerOptions = {
  level:     env.LOG_LEVEL ?? (isDev ? 'debug' : 'info'),
  redact:    { paths: REDACT_PATHS, remove: true },
  base:      { env: env.NODE_ENV },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev && {
    transport: {
      target:  'pino-pretty',
      options: {
        colorize:      true,
        translateTime: 'HH:MM:ss.l',
        ignore:        'pid,hostname',
      },
    },
  }),
}

/** Root logger. Direct use is fine for module-init / startup paths only;
 *  call-site code should reach for `req.log` (request-scoped) or
 *  `componentLogger('component')` (service-scoped) instead. */
export const logger: Logger = pino(options)

/**
 * Module-scoped child logger for a service or library file. Tagged with
 * `component` so log lines from `card.service` / `auth.service` / etc.
 * group cleanly in any aggregator and stay greppable in dev.
 */
export function componentLogger(component: string): Logger {
  return logger.child({ component })
}
