import type { RequestHandler } from 'express'

import type { ApiLeechDrillSession } from '@fsrs-japanese/shared-types'

import { withIdempotency } from '../lib/idempotency.ts'
import {
  createDrillSessionSchema,
  drillSessionIdParamSchema,
  drillSessionTransitionBodySchema,
  leechIdParamSchema,
  listLeechesQuerySchema,
  recordDrillAttemptSchema,
} from '../schemas/leech.schema.ts'
import * as leechService from '../services/leech.service.ts'

export const list: RequestHandler = async (req, res): Promise<void> => {
  const params = listLeechesQuerySchema.parse(req.query)
  const result = await leechService.listLeeches(req.user.id, params)
  res.json(result)
}

export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.getLeechById(req.user.id, id)
  res.json(leech)
}

export const resolve: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.resolveLeech(req.user.id, id)
  res.json(leech)
}

export const reopen: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  const leech  = await leechService.reopenLeech(req.user.id, id)
  res.json(leech)
}

export const createDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const input = createDrillSessionSchema.parse(req.body)
  const { status, body } = await withIdempotency<ApiLeechDrillSession>(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      const session = await leechService.createDrillSession(req.user.id, input)
      return { status: 201, body: session }
    },
  )
  if (status === 201) {
    // Resolvable via GET /drill-sessions/:sessionId (Stage 4).
    res.setHeader('Location', `/api/v1/leeches/drill-sessions/${body.sessionId}`)
  }
  res.status(status).json(body)
}

export const getDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  const session = await leechService.getDrillSession(req.user.id, sessionId)
  res.json(session)
}

export const recordDrillAttempt: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  const input         = recordDrillAttemptSchema.parse(req.body)
  const attempt       = await leechService.recordDrillAttempt(req.user.id, sessionId, input)
  // 201 because we're creating a new resource (the attempt). Idempotent
  // replays also return 201 — the body is identical to the original
  // attempt's, which is the right shape for the client either way.
  res.status(201).json(attempt)
}

export const finishDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  // Reject any body content other than `{}` so future fields can be added
  // without ambiguity. The .strict() check fires on unknown keys.
  drillSessionTransitionBodySchema.parse(req.body ?? {})
  const session = await leechService.transitionDrillSession(req.user.id, sessionId, 'finished')
  res.json(session)
}

export const abortDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  drillSessionTransitionBodySchema.parse(req.body ?? {})
  const session = await leechService.transitionDrillSession(req.user.id, sessionId, 'aborted')
  res.json(session)
}
