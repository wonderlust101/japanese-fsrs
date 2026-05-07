import type { RequestHandler } from 'express'

import {
  createDeckSchema, updateDeckSchema, deckIdParamSchema, listDecksQuerySchema,
  type ApiDeck,
} from '@fsrs-japanese/shared-types'
import * as deckService from '../services/deck.service.ts'
import { withIdempotency } from '../lib/idempotency.ts'

export const list: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { limit, cursor } = listDecksQuerySchema.parse(req.query)
    const result = await deckService.listDecks(req.user.id, limit, cursor)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

export const get: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = deckIdParamSchema.parse(req.params)
    const deck   = await deckService.getDeck(id, req.user.id)
    res.json(deck)
  } catch (err) {
    next(err)
  }
}

export const create: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const input = createDeckSchema.parse(req.body)
    const { status, body } = await withIdempotency<ApiDeck>(
      req.user.id,
      req.header('idempotency-key'),
      input,
      async () => {
        const deck = await deckService.createDeck(req.user.id, input)
        return { status: 201, body: deck }
      },
    )
    if (status === 201) {
      res.setHeader('Location', `/api/v1/decks/${body.id}`)
    }
    res.status(status).json(body)
  } catch (err) {
    next(err)
  }
}

export const update: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = deckIdParamSchema.parse(req.params)
    const input  = updateDeckSchema.parse(req.body)
    const deck   = await deckService.updateDeck(id, req.user.id, input)
    res.json(deck)
  } catch (err) {
    next(err)
  }
}

export const remove: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = deckIdParamSchema.parse(req.params)
    await deckService.deleteDeck(id, req.user.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}
