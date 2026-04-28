import express from 'express'
import cors from 'cors'

import { errorHandler } from './middleware/errorHandler.ts'
import authRouter    from './routes/auth.ts'
import profileRouter from './routes/profile.ts'
import decksRouter   from './routes/decks.ts'
import aiRouter      from './routes/ai.ts'

// CORS_ORIGIN accepts a comma-separated list for multiple origins.
// Default covers local Next.js dev server.
const allowedOrigins = (process.env['CORS_ORIGIN'] ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())

export const app = express()

app.use(cors({
  origin: allowedOrigins,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
}))
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth',    authRouter)
app.use('/api/v1/profile', profileRouter)
app.use('/api/v1/decks',   decksRouter)
app.use('/api/v1/ai',     aiRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
