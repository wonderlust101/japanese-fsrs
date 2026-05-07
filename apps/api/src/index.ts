import { app } from './app.ts'
import { env } from './lib/env.ts'
import { logger } from './lib/logger.ts'

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'API server listening')
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
