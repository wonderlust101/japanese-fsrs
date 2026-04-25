import express from 'express'

import { errorHandler } from './middleware/errorHandler.ts'

const app = express()

// ── Body parsing ────────────────────────────────────────────────────────────
app.use(express.json())
app.use(express.urlencoded({ extended: false }))

// ── Health check (no auth) ──────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// ── API routes ──────────────────────────────────────────────────────────────
// Routes are mounted here under /api/v1 as they are implemented.

// ── Global error handler — must be last ────────────────────────────────────
app.use(errorHandler)

// ── Start server ────────────────────────────────────────────────────────────
const PORT = Number(process.env['PORT'] ?? 3001)

app.listen(PORT, () => {
  console.log(`API server listening on port ${PORT}`)
})

export { app }
