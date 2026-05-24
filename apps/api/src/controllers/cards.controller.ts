import type { Request, RequestHandler } from 'express'

import {
  createCardSchema,
  updateCardSchema,
  cardIdParamSchema,
  nestedDeckIdParamSchema,
  listCardsQuerySchema,
  crossDeckListCardsQuerySchema,
  moveCardBodySchema,
  copyCardBodySchema,
  suspendCardBodySchema,
  bulkMoveCardsBodySchema,
  bulkSuspendCardsBodySchema,
  bulkUnsuspendCardsBodySchema,
  bulkDeleteCardsBodySchema,
  forgetCardBodySchema,
} from '@fsrs-japanese/shared-types'
import type {
  ApiBulkCardMutationResult,
  ApiCard,
  FieldsData,
  GeneratedCardData,
  GeneratedSentenceCard,
} from '@fsrs-japanese/shared-types'

import { emptyBodySchema } from '../schemas/weak-spot.schema.ts'
import * as cardService    from '../services/card.service.ts'
import type { CrossDeckListParams } from '../services/card.service.ts'
import * as deckService    from '../services/deck.service.ts'
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

  // Archived decks are frozen — no new cards (would invisibly grow a deck
  // the user thinks is shelved). 404/422 differentiation lives in the helper.
  await deckService.assertDeckActive(deckId, req.user.id)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    input,
    async () => {
      // createCardSchema is a discriminated union on `mode`; narrow on the
      // discriminator so the chosen branch's fields are typed correctly and
      // a future schema change can't silently mis-route requests. The
      // createCard service accepts either validated FieldsData (manual path)
      // or raw GeneratedCardData / GeneratedSentenceCard (AI paths) — see
      // services/card.service.ts.
      let fieldsData: FieldsData | GeneratedCardData | GeneratedSentenceCard

      if (input.mode === 'ai') {
        const profile = await profileService.getProfile(req.user.id)
        // Backend Completion Plan Stage 13 — dispatch the AI generator on
        // layoutType. Sentence-layout cards need ja/en/furigana (per the
        // Stage 12 schema + DB CHECK); vocabulary/grammar cards need
        // word/reading/meaning. A single `generateCard` for both would
        // tangle two diverging prompts.
        if (input.layoutType === 'sentence') {
          fieldsData = await aiService.generateSentenceCard(
            input.word,
            profile.jlptTarget ?? 'N5',
            profile.interests,
            { signal: req.signal },
          )
        } else {
          fieldsData = await aiService.generateCard(
            input.word,
            profile.jlptTarget ?? 'N5',
            profile.interests,
            { signal: req.signal },
          )
        }
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
        layoutType:   input.layoutType,
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
  await deckService.assertCardDeckActive(id, req.user.id)
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
  await deckService.assertCardDeckActive(id, req.user.id)
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

  await deckService.assertCardDeckActive(id, req.user.id)

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

  await deckService.assertCardDeckActive(id, req.user.id)

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

/**
 * GET /api/v1/cards/cross-deck
 * Cross-deck card-browser list. Filters: search, deckId, jlptLevel, status,
 * missingField, presentField, pitchPattern. Sort: recent | due | lapses.
 * Cursor-paginated. `missingField` and `presentField` are mutually exclusive
 * (the shared Zod schema rejects payloads that set both).
 *
 * Routed under both the flat (/api/v1/cards) and deck-scoped mounts; the
 * deck-scoped path's :deckId is intentionally ignored (the browser uses
 * the query-string deckId filter so users can move between decks without
 * re-routing). The handler doesn't read req.params.deckId.
 */
export const listCrossDeck: RequestHandler = async (req, res): Promise<void> => {
  const query = crossDeckListCardsQuerySchema.parse(req.query)

  // Build the params object incrementally to satisfy exactOptionalPropertyTypes:
  // the service signature treats absent and present-as-undefined as distinct,
  // so we omit the key entirely when the query value isn't set.
  const params: CrossDeckListParams = { limit: query.limit }
  if (query.offset       !== undefined) params.offset       = query.offset
  if (query.search       !== undefined) params.search       = query.search
  if (query.deckId       !== undefined) params.deckId       = query.deckId
  if (query.jlptLevel    !== undefined) params.jlptLevel    = query.jlptLevel
  if (query.status       !== undefined) params.status       = query.status
  if (query.missingField !== undefined) params.missingField = query.missingField
  if (query.presentField !== undefined) params.presentField = query.presentField
  if (query.pitchPattern !== undefined) params.pitchPattern = query.pitchPattern
  if (query.sort         !== undefined) params.sort         = query.sort
  if (query.sortDir      !== undefined) params.sortDir      = query.sortDir

  // Structured log at the request-decision point. Search is
  // intentionally elided (may contain user-typed text, mild PII).
  // Offset is small and unstructured enough to log directly. Mirrors
  // the redaction posture documented in CLAUDE.md.
  req.log.info(
    {
      filters: {
        deckId:       query.deckId,
        jlptLevel:    query.jlptLevel,
        status:       query.status,
        missingField: query.missingField,
        presentField: query.presentField,
        pitchPattern: query.pitchPattern,
        sort:         query.sort,
        sortDir:      query.sortDir,
        offset:       query.offset,
      },
    },
    'cards.crossDeck.list',
  )

  const result = await cardService.listCardsCrossDeck(req.user.id, params)
  res.json(result)
}

/**
 * POST /api/v1/cards/:id/move
 * Moves a card to a different deck. Siblings in other decks stay put —
 * only this row's deck_id changes. Card-count rollups on both decks are
 * adjusted atomically by the RPC.
 *
 * Requires `Idempotency-Key`. Premade source cards return 404 (the same
 * shape as a missing/foreign card) — they're never moveable.
 */
export const move: RequestHandler = async (req, res): Promise<void> => {
  const { id }     = cardIdParamSchema.parse(req.params)
  const { deckId } = moveCardBodySchema.parse(req.body)

  // Both ends of the move must be active. Source is gated via the card→deck
  // resolver; target deck is gated directly. Either check throwing produces
  // a 422 `DECK_ARCHIVED` (or 404) before the RPC runs.
  await deckService.assertCardDeckActive(id, req.user.id)
  await deckService.assertDeckActive(deckId, req.user.id)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id, deckId },
    async () => {
      const card = await cardService.moveCard(id, req.user.id, deckId)
      return { status: 200, body: card }
    },
  )
  res.status(status).json(body)
}

