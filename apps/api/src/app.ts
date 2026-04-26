import express from 'express'

import { errorHandler } from './middleware/errorHandler.ts'
import authRouter    from './routes/auth.ts'
import profileRouter from './routes/profile.ts'

export const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth',    authRouter)
app.use('/api/v1/profile', profileRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
