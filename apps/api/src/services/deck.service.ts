import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { encodeCursor, decodeCursor } from '../lib/http.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { unsubscribeFromPremadeDeck } from './premade.service.ts'
import {
  State,
  deckTypeEnum,
  type ApiDeck, type ApiDeckWithStats, type ApiList,
  type CreateDeckInput, type UpdateDeckInput,
} from '@fsrs-japanese/shared-types'

// ─── Column projections ───────────────────────────────────────────────────────
// Keep these in sync with the return interfaces below. Never use select('*').

const DECK_COLUMNS = [
  'id',
  'name',
  'description',
  'deck_type',
  'is_premade_fork',
  'source_premade_id',
  'card_count',
  'version',
  'created_at',
  'updated_at',
].join(', ')

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Raw snake_case deck row. Inferred from DeckListRpcRowSchema (the schema
 *  is shared between the list_decks_paginated RPC and direct .from('decks')
 *  reads, since the column projections match). */
type DeckDbRow = z.infer<typeof DeckListRpcRowSchema>

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Mirrors the analytics.service.ts / review.service.ts precedent: parse the
// RPC result so any future column drift surfaces as a clean ZodError. Shared
// with direct .from('decks').select(...) reads.
const DeckListRpcRowSchema = z.object({
  id:                z.string(),
  name:              z.string(),
  description:       z.string().nullable(),
  deck_type:         deckTypeEnum,
  is_premade_fork:   z.boolean(),
  source_premade_id: z.string().nullable(),
  card_count:        z.number(),
  version:           z.number(),
  created_at:        z.string(),
  updated_at:        z.string(),
})

/** Slim projection used by deleteDeck to detect premade-fork ownership. */
const DeckOwnerRowSchema = z.object({
  id:                z.string(),
  is_premade_fork:   z.boolean(),
  source_premade_id: z.string().nullable(),
})

/** Cursor payload for the decks-list endpoint. The `list_decks_paginated`
 *  RPC re-derives the sort timestamp from the row pointed to by `id`, so the
 *  cursor only needs to carry `id` today. Object shape preserves room for
 *  future fields without breaking the wire contract. */
const deckListCursorSchema = z.object({ id: z.string().uuid() })

