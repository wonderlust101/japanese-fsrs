import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { errorHandler } from './middleware/errorHandler.ts'
import { requestLogger } from './middleware/requestLogger.ts'
import { env }          from './lib/env.ts'
import authRouter    from './routes/auth.ts'
import healthRouter  from './routes/health.ts'
import profileRouter from './routes/profile.ts'
import decksRouter   from './routes/decks.ts'
import aiRouter      from './routes/ai.ts'
import cardsRouter   from './routes/cards.ts'
import reviewsRouter   from './routes/reviews.ts'
import analyticsRouter from './routes/analytics.ts'
import premadeRouter   from './routes/premade.ts'
import leechesRouter   from './routes/leeches.ts'
import tomoRouter      from './routes/tomo.ts'

// CORS_ORIGIN parses to string[] in env.ts (split + URL-validated).
// Default covers local Next.js dev server.
const allowedOrigins = env.CORS_ORIGIN

export const app = express()

// Trust the first proxy hop so req.ip reflects the real client when deployed
// behind Vercel/Fly/Render. Required before any IP-based rate limit or audit log.
app.set('trust proxy', 1)
app.disable('x-powered-by')

app.use(helmet({
  // Bumped to 2 years + preload for hstspreload.org submission eligibility.
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  // No legitimate self-framing for a JSON API.
  frameguard: { action: 'deny' },
}))
app.use(cors({
  origin: allowedOrigins,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}))
app.use(express.json({ limit: '100kb' }))
app.use(express.urlencoded({ extended: false, limit: '100kb' }))

// Structured per-request logging (pino-http). Mounted after body parsers so
// `req.id` is available to any subsequent middleware / handler that wants to
// log via `req.log`. Honors incoming X-Request-ID; sets it on the response.
app.use(requestLogger)

// Dev-only request body logger. Pino-http does not log request bodies, so
// without this we only see method/url/headers. Production omits this so log
// sinks stay free of PII; the prod redact config wouldn't catch fields we
// haven't named yet (e.g. a future `creditCardNumber`).
if (env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    if (req.body !== undefined && req.body !== null && Object.keys(req.body).length > 0) {
      req.log?.debug({ body: req.body }, 'request body')
    }
    next()
  })
}

// ── API routes ──────────────────────────────────────────────────────────────
// Health endpoints are mounted first and intentionally unauthenticated so
// orchestrators (Kubernetes / Vercel / Fly) can probe liveness/readiness
// without a bearer token. /_health/deep exposes breaker state — see
// routes/health.ts for the security note.
app.use('/api/v1/_health', healthRouter)
app.use('/api/v1/auth',    authRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/decks',   decksRouter)
app.use('/api/v1/premade-decks',        premadeRouter)
app.use('/api/v1/ai',                   aiRouter)
app.use('/api/v1/reviews',             reviewsRouter)
// cardsRouter is mounted at two paths intentionally. Both are used by the
// frontend (apps/web/lib/actions/cards.actions.ts):
//   /api/v1/decks/:deckId/cards          — collection ops scoped to a deck
//                                           (list, create, get-in-deck-context)
//   /api/v1/cards/:id/...                — single-card ops independent of deck
//                                           (patch, delete, similar, regenerate-embedding)
// Removing either mount will break the frontend. The `mergeParams: true` on
// the router (routes/cards.ts) lets handlers read req.params.deckId when present.
app.use('/api/v1/decks/:deckId/cards', cardsRouter)
app.use('/api/v1/cards',               cardsRouter)
app.use('/api/v1/analytics',           analyticsRouter)
app.use('/api/v1/leeches',             leechesRouter)
app.use('/api/v1/tomo',                tomoRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
