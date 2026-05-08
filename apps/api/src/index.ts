import { app } from './app.ts'
import { env } from './lib/env.ts'
import { logger } from './lib/logger.ts'
import { probeOpenAIEmbeddingDimension } from './lib/startup-probe.ts'

// Block startup on a wrong-dimension embedding model — see startup-probe.ts.
// Transient OpenAI errors are non-fatal (logged + continue).
await probeOpenAIEmbeddingDimension()

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

// Slow-loris hardening. Cap a single in-flight request to 30s of total wall
// time so a half-open connection that drips bytes can't park a worker
// indefinitely. Belt-and-braces: most deployment platforms (Vercel/Fly)
// enforce their own connection timeout in front of the app, but this
// guarantees the protection regardless of where the API runs.
server.requestTimeout   = 30_000
// Keep keepAlive longer than typical proxy idle timeouts (e.g. 60s on AWS ALB)
// so the proxy isn't left holding a half-closed socket.
server.keepAliveTimeout = 65_000
