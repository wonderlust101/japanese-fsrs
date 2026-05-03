import type { RequestHandler } from 'express'

import {
  createCardSchema,
  updateCardSchema,
  cardIdParamSchema,
  deckIdParamSchema,
  listCardsQuerySchema,
} from '../schemas/card.schema.ts'
import * as cardService    from '../services/card.service.ts'
import * as aiService      from '../services/ai.service.ts'
import * as profileService from '../services/profile.service.ts'

/**
 * GET /api/v1/decks/:deckId/cards
 * Returns a paginated list of cards in the given deck.
 */
export const list: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { deckId }                 = deckIdParamSchema.parse(req.params)
    const { limit, cursor, status }  = listCardsQuerySchema.parse(req.query)
    const result                     = await cardService.listCards(deckId, req.user.id, limit, cursor, status)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/cards/:id
 * Returns a single card by ID.
 */
export const get: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const card   = await cardService.getCard(id, req.user.id)
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
    const { deckId } = deckIdParamSchema.parse(req.params)
    const input      = createCardSchema.parse(req.body)

    let fieldsData: Record<string, unknown>

    if ('word' in input) {
      const profile = await profileService.getProfile(req.user.id)
      fieldsData    = await aiService.generateCard(
        input.word,
        profile.jlpt_target ?? 'N5',
        profile.interests   ?? [],
      ) as unknown as Record<string, unknown>
    } else {
      fieldsData = input.fields_data
    }

    const card = await cardService.createCard(deckId, req.user.id, fieldsData, {
      card_type:      input.card_type,
      layout_type:    input.layout_type,
      tags:           input.tags,
      jlpt_level:     input.jlpt_level,
      parent_card_id: input.parent_card_id,
    })

    res.status(201).json(card)
  } catch (err) {
    next(err)
  }
}

/**
 * PATCH /api/v1/cards/:id
 * Partially updates a card's content fields. FSRS state is never modified here.
 */
export const update: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const input  = updateCardSchema.parse(req.body)
    const card   = await cardService.updateCard(id, req.user.id, input)
    res.json(card)
  } catch (err) {
    next(err)
  }
}

/**
 * DELETE /api/v1/cards/:id
 * Deletes a card. The DB trigger decrements the parent deck's card_count.
 */
export const remove: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    await cardService.deleteCard(id, req.user.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

/**
 * GET /api/v1/cards/:id/similar
 * Returns semantically similar cards via pgvector cosine distance.
 * Returns an empty array if the card has no embedding yet.
 */
export const similar: RequestHandler = async (req, res, next): Promise<void> => {
  try {
    const { id } = cardIdParamSchema.parse(req.params)
    const cards  = await cardService.getSimilarCards(id, req.user.id)
    res.json(cards)
  } catch (err) {
    next(err)
  }
}
