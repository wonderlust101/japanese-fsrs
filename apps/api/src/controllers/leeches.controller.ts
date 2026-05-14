import type { RequestHandler } from 'express'

import type { ApiLeechDrillSession } from '@fsrs-japanese/shared-types'

import { withIdempotency } from '../lib/idempotency.ts'
import {
  createDrillSessionSchema,
  drillSessionIdParamSchema,
  leechIdParamSchema,
  listLeechesQuerySchema,
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
