import type { RequestHandler } from 'express'

import type { ApiWeakSpotDrillSession, ApiWeakSpotListItem } from '@fsrs-japanese/shared-types'

import { withIdempotency } from '../lib/idempotency.ts'
import {
  createDrillSessionSchema,
  drillSessionIdParamSchema,
  emptyBodySchema,
  weakSpotIdParamSchema,
  listWeakSpotsQuerySchema,
  recordDrillAttemptSchema,
} from '../schemas/weak-spot.schema.ts'
import * as weakSpotService from '../services/weak-spot.service.ts'

export const list: RequestHandler = async (req, res): Promise<void> => {
  const params = listWeakSpotsQuerySchema.parse(req.query)
  const result = await weakSpotService.listWeakSpots(req.user.id, params)
  res.json(result)
}

export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = weakSpotIdParamSchema.parse(req.params)
  const weakSpot  = await weakSpotService.getWeakSpotById(req.user.id, id)
  res.json(weakSpot)
}

export const resolve: RequestHandler = async (req, res): Promise<void> => {
  const { id } = weakSpotIdParamSchema.parse(req.params)
  const weakSpot  = await weakSpotService.resolveWeakSpot(req.user.id, id)
  res.json(weakSpot)
}

export const reopen: RequestHandler = async (req, res): Promise<void> => {
  const { id } = weakSpotIdParamSchema.parse(req.params)
  const weakSpot  = await weakSpotService.reopenWeakSpot(req.user.id, id)
  res.json(weakSpot)
}

export const createDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const input = createDrillSessionSchema.parse(req.body)
  const { status, body } = await withIdempotency<ApiWeakSpotDrillSession>(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      const session = await weakSpotService.createDrillSession(req.user.id, input)
      return { status: 201, body: session }
    },
  )
  if (status === 201) {
    // Resolvable via GET /drill-sessions/:sessionId (Stage 4).
    res.setHeader('Location', `/api/v1/weak-spots/drill-sessions/${body.sessionId}`)
  }
  res.status(status).json(body)
}

export const getDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  const session = await weakSpotService.getDrillSession(req.user.id, sessionId)
  res.json(session)
}

export const diagnoseWeakSpot: RequestHandler = async (req, res): Promise<void> => {
  const { id } = weakSpotIdParamSchema.parse(req.params)
  // Strict-empty body check: rejects `{ foo: 'bar' }` with VALIDATION_ERROR
  // rather than silently ignoring extra fields. Defense-in-depth — future
  // feature additions must bump the schema explicitly.
  emptyBodySchema.parse(req.body ?? {})

  // Idempotency-Key required per the project standard for retryable mutations
  // with business consequence on duplicate execution (OpenAI cost). The replay
  // key payload includes only `weakSpotId` — the sole client-controlled dimension
  // for diagnose. Same key + same weakSpot replay returns the original response
  // without re-calling OpenAI; same key + different weakSpot returns 422
  // IDEMPOTENCY_KEY_CONFLICT.
  //
  // The DB-level replay-on-existing semantic still applies on a *fresh*
  // idempotency key: a client that mints a new key but targets a weakSpot
  // already populated with diagnosis returns the stored values without an
  // OpenAI call. Belt and suspenders.
  const { status, body } = await withIdempotency<ApiWeakSpotListItem>(
    req.user.id,
    req.header('idempotency-key'),
    { weakSpotId: id },
    async () => {
      const weakSpot = await weakSpotService.diagnoseWeakSpot(req.user.id, id)
      return { status: 200, body: weakSpot }
    },
  )
  res.status(status).json(body)
}

export const recordDrillAttempt: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  const input         = recordDrillAttemptSchema.parse(req.body)
  const attempt       = await weakSpotService.recordDrillAttempt(req.user.id, sessionId, input)
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
  const session = await weakSpotService.transitionDrillSession(req.user.id, sessionId, 'finished')
  res.json(session)
}

export const abortDrillSession: RequestHandler = async (req, res): Promise<void> => {
  const { sessionId } = drillSessionIdParamSchema.parse(req.params)
  emptyBodySchema.parse(req.body ?? {})
  const session = await weakSpotService.transitionDrillSession(req.user.id, sessionId, 'aborted')
  res.json(session)
}
