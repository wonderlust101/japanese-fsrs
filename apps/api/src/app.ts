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

app.use(helmet())
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
app.use('/api/v1/decks/:deckId/cards', cardsRouter)
app.use('/api/v1/cards',               cardsRouter)
app.use('/api/v1/analytics',           analyticsRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