/**
 * POST /api/v1/cards/:id/copy
 * Adds a personal copy of this card to another deck. The new row joins
 * the source's sibling family (parent_card_id resolves to the source's
 * parent or to the source itself), gets fresh FSRS state, and is owned
 * by the caller. Returns the new card.
 *
 * Requires `Idempotency-Key`.
 */
export const copy: RequestHandler = async (req, res): Promise<void> => {
  const { id }     = cardIdParamSchema.parse(req.params)
  const { deckId } = copyCardBodySchema.parse(req.body)

  // Same dual gate as `move`: archived source freezes its cards, archived
  // target rejects new content. Cheaper to fail the request than to land a
  // row the user will have to unarchive to see.
  await deckService.assertCardDeckActive(id, req.user.id)
  await deckService.assertDeckActive(deckId, req.user.id)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id, deckId },
    async () => {
      const card = await cardService.copyCard(id, req.user.id, deckId)
      return { status: 201, body: card }
    },
  )
  if (status === 201) {
    res.setHeader('Location', `/api/v1/cards/${body.id}`)
  }
  res.status(status).json(body)
}

/**
 * POST /api/v1/cards/:id/suspend
 * Sets `is_suspended = TRUE`. FSRS state is preserved — when the card is
 * unsuspended later, the schedule picks up where it left off.
 */
export const suspend: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  suspendCardBodySchema.parse(req.body ?? {})

  await deckService.assertCardDeckActive(id, req.user.id)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id, op: 'suspend' },
    async () => {
      const card = await cardService.suspendCard(id, req.user.id)
      return { status: 200, body: card }
    },
  )
  res.status(status).json(body)
}

/**
 * POST /api/v1/cards/:id/unsuspend
 * Sets `is_suspended = FALSE`. Idempotent.
 */
export const unsuspend: RequestHandler = async (req, res): Promise<void> => {
  const { id } = cardIdParamSchema.parse(req.params)
  suspendCardBodySchema.parse(req.body ?? {})

  await deckService.assertCardDeckActive(id, req.user.id)

  const { status, body } = await withIdempotency<ApiCard>(
    req.user.id,
    req.header('idempotency-key'),
    { cardId: id, op: 'unsuspend' },
    async () => {
      const card = await cardService.unsuspendCard(id, req.user.id)
      return { status: 200, body: card }
    },
  )
  res.status(status).json(body)
}

// ─── Bulk mutations ──────────────────────────────────────────────────────────

/**
 * POST /api/v1/cards/bulk/move
 * Bulk-moves a set of cards to a target deck. Per-id outcomes are returned
 * so the UI can show partial-success states. Cards not owned by the caller
 * (or premade source rows) end up in `failed`.
 */
export const bulkMove: RequestHandler = async (req, res): Promise<void> => {
  const { ids, deckId } = bulkMoveCardsBodySchema.parse(req.body)

  const { status, body } = await withIdempotency<ApiBulkCardMutationResult>(
    req.user.id,
    req.header('idempotency-key'),
    { op: 'bulk-move', ids: [...ids].sort(), deckId },
    async () => {
      const result = await cardService.bulkMoveCards(ids, req.user.id, deckId)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/** POST /api/v1/cards/bulk/suspend */
export const bulkSuspend: RequestHandler = async (req, res): Promise<void> => {
  const { ids } = bulkSuspendCardsBodySchema.parse(req.body)

  const { status, body } = await withIdempotency<ApiBulkCardMutationResult>(
    req.user.id,
    req.header('idempotency-key'),
    { op: 'bulk-suspend', ids: [...ids].sort() },
    async () => {
      const result = await cardService.bulkSuspendCards(ids, req.user.id)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/** POST /api/v1/cards/bulk/unsuspend */
export const bulkUnsuspend: RequestHandler = async (req, res): Promise<void> => {
  const { ids } = bulkUnsuspendCardsBodySchema.parse(req.body)

  const { status, body } = await withIdempotency<ApiBulkCardMutationResult>(
    req.user.id,
    req.header('idempotency-key'),
    { op: 'bulk-unsuspend', ids: [...ids].sort() },
    async () => {
      const result = await cardService.bulkUnsuspendCards(ids, req.user.id)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

/** POST /api/v1/cards/bulk/delete */
export const bulkDelete: RequestHandler = async (req, res): Promise<void> => {
  const { ids } = bulkDeleteCardsBodySchema.parse(req.body)

  const { status, body } = await withIdempotency<ApiBulkCardMutationResult>(
    req.user.id,
    req.header('idempotency-key'),
    { op: 'bulk-delete', ids: [...ids].sort() },
    async () => {
      const result = await cardService.bulkDeleteCards(ids, req.user.id)
      return { status: 200, body: result }
    },
  )
  res.status(status).json(body)
}