/** Maps a raw DB row (snake_case) to the camelCase API shape. */
function toRow(raw: DeckDbRow): ApiDeck {
  return {
    id:              raw.id,
    name:            raw.name,
    description:     raw.description,
    deckType:        raw.deck_type,
    isPremadeFork:   raw.is_premade_fork,
    sourcePremadeId: raw.source_premade_id,
    cardCount:       raw.card_count,
    version:         raw.version,
    createdAt:       raw.created_at,
    updatedAt:       raw.updated_at,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of decks owned by the given user.
 * Backed by the `list_decks_paginated` RPC (migrations 20260522000000 +
 * 20260523000000). Orders by `(created_at DESC, id DESC)` — both keys are
 * immutable, so the cursor is provably stable across concurrent UPDATEs.
 */
export async function listDecks(
  userId:  string,
  limit:   number,
  cursor?: string,
): Promise<ApiList<ApiDeck>> {
  // Decode opaque cursor → bare id for the RPC. See lib/http.ts for the
  // cursor format rationale.
  const cursorId = cursor !== undefined ? decodeCursor(cursor, deckListCursorSchema).id : null

  const { data, error } = await supabaseAdmin.rpc('list_decks_paginated', asPayload({
    p_user_id: userId,
    p_limit:   limit + 1,
    p_cursor:  cursorId,
  }))

  if (error !== null) {
    throw dbError('list decks', error)
  }

  const rows    = z.array(DeckListRpcRowSchema).parse(data ?? [])
  const hasMore = rows.length > limit
  const items   = rows.slice(0, limit).map(toRow)
  const lastId  = items[items.length - 1]?.id

  return {
    items,
    nextCursor: hasMore && lastId !== undefined ? encodeCursor({ id: lastId }) : null,
    hasMore,
  }
}

/**
 * Returns a single deck with computed review stats.
 *
 * Throws 404 if the deck does not exist or does not belong to the user.
 * Three queries run in parallel: the deck row, due-card count, and new-card count.
 */
export async function getDeck(deckId: string, userId: string): Promise<ApiDeckWithStats> {
  const now = new Date().toISOString()

  const [deckResult, dueResult, newResult] = await Promise.all([
    supabaseAdmin
      .from('decks')
      .select(DECK_COLUMNS)
      .eq('id', deckId)
      .eq('user_id', userId)
      .single(),

    // Cards due now: due <= now AND not suspended. Uses user_id to scope
    // to this user's cards only (service role bypasses RLS).
    supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .lte('due', now)
      .eq('is_suspended', false),

    // Cards never reviewed.
    supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .eq('state', State.New),
  ])

  if (deckResult.error !== null || deckResult.data === null) {
    // PGRST116 = no rows from .single() — deck missing or wrong owner.
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }

  return {
    ...toRow(DeckListRpcRowSchema.parse(deckResult.data)),
    dueCount: dueResult.count ?? 0,
    newCount: newResult.count ?? 0,
  }
}

/**
 * Creates a new deck owned by the given user.
 *
 * @param userId - Taken from the verified JWT; never from the request body.
 */
export async function createDeck(userId: string, input: CreateDeckInput): Promise<ApiDeck> {
  const { data, error } = await supabaseAdmin
    .from('decks')
    .insert({
      user_id:     userId,
      name:        input.name,
      description: input.description ?? null,
      deck_type:   input.deckType,
    })
    .select(DECK_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw dbError('create deck', error)
  }

  return toRow(DeckListRpcRowSchema.parse(data))
}

/**
 * Applies a partial update to a deck via the `update_deck_with_version_check`
 * RPC and returns the refreshed row.
 *
 * Optimistic concurrency: caller must pass `expectedVersion` (from a prior
 * detail-view fetch). Mismatch → 412. Missing deck or wrong owner → 404.
 * Successful UPDATE bumps `version` by 1 inside the RPC.
 */
export async function updateDeck(
  deckId:          string,
  userId:          string,
  input:           UpdateDeckInput,
  expectedVersion: number,
): Promise<ApiDeck> {
  const patch: Record<string, unknown> = {}
  if (input.name        !== undefined) patch['name']        = input.name
  if (input.description !== undefined) patch['description'] = input.description
  if (input.deckType    !== undefined) patch['deck_type']   = input.deckType
  if (input.isPublic    !== undefined) patch['is_public']   = input.isPublic

  const { data, error } = await supabaseAdmin.rpc('update_deck_with_version_check', asPayload({
    p_deck_id:          deckId,
    p_user_id:          userId,
    p_expected_version: expectedVersion,
    p_patch:            patch,
  }))

  if (error !== null) {
    // RPC raises 'deck_not_found' with SQLSTATE 02000 when the row is missing
    // or owned by another user.
    if (error.code === '02000' && error.message.includes('deck_not_found')) {
      throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
    }
    // RPC raises 'deck_version_mismatch' with SQLSTATE 22000 when the
    // optimistic-concurrency check fails — caller's snapshot is stale.
    if (error.code === '22000' && error.message.includes('deck_version_mismatch')) {
      throw new AppError(412, 'Deck has been modified since you loaded it; refresh and retry', { code: 'VERSION_CONFLICT' })
    }
    throw dbError('update deck', error)
  }

  // RPC returns the freshly-updated row (migration 20260528000000), so we
  // skip the previous follow-up SELECT round-trip. Stats columns (due/new
  // counts) are intentionally NOT included in the PATCH response — those
  // belong to GET /decks/:id and would require additional queries to compute.
  const rows = z.array(DeckListRpcRowSchema).parse(data ?? [])
  const updated = rows[0]
  if (updated === undefined) {
    // RPC succeeded but returned no row — only reachable if the row was
    // concurrently deleted between UPDATE and RETURN QUERY.
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }
  return toRow(updated)
}

/**
 * Deletes a deck and all of its cards (cascade is set in the DB schema).
 *
 * For premade-fork decks, delegates to `unsubscribeFromPremadeDeck` so the
 * matching `user_premade_subscriptions` row is also removed atomically. The
 * subscription has no FK to `decks` (only to `premade_decks`), so a plain
 * deck DELETE would leave it orphaned and break the next subscribe attempt
 * via the unique-constraint on (user_id, premade_deck_id).
 *
 * Throws 404 if the deck does not exist or does not belong to the user.
 */
export async function deleteDeck(deckId: string, userId: string): Promise<void> {
  const { data, error: fetchError } = await supabaseAdmin
    .from('decks')
    .select('id, is_premade_fork, source_premade_id')
    .eq('id', deckId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }

  const deck = DeckOwnerRowSchema.parse(data)

  // Premade fork → use the unsubscribe path so deck + subscription delete
  // atomically (via the unsubscribe_from_premade_deck RPC).
  if (deck.is_premade_fork && deck.source_premade_id !== null) {
    await unsubscribeFromPremadeDeck(userId, deck.source_premade_id)
    return
  }

  const { error: deleteError } = await supabaseAdmin
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId)

  if (deleteError !== null) {
    throw dbError('delete deck', deleteError)
  }
}
