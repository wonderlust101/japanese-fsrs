import type { RequestHandler } from 'express'

import type { ApiLeechDrillSession, ApiLeechListItem } from '@fsrs-japanese/shared-types'

import { withIdempotency } from '../lib/idempotency.ts'
import {
  createDrillSessionSchema,
  drillSessionIdParamSchema,
  emptyBodySchema,
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

export const diagnoseLeech: RequestHandler = async (req, res): Promise<void> => {
  const { id } = leechIdParamSchema.parse(req.params)
  // Strict-empty body check: rejects `{ foo: 'bar' }` with VALIDATION_ERROR
  // rather than silently ignoring extra fields. Defense-in-depth — future
  // feature additions must bump the schema explicitly.
  emptyBodySchema.parse(req.body ?? {})

  // Idempotency-Key required per the project standard for retryable mutations
  // with business consequence on duplicate execution (OpenAI cost). The replay
  // key payload includes only `leechId` — the sole client-controlled dimension
  // for diagnose. Same key + same leech replay returns the original response
  // without re-calling OpenAI; same key + different leech returns 422
  // IDEMPOTENCY_KEY_CONFLICT.
  //
  // The DB-level replay-on-existing semantic still applies on a *fresh*
  // idempotency key: a client that mints a new key but targets a leech
  // already populated with diagnosis returns the stored values without an
  // OpenAI call. Belt and suspenders.
  const { status, body } = await withIdempotency<ApiLeechListItem>(
    req.user.id,
    req.header('idempotency-key'),
    { leechId: id },
    async () => {
      const leech = await leechService.diagnoseLeech(req.user.id, id)
      return { status: 200, body: leech }
    },
  )
  res.status(status).json(body)
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
  emptyBodySchema.parse(req.body ?? {})
  const session = await leechService.transitionDrillSession(req.user.id, sessionId, 'finished')
  res.json(session)
}

export const abortDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  emptyBodySchema.parse(req.body ?? {})
  const session = await leechService.transitionDrillSession(req.user.id, sessionId, 'aborted')
  res.json(session)
}
