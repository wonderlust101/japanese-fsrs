import type { RequestHandler } from 'express'

import * as cardService from '../services/card.service.ts'

/**
 * POST /api/v1/admin/backfill-premade-embeddings
 *
 * Iterates premade source cards (user_id IS NULL, premade_deck_id IS NOT NULL)
 * with NULL embedding, generates each via OpenAI, and writes it back.
 * Returns a summary so ops can verify the run from the response body.
 *
 * Auth: X-Admin-Token (see middleware/admin.ts). Not gated by user JWT.
 */
export const backfillPremadeEmbeddings: RequestHandler = async (_req, res, next): Promise<void> => {
  try {
    const summary = await cardService.backfillPremadeEmbeddings()
    res.json(summary)
  } catch (err) {
    next(err)
  }
}
