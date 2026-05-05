import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { errorHandler } from './middleware/errorHandler.ts'
import authRouter    from './routes/auth.ts'
import profileRouter from './routes/profile.ts'
import decksRouter   from './routes/decks.ts'
import aiRouter      from './routes/ai.ts'
import cardsRouter   from './routes/cards.ts'
import reviewsRouter   from './routes/reviews.ts'
import analyticsRouter from './routes/analytics.ts'
import premadeRouter   from './routes/premade.ts'
import adminRouter     from './routes/admin.ts'

// CORS_ORIGIN accepts a comma-separated list for multiple origins.
// Default covers local Next.js dev server.
const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())

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

// ── API routes ──────────────────────────────────────────────────────────────
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
app.use('/api/v1/admin',               adminRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
