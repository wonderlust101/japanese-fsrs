import type { Request, RequestHandler } from 'express'

import { z } from 'zod'

import {
  createCardSchema,
  updateCardSchema,
  cardIdParamSchema,
  nestedDeckIdParamSchema,
  listCardsQuerySchema,
} from '@fsrs-japanese/shared-types'
import { AppError } from '../middleware/errorHandler.ts'
import type { ApiCard } from '@fsrs-japanese/shared-types'
import * as cardService    from '../services/card.service.ts'
import * as aiService      from '../services/ai.service.ts'
import * as profileService from '../services/profile.service.ts'
import { withIdempotency } from '../lib/idempotency.ts'

/**
 * GET /api/v1/decks/:deckId/cards
 * Returns a paginated list of cards in the given deck.
 */
export const list: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { deckId }                 = nestedDeckIdParamSchema.parse(req.params)
    const { limit, cursor, status }  = listCardsQuerySchema.parse(req.query)
    const result                     = await cardService.listCards(deckId, req.user.id, limit, cursor, status)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Returns a single card by ID. When the deck-scoped path is used, the card
 * must also belong to that deck — protects the dual-mount router from
 * cross-deck lookups (see app.ts:48).
 */
export const get: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const card   = await cardService.getCard(id, req.user.id, scopedDeckId(req))
    res.json(card)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/decks/:deckId/cards
 * Creates a new card. Two modes:
 *   - AI path: body contains `word` → generates fields_data via OpenAI
 *   - Manual path: body contains `fields_data` directly
 * FSRS state is always initialized to New regardless of mode.
 */
export const create: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { deckId } = nestedDeckIdParamSchema.parse(req.params)
    const input      = createCardSchema.parse(req.body)

    const { status, body } = await withIdempotency<ApiCard>(
      req.user.id,
      req.header('idempotency-key'),
      input,
      async () => {
        let fieldsData: Record<string, unknown>

        if ('word' in input) {
          const profile  = await profileService.getProfile(req.user.id)
          const generated = await aiService.generateCard(
            input.word,
            profile.jlptTarget ?? 'N5',
            profile.interests,
          )
          // GeneratedCardData has known string keys; widen to the JSONB-compatible
          // Record<string, unknown> shape that createCard / fields_data persistence accepts.
          fieldsData = generated as Record<string, unknown>
        } else {
          fieldsData = input.fieldsData
        }

        const card = await cardService.createCard(deckId, req.user.id, fieldsData, {
          cardType:     input.cardType,
          layoutType:   input.layoutType,
          tags:         input.tags,
          jlptLevel:    input.jlptLevel,
          parentCardId: input.parentCardId,
        })

        return { status: 201, body: card }
      },
    )

    if (status === 201) {
      res.setHeader('Location', `/api/v1/cards/${body.id}`)
    }
    res.status(status).json(body)
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Partially updates a card's content fields. FSRS state is never modified here.
 * Requires `If-Match: <version>` (optimistic concurrency); mismatch → 412.
 */
export const update: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const input  = updateCardSchema.parse(req.body)
    const expectedVersion = parseIfMatchVersion(req.header('if-match'))
    const card   = await cardService.updateCard(id, req.user.id, input, expectedVersion, scopedDeckId(req))
    res.json(card)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Deletes a card. The DB trigger decrements the parent deck's card_count.
 */
export const remove: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    await cardService.deleteCard(id, req.user.id, scopedDeckId(req))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/cards/:id/similar  (or /api/v1/decks/:deckId/cards/:id/similar)
 * Returns semantically similar cards via pgvector cosine distance.
 * Returns an empty array if the card has no embedding yet.
 */
export const similar: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const cards  = await cardService.getSimilarCards(id, req.user.id, scopedDeckId(req))
    res.json(cards)
  } catch (err) {
    next(err)
  }
}

/**
 * POST /api/v1/cards/:id/regenerate-embedding  (or deck-scoped)
 * Regenerates the semantic embedding for a card via OpenAI.
 * Called when a card's content (word, reading, meaning) has been updated
 * and the cached embedding is stale.
 * Returns 204 No Content on success.
 */
export const regenerateEmbedding: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    await cardService.regenerateEmbedding(id, req.user.id, scopedDeckId(req))
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/**
 * Validates and returns the optional `:deckId` path param when the request
 * came in via the deck-scoped mount. Returns undefined when the request
 * came in via the flat /cards/:id mount.
 */
function scopedDeckId(req: Request): string | undefined {
  const raw = req.params['deckId']
  if (typeof raw !== 'string') return undefined
  return nestedDeckIdParamSchema.parse({ deckId: raw }).deckId
}

const ifMatchVersionSchema = z.coerce.number().int().min(1)

/**
 * Parses the `If-Match` header for optimistic concurrency on `PATCH /cards/:id`.
 * Missing → 428 Precondition Required (RFC 6585). Malformed → 400 via Zod.
 */
function parseIfMatchVersion(rawHeader: string | undefined): number {
  if (rawHeader === undefined) {
    throw new AppError(428, 'If-Match header required for card edits')
  }
  const result = ifMatchVersionSchema.safeParse(rawHeader)
  if (!result.success) {
    throw new AppError(400, 'If-Match must be a positive integer version')
  }
  return result.data
}
