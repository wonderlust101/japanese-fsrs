import type { Logger, LoggerOptions } from "pino";
import { pino } from "pino";

import { env } from "./env.ts";

const isDev = env.NODE_ENV === "development";

/**
 * Paths that pino's `redact` walks on every log line, removing the matched
 * field before serialization. This is the safety net for production logs —
 * every per-call-site fix in the codebase is the primary defence; this is
 * what catches the accidental future regression. Wildcards match any depth
 * (one segment).
 *
 * Anything user-identifiable, secret, or session-bearing belongs here.
 * Add to this list when introducing a new sensitive field rather than
 * trusting downstream code to scrub it.
 */
const REDACT_PATHS_PROD = [
	"*.email",
	"*.password",
	"*.passwordHash",
	"*.token",
	"*.access_token",
	"*.accessToken",
	"*.refresh_token",
	"*.refreshToken",
	"*.idempotencyKey",
	// User-supplied vocabulary content (Japanese words, readings, meanings,
	// example sentences, mnemonics) lives in the JSONB `fieldsData` blob.
	// Redacting at the top-level field name keeps user content out of log
	// sinks even if a future debug log line attaches a card or fieldsData
	// payload as structured context. Pino's `remove: true` (below) deletes
	// the field entirely on serialization.
	"*.fieldsData",
	"req.headers.authorization",
	"req.headers.cookie",
	"res.headers[\"set-cookie\"]",
];

/**
 * In dev, scrub only literal passwords. Tokens, emails, auth headers, and
 * cookies are visible so a developer can correlate a request with the JWT
 * that produced it, the email of the test user, etc. NEVER deploy with
 * NODE_ENV=development; the prod list above is the wire-format contract for
 * any persistent log sink.
 */
const REDACT_PATHS_DEV = [
	"*.password",
	"*.passwordHash",
];

const options: LoggerOptions = {
	level: env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
	redact: { paths: isDev ? REDACT_PATHS_DEV : REDACT_PATHS_PROD, remove: true },
	base: { env: env.NODE_ENV },
	timestamp: pino.stdTimeFunctions.isoTime,
	...(isDev && {
		transport: {
			target: "pino-pretty",
			options: {
				colorize: true,
				translateTime: "HH:MM:ss.l",
				ignore: "pid,hostname",
				// Don't truncate object output — full bodies, full ZodError issue arrays, etc.
				singleLine: false,
			},
		},
	}),
};

/**
 * Root logger. Direct use is fine for module-init / startup paths only;
 *  call-site code should reach for `req.log` (request-scoped) or
 *  `componentLogger('component')` (service-scoped) instead.
 */
export const logger: Logger = pino(options);

/**
 * Module-scoped child logger for a service or library file. Tagged with
 * `component` so log lines from `card.service` / `auth.service` / etc.
 * group cleanly in any aggregator and stay greppable in dev.
 */
export function componentLogger(component: string): Logger {
	return logger.child({ component });
}
