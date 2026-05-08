import type { RequestHandler } from 'express'

import type { ApiSubscribeResult } from '@fsrs-japanese/shared-types'
import {
  listPremadeDecksQuerySchema,
  premadeDeckIdParamSchema,
} from '../schemas/premade.schema.ts'
import * as premadeService from '../services/premade.service.ts'
import { cacheControl } from '../lib/http.ts'
import { withIdempotency } from '../lib/idempotency.ts'

const PREMADE_MAX_AGE_SECONDS = 600

/**
 * GET /api/v1/premade-decks
 * Returns active premade decks, optionally filtered.
 */
export const list: RequestHandler = async (req, res): Promise<void> => {
  const filters = listPremadeDecksQuerySchema.parse(req.query)
  const data    = await premadeService.listPremadeDecks(filters)
  cacheControl(res, PREMADE_MAX_AGE_SECONDS)
  res.json(data)
}

/**
 * GET /api/v1/premade-decks/:id
 * Returns a single active premade deck.
 */
export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = premadeDeckIdParamSchema.parse(req.params)
  const data   = await premadeService.getPremadeDeck(id)
  cacheControl(res, PREMADE_MAX_AGE_SECONDS)
  res.json(data)
}

/**
 * GET /api/v1/premade-decks/subscriptions/me
 * Returns the authenticated user's subscriptions and the linked forked decks.
 */
export const subscriptions: RequestHandler = async (req, res): Promise<void> => {
  const data = await premadeService.listSubscriptions(req.user.id)
  res.json(data)
}

/**
 * POST /api/v1/premade-decks/:id/subscribe
 * Subscribes the user and clones the source cards into a new personal deck.
 * Returns 201 + Location on first subscribe and 200 on idempotent re-subscribe.
 *
 * Requires `Idempotency-Key`: subscribe is the largest-blast-radius write in
 * the API (clones every source card). Same key + same premadeDeckId → replay
 * the original 201/200 response without re-cloning. Race-condition fallback
 * inside the service still handles the case where two clients with different
 * idempotency keys subscribe to the same deck concurrently.
 */
export const subscribe: RequestHandler = async (req, res): Promise<void> => {
  const { id } = premadeDeckIdParamSchema.parse(req.params)
  const { status, body } = await withIdempotency<ApiSubscribeResult>(
    req.user.id,
    req.header('idempotency-key'),
    { premadeDeckId: id },
    async () => {
      const data = await premadeService.subscribeToPremadeDeck(req.user.id, id)
      return { status: data.alreadyExisted ? 200 : 201, body: data }
    },
  )
  if (status === 201) {
    res.setHeader('Location', `/api/v1/decks/${body.deckId}`)
  }
  res.status(status).json(body)
}

/**
 * DELETE /api/v1/premade-decks/:id/subscribe
 * Removes the subscription and the forked deck (along with its cards via cascade).
 */
export const unsubscribe: RequestHandler = async (req, res): Promise<void> => {
  const { id } = premadeDeckIdParamSchema.parse(req.params)
  await premadeService.unsubscribeFromPremadeDeck(req.user.id, id)
  res.status(204).send()
}
