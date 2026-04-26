import express from 'express'

import { errorHandler } from './middleware/errorHandler.ts'
import authRouter from './routes/auth.ts'

export const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/v1/auth', authRouter)

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)
