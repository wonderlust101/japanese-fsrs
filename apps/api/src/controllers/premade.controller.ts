import type { RequestHandler } from 'express'

import {
  listPremadeDecksQuerySchema,
  premadeDeckIdParamSchema,
} from '../schemas/premade.schema.ts'
import * as premadeService from '../services/premade.service.ts'

/**
 * GET /api/v1/premade-decks
 * Returns active premade decks, optionally filtered.
 */
export const list: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const filters = listPremadeDecksQuerySchema.parse(req.query)
    const data    = await premadeService.listPremadeDecks(filters)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/premade-decks/:id
 * Returns a single active premade deck.
 */
export const get: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = premadeDeckIdParamSchema.parse(req.params)
    const data   = await premadeService.getPremadeDeck(id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/premade-decks/subscriptions/me
 * Returns the authenticated user's subscriptions and the linked forked decks.
 */
export const subscriptions: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const data = await premadeService.listSubscriptions(req.user.id)
    res.json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/premade-decks/:id/subscribe
 * Subscribes the user and clones the source cards into a new personal deck.
 * Returns 201 on first subscribe and 200 on idempotent re-subscribe.
 */
export const subscribe: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = premadeDeckIdParamSchema.parse(req.params)
    const data   = await premadeService.subscribeToPremadeDeck(req.user.id, id)
    res.status(data.alreadyExisted ? 200 : 201).json(data)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/premade-decks/:id/subscribe
 * Removes the subscription and the forked deck (along with its cards via cascade).
 */
export const unsubscribe: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = premadeDeckIdParamSchema.parse(req.params)
    await premadeService.unsubscribeFromPremadeDeck(req.user.id, id)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
}
