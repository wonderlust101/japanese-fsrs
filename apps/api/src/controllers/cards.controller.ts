import type { Request, RequestHandler } from 'express'

import {
  createCardSchema,
  updateCardSchema,
  cardIdParamSchema,
  nestedDeckIdParamSchema,
  listCardsQuerySchema,
  forgetCardBodySchema,
} from '@fsrs-japanese/shared-types'
import type {
  ApiCard,
  FieldsData,
  GeneratedCardData,
} from '@fsrs-japanese/shared-types'

import { emptyBodySchema } from '../schemas/leech.schema.ts'
import * as cardService    from '../services/card.service.ts'
import * as aiService      from '../services/ai.service.ts'
import * as profileService from '../services/profile.service.ts'
import { forgetCard, rescheduleFromHistory } from '../services/fsrs.service.ts'
import { withIdempotency } from '../lib/idempotency.ts'
import { parseIfMatchVersion } from '../lib/http.ts'

/**
 * GET /api/v1/decks/:deckId/cards
 * Returns a paginated list of cards in the given deck.
 */
export const list: RequestHandler = async (req, res): Promise<void> => {
  const { deckId }                 = nestedDeckIdParamSchema.parse(req.params)
  const { limit, cursor, status }  = listCardsQuerySchema.parse(req.query)
  const result                     = await cardService.listCards(deckId, req.user.id, limit, cursor, status)
  res.json(result)
}

/**
 * GET /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Returns a single card by ID. When the deck-scoped path is used, the card
 * must also belong to that deck — protects the dual-mount router from
 * cross-deck lookups (see app.ts:48).
 */
export const get: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  const card   = await cardService.getCard(id, req.user.id, scopedDeckId(req))
  res.json(card)
}

/**
 * POST /api/v1/decks/:deckId/cards
 * Creates a new card. Two modes:
 *   - AI path: body contains `word` → generates fields_data via OpenAI
 *   - Manual path: body contains `fields_data` directly
 * FSRS state is always initialized to New regardless of mode.
 */
export const create: RequestHandler = async (req, res): Promise<void> => {
  const { deckId } = nestedDeckIdParamSchema.parse(req.params)
  const input      = createCardSchema.parse(req.body)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      // createCardSchema is a discriminated union on `mode`; narrow on the
      // discriminator so the chosen branch's fields are typed correctly and
      // a future schema change can't silently mis-route requests. The
      // createCard service accepts either validated FieldsData (manual path)
      // or raw GeneratedCardData (AI path) — see services/card.service.ts.
      let fieldsData: FieldsData | GeneratedCardData

      if (input.mode === 'ai') {
        const profile = await profileService.getProfile(req.user.id)
        fieldsData = await aiService.generateCard(
          input.word,
          profile.jlptTarget ?? 'N5',
          profile.interests,
          { signal: req.signal },
        )
      } else {
        // The wire-level `fieldsDataSchema` validates inputs as a permissive
        // `Record<string, unknown>` (cards.schema.ts:22) because the AI and
        // manual paths share the same shape on the wire. The service's
        // `FieldsData` union is narrower (Backend Completion Plan Stage 12
        // tightened the sentence-layout arm). The unknown-cast at the
        // boundary acknowledges this gap: runtime correctness is enforced
        // by the `cards_fields_data_shape` DB CHECK constraint, which
        // rejects any shape FieldsData would reject before the row lands.
        fieldsData = input.fieldsData as unknown as FieldsData
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
}

/**
 * PATCH /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Partially updates a card's content fields. FSRS state is never modified here.
 * Requires `If-Match: <version>` (optimistic concurrency); mismatch → 412.
 */
export const update: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  const input  = updateCardSchema.parse(req.body)
  const expectedVersion = parseIfMatchVersion(req.header('if-match'))
  const card   = await cardService.updateCard(id, req.user.id, input, expectedVersion, scopedDeckId(req))
  res.json(card)
}

/**
 * DELETE /api/v1/cards/:id  (or /api/v1/decks/:deckId/cards/:id)
 * Deletes a card. The DB trigger decrements the parent deck's card_count.
 */
export const remove: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  await cardService.deleteCard(id, req.user.id, scopedDeckId(req))
  res.status(204).end()
}

/**
 * GET /api/v1/cards/:id/similar  (or /api/v1/decks/:deckId/cards/:id/similar)
 * Returns semantically similar cards via pgvector cosine distance.
 * Returns an empty array if the card has no embedding yet.
 */
export const similar: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  const cards  = await cardService.getSimilarCards(id, req.user.id, scopedDeckId(req))
  res.json(cards)
}

/**
 * POST /api/v1/cards/:id/regenerate-embedding  (or deck-scoped)
 * Regenerates the semantic embedding for a card via OpenAI.
 * Called when a card's content (word, reading, meaning) has been updated
 * and the cached embedding is stale.
 *
 * Requires `Idempotency-Key` so retries after a network blip don't re-bill
 * OpenAI — same key + same cardId replays the original 204 No Content.
 * `req.signal` is forwarded to the embedding call so a client disconnect
 * short-circuits the (billable) OpenAI roundtrip.
 *
 * Returns 204 No Content on success.
 */
export const regenerateEmbedding: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  const { status } = await withIdempotency<null>(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id },
    async () => {
      await cardService.regenerateEmbedding(id, req.user.id, scopedDeckId(req), { signal: req.signal })
      return { status: 204, body: null }
    },
  )
  res.status(status).end()
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

/**
 * POST /api/v1/cards/:id/forget
 * Resets a card to state=New (Anki's "Forget" semantic). Optional body
 * `{ resetCount: boolean }` — when true, zeroes lifetime reps + lapses
 * counters too. When false (default), the state resets but counters are
 * preserved for analytics.
 *
 * Throws 403 `PREMADE_CARD_NOT_RESETTABLE` if the card is a premade source
 * (user_id is NULL), 404 if the card doesn't belong to the caller.
 *
 * Requires `Idempotency-Key` header. Same key + same body returns the
 * original response without re-running the service. The service itself is
 * naturally idempotent — re-running forget on the same card produces the
 * same New state.
 */
export const forget: RequestHandler = async (req, res): Promise<void> => {
  const { id }         = cardIdParamSchema.parse(req.params)
  const { resetCount } = forgetCardBodySchema.parse(req.body ?? {})

  const { status, body } = await withIdempotency(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id, resetCount },
    async () => {
      const result = await forgetCard(id, req.user.id, resetCount)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/**
 * POST /api/v1/cards/:id/reschedule
 * Replays the card's full review history to recompute its FSRS state from
 * scratch. Useful when FSRS algorithm weights change (e.g. after a
 * `computeParameters` run) or after a long absence where the learner wants
 * the schedule recalibrated.
 *
 * Throws 404 if the card doesn't belong to the caller, 409
 * `RESCHEDULE_NO_HISTORY` if the card has no eligible review logs, 409
 * `RESCHEDULE_NO_RESULT` if ts-fsrs returns no result (rare; library bug
 * marker).
 *
 * Requires `Idempotency-Key`. The service is deterministic from history —
 * same inputs produce the same recomputed state.
 */
export const reschedule: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  emptyBodySchema.parse(req.body ?? {})

  const { status, body } = await withIdempotency(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id },
    async () => {
      const result = await rescheduleFromHistory(id, req.user.id)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}
