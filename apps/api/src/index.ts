import { app } from './app.ts'
import { env } from './lib/env.ts'
import { logger } from './lib/logger.ts'
import { summarizeErr } from './lib/scrub.ts'
import { gracefulShutdown } from './lib/shutdown.ts'
import {
  probeOpenAIEmbeddingDimension,
  probeSupabaseConnectivity,
} from './lib/startup-probe.ts'

// Capture Node warnings (deprecations, MaxListenersExceededWarning,
// experimental APIs) into the structured pino stream. Without this they
// go to stderr — often a separate sink from stdout on deployment platforms,
// which means they can be silently discarded. Registered as the first
// executable statement so warnings emitted during the startup probes
// below are still captured.
process.on('warning', (warning) => {
  logger.warn(
    { name: warning.name, message: warning.message, stack: warning.stack },
    'node warning emitted',
  )
})

// Block startup on missing required dependencies and on configuration
// mismatch. Two probes run in parallel:
//   - Supabase connectivity: REQUIRED dep; fatal-and-exit on failure so ops
//     gets a clear "API can't start" signal vs. "API running but 503'ing".
//   - OpenAI embedding-dimension: configuration check (vector size matches
//     DB column). Transient OpenAI failures are non-fatal (warn + continue);
//     dimension mismatch is fatal.
// Catch any unexpected throw here so it surfaces as a structured fatal log
// (with redacted message + stack via summarizeErr) instead of bypassing pino
// and landing as Node's default unhandled-rejection stderr dump.
try {
  await Promise.all([
    probeSupabaseConnectivity(),
    probeOpenAIEmbeddingDimension(),
  ])
} catch (err) {
  logger.fatal({ err: summarizeErr(err) }, 'startup probe crashed')
  process.exit(1)
}

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API server listening')
})

// Catch listen-time errors (EADDRINUSE on a hot redeploy, EACCES on a low
// port) before they bubble as uncaughtException — without this listener
// the process crashes before any structured log line is written.
server.on('error', (err) => {
  logger.fatal({ err: { name: err.name, message: err.message }, port: env.PORT }, 'HTTP server error')
  process.exit(1)
})

// Defence-in-depth: every floating promise in apps/api/src is currently
// guarded (audit 2026-05-07), but any future regression should produce a
// structured pino line instead of Node's default stderr dump so log
// aggregators can correlate the crash with surrounding request lines.
process.on('unhandledRejection', (reason) => {
  logger.fatal(
    { reason: reason instanceof Error
        ? { name: reason.name, message: reason.message, stack: reason.stack }
        : { detail: String(reason) } },
    'unhandled promise rejection',
  )
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  logger.fatal({ err: { name: err.name, message: err.message, stack: err.stack } }, 'uncaught exception')
  process.exit(1)
})

// Graceful shutdown — orchestrators (Vercel/Fly/Kubernetes) send SIGTERM
// before SIGKILL. Without these handlers Node exits abruptly mid-request.
// gracefulShutdown:
//   1. Flips the `shuttingDown` flag so `_health/ready` returns 503
//      immediately (LB stops sending new traffic).
//   2. Calls server.close() — drains in-flight requests; refuses new ones.
//   3. Hard-exits at the 25s safety net if drain hangs.
// The handler is idempotent — multiple SIGTERMs are no-ops.
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM', server, logger) })
process.on('SIGINT',  () => { void gracefulShutdown('SIGINT',  server, logger) })

// Slow-loris hardening. Cap a single in-flight request to 30s of total wall
// time so a half-open connection that drips bytes can't park a worker
// indefinitely. Belt-and-braces: most deployment platforms (Vercel/Fly)
// enforce their own connection timeout in front of the app, but this
// guarantees the protection regardless of where the API runs.
server.requestTimeout   = 30_000
// Keep keepAlive longer than typical proxy idle timeouts (e.g. 60s on AWS ALB)
// so the proxy isn't left holding a half-closed socket.
server.keepAliveTimeout = 65_000
