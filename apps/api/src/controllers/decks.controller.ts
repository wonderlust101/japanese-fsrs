import type { RequestHandler } from 'express'

import {
  createDeckSchema, updateDeckSchema, deckIdParamSchema, listDecksQuerySchema,
  copyDeckSchema,
  type ApiDeck, type ApiCopyDeckResult,
} from '@fsrs-japanese/shared-types'
import * as deckService from '../services/deck.service.ts'
import { withIdempotency } from '../lib/idempotency.ts'
import { parseIfMatchVersion } from '../lib/http.ts'

export const list: RequestHandler = async (req, res): Promise<void> => {
  const { limit, cursor } = listDecksQuerySchema.parse(req.query)
  const result = await deckService.listDecks(req.user.id, limit, cursor)
  res.json(result)
}

export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = deckIdParamSchema.parse(req.params)
  const deck   = await deckService.getDeck(id, req.user.id)
  res.json(deck)
}

export const create: RequestHandler = async (req, res): Promise<void> => {
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
}

export const update: RequestHandler = async (req, res): Promise<void> => {
  const { id } = deckIdParamSchema.parse(req.params)
  const input  = updateDeckSchema.parse(req.body)
  const expectedVersion = parseIfMatchVersion(req.header('if-match'))
  const deck   = await deckService.updateDeck(id, req.user.id, input, expectedVersion)
  res.json(deck)
}

export const remove: RequestHandler = async (req, res): Promise<void> => {
  const { id } = deckIdParamSchema.parse(req.params)
  await deckService.deleteDeck(id, req.user.id)
  res.status(204).end()
}

/**
 * POST /api/v1/decks/:id/copy
 *
 * Duplicates a user-owned deck. Optional `name` body field overrides the
 * server's default "<source> (Copy)" naming. Returns 201 with the new
 * `{ deckId, cardCount }` plus a `Location` header pointing at the new deck.
 *
 * Mirrors the premade-copy controller shape:
 *   - Idempotency-Key required by convention — copy is a large-blast-radius
 *     write (clones every non-suspended source card). Same key + same body
 *     → replay original response. Deliberate duplicates use a new key.
 *   - Body is `.strict()` so unknown keys are rejected up front.
 *   - Premade source decks and cross-user attempts both fail closed as
 *     404 `DECK_NOT_FOUND` (see service for the no-ownership-leak rationale).
 */
export const copy: RequestHandler = async (req, res): Promise<void> => {
  const { id }   = deckIdParamSchema.parse(req.params)
  const { name } = copyDeckSchema.parse(req.body ?? {})

  const { status, body } = await withIdempotency<ApiCopyDeckResult>(
    req.user.id,
    req.header('idempotency-key'),
    { sourceDeckId: id, name: name ?? null },
    async () => {
      const data = await deckService.copyDeck(req.user.id, id, name)
      return { status: 201, body: data }
    },
  )
  if (status === 201) {
    res.setHeader('Location', `/api/v1/decks/${body.deckId}`)
  }
  res.status(status).json(body)
}
