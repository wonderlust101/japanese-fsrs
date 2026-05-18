import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { encodeCursor, decodeCursor } from '../lib/http.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

const log = componentLogger('premade.service')
import type { ListPremadeDecksQuery } from '../schemas/premade.schema.ts'
import {
  deckTypeEnum,
  jlptLevelEnum,
  type ApiList,
  type ApiPremadeDeck,
  type ApiCopyPremadeDeckResult,
} from '@fsrs-japanese/shared-types'

// ─── Column projections ───────────────────────────────────────────────────────

const PREMADE_COLUMNS = [
  'id',
  'name',
  'description',
  'deck_type',
  'jlpt_level',
  'domain',
  'card_count',
  'is_active',
  'created_at',
  'updated_at',
].join(', ')

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Raw snake_case premade-deck row. Inferred from PremadeDeckListRpcRowSchema
 *  (the schema is shared between the list_premade_decks_paginated RPC and
 *  direct .from('premade_decks') reads). */
type PremadeDeckDbRow = z.infer<typeof PremadeDeckListRpcRowSchema>

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Mirrors the analytics / review precedent: parse the RPC result so any future
// column drift surfaces as a clean ZodError. Shared with direct
// .from('premade_decks').select(...) reads.
//
// Backend Completion Plan Stage 4 (copy model) dropped `version`; the column
// no longer exists on premade_decks. The schema follows.
const PremadeDeckListRpcRowSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().nullable(),
  deck_type:   deckTypeEnum,
  jlpt_level:  jlptLevelEnum.nullable(),
  domain:      z.string().nullable(),
  card_count:  z.number(),
  is_active:   z.boolean(),
  created_at:  z.string(),
  updated_at:  z.string(),
})

/** Cursor payload for the premade-decks-list endpoint. The
 *  `list_premade_decks_paginated` RPC re-derives the sort key from the row
 *  pointed to by `id`, so the cursor only needs to carry `id` today. Object
 *  shape leaves room to add fields without a wire-format break. */
const premadeListCursorSchema = z.object({ id: z.string().uuid() })

// Backend Completion Plan Stage 4 (copy model) envelope. The copy RPC returns
// one row carrying the newly-created deck id and the count of cards cloned
// into it. No subscription junction, no "alreadyExisted" flag — duplicates
// are allowed by design.
const CopyRpcRowSchema = z.object({
  deck_id:    z.string(),
  card_count: z.number(),
})

function toPremadeRow(raw: PremadeDeckDbRow): ApiPremadeDeck {
  return {
    id:          raw.id,
    name:        raw.name,
    description: raw.description,
    deckType:    raw.deck_type,
    jlptLevel:   raw.jlpt_level,
    domain:      raw.domain,
    cardCount:   raw.card_count,
    isActive:    raw.is_active,
    createdAt:   raw.created_at,
    updatedAt:   raw.updated_at,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of active premade decks, optionally filtered.
 * Backed by the `list_premade_decks_paginated` RPC (migration 20260522000000).
 * Order: (jlpt_level ASC NULLS LAST, name ASC, id ASC).
 */
export async function listPremadeDecks(
  filters: ListPremadeDecksQuery,
): Promise<ApiList<ApiPremadeDeck>> {
  const cursorId = filters.cursor !== undefined
    ? decodeCursor(filters.cursor, premadeListCursorSchema).id
    : null

  const { data, error } = await supabaseAdmin.rpc('list_premade_decks_paginated', asPayload({
    p_limit:      filters.limit + 1,
    p_cursor:     cursorId,
    p_deck_type:  filters.deckType  ?? null,
    p_jlpt_level: filters.jlptLevel ?? null,
    p_domain:     filters.domain    ?? null,
  }))

  if (error !== null) {
    throw dbError('list premade decks', error)
  }

  const rows    = z.array(PremadeDeckListRpcRowSchema).parse(data ?? [])
  const hasMore = rows.length > filters.limit
  const items   = rows.slice(0, filters.limit).map(toPremadeRow)
  const lastId  = items[items.length - 1]?.id

  return {
    items,
    nextCursor: hasMore && lastId !== undefined ? encodeCursor({ id: lastId }) : null,
    hasMore,
  }
}

/**
 * Returns a single active premade deck by ID. Throws 404 if missing or inactive.
 */
export async function getPremadeDeck(id: string): Promise<ApiPremadeDeck> {
  const { data, error } = await supabaseAdmin
    .from('premade_decks')
    .select(PREMADE_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Premade deck not found', { code: 'PREMADE_DECK_NOT_FOUND' })
  }

  return toPremadeRow(PremadeDeckListRpcRowSchema.parse(data))
}

/**
 * Copies a premade deck into a new standalone deck owned by the user. Atomic
 * on the SQL side: either a new `decks` row plus every cloned card lands, or
 * nothing does. Backend Completion Plan Stage 4 (copy model) replaces the
 * earlier `subscribe_to_premade_deck` RPC.
 *
 * Duplicates are allowed by design: two consecutive calls for the same user
 * + premade deck produce two independent decks. The caller's idempotency key
 * (set at the controller layer via `withIdempotency`) is the only guard
 * against accidental double-clicks; deliberate duplicate copies remain
 * legitimate ("I want to restart fresh while keeping the old deck's
 * progress").
 *
 * Cards in the new deck start with fresh FSRS state (state=0, due=NOW,
 * reps=0, lapses=0). Embeddings are carried from the source row so
 * similarity search works on day 1 without a backfill.
 *
 * Throws 404 `PREMADE_DECK_NOT_FOUND` when the source is missing or
 * `is_active = FALSE`; any other RPC failure surfaces via `dbError()`.
 */
export async function copyPremadeDeck(
  userId: string,
  premadeDeckId: string,
): Promise<ApiCopyPremadeDeckResult> {
  const { data, error } = await supabaseAdmin.rpc('copy_premade_deck', asPayload({
    p_user_id:         userId,
    p_premade_deck_id: premadeDeckId,
  }))

  if (error !== null) {
    // The new RPC raises `premade_deck_not_found` with SQLSTATE 02000
    // (no_data_found) when the source is inactive or missing. Translate
    // to HTTP 404 — same code the previous subscribe path used.
    if (error.code === '02000' && error.message.includes('premade_deck_not_found')) {
      throw new AppError(404, 'Premade deck not found', { code: 'PREMADE_DECK_NOT_FOUND' })
    }
    throw dbError('copy premade deck', error)
  }

  const rows = z.array(CopyRpcRowSchema).parse(data ?? [])
  const row  = rows[0]
  if (row === undefined) {
    // RPC succeeded but returned no row — should never happen under the
    // new contract (the RPC always RETURN QUERYs one row). Surface as 500
    // so a future regression is loud.
    throw new AppError(500, 'Copy RPC returned no row', { code: 'PREMADE_COPY_RPC_EMPTY' })
  }

  log.info(
    { userId, premadeDeckId, deckId: row.deck_id, cardCount: row.card_count },
    'copied premade deck',
  )

  return {
    deckId:    row.deck_id,
    cardCount: row.card_count,
  }
}
