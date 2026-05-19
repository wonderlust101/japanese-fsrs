import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { encodeCursor, decodeCursor } from '../lib/http.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import {
  State,
  deckTypeEnum,
  type ApiCopyDeckResult,
  type ApiDeck, type ApiDeckWithStats, type ApiList,
  type CreateDeckInput, type UpdateDeckInput,
} from '@fsrs-japanese/shared-types'

const log = componentLogger('deck.service')

// ─── Column projections ───────────────────────────────────────────────────────
// Keep these in sync with the return interfaces below. Never use select('*').

const DECK_COLUMNS = [
  'id',
  'name',
  'description',
  'deck_type',
  // `is_premade_fork` was dropped in Backend Completion Plan Stage 4 (copy
  // model). `source_premade_id` stays as attribution-only — non-null means
  // "this deck started from a premade catalogue entry"; nothing branches on
  // it anymore.
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
// with direct .from('decks').select(...) reads — rollup columns added in
// Backend Completion Plan Stage 3 are `.optional()` here so the schema can
// validate both shapes (RPC carries them; direct table reads do not).
const DeckListRpcRowSchema = z.object({
  id:                z.string(),
  name:              z.string(),
  description:       z.string().nullable(),
  deck_type:         deckTypeEnum,
  // `is_premade_fork` removed in Backend Completion Plan Stage 4 (copy
  // model). The column no longer exists on the decks table.
  source_premade_id: z.string().nullable(),
  card_count:        z.number(),
  version:           z.number(),
  created_at:        z.string(),
  updated_at:        z.string(),
  // Stage 3 — present on list_decks_paginated rows, absent on direct
  // `.from('decks').select(DECK_COLUMNS)` reads. Kept optional rather
  // than splitting into a second schema so the existing shared usage in
  // createDeck / updateDeck continues to parse cleanly.
  due_count:         z.number().optional(),
  new_count:         z.number().optional(),
  mature_count:      z.number().optional(),
  due_new_count:     z.number().optional(),
  due_review_count:  z.number().optional(),
  last_reviewed_at:  z.string().nullable().optional(),
})

/** Slim projection used by deleteDeck for the existence check. After the
 *  Backend Completion Plan Stage 4 (copy model) refactor, all decks delete
 *  through the same path — no branch on `is_premade_fork`, so we only need
 *  the `id` to confirm the row exists and is owned by the caller. */
const DeckOwnerRowSchema = z.object({
  id: z.string(),
})

/** Envelope for the `copy_user_deck` RPC (migration 20260621000000). Mirrors
 *  the `copy_premade_deck` envelope in premade.service.ts. The RPC always
 *  RETURN QUERYs one row carrying the new deck id + the count of cards
 *  cloned into it; a zero-row return indicates a regression. */
const CopyDeckRpcRowSchema = z.object({
  deck_id:    z.string(),
  card_count: z.number(),
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
    sourcePremadeId: raw.source_premade_id,
    cardCount:       raw.card_count,
    version:         raw.version,
    createdAt:       raw.created_at,
    updatedAt:       raw.updated_at,
  }
}

/**
 * Maps a raw RPC row carrying rollup columns to the ApiDeckWithStats wire
 * shape. Used by listDecks (Backend Completion Plan Stage 3 — collapses the
 * per-deck `getDeck` fanout into one round-trip).
 *
 * If the rollup fields are missing (e.g. the caller piped a non-RPC row in
 * by mistake), counts fall back to 0 and last_reviewed_at to null — the
 * service-layer Zod validation already rejected drift before reaching here,
 * so the COALESCE is a safety net rather than a silent data path.
 */
function toRowWithStats(raw: DeckDbRow): ApiDeckWithStats {
  return {
    ...toRow(raw),
    dueCount:       raw.due_count        ?? 0,
    newCount:       raw.new_count        ?? 0,
    matureCount:    raw.mature_count     ?? 0,
    dueNewCount:    raw.due_new_count    ?? 0,
    dueReviewCount: raw.due_review_count ?? 0,
    lastReviewedAt: raw.last_reviewed_at ?? null,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of decks owned by the given user, with
 * per-deck rollups (due / new / mature counts + last-reviewed timestamp)
 * computed server-side. Backed by the `list_decks_paginated` RPC.
 *
 * The rollups were added by Backend Completion Plan Stage 3 (migration
 * `20260606000000_list_decks_paginated_rollups.sql`) to collapse the
 * dashboard's N+1 fanout — `/today` and `/decks` previously fired one
 * `getDeck` call per visible deck just to read the same counts. The wire
 * shape is now `ApiDeckWithStats`, additive over the prior `ApiDeck` shape
 * (old clients ignore the new fields).
 *
 * Orders by `(created_at DESC, id DESC)` — both keys are immutable, so the
 * cursor is provably stable across concurrent UPDATEs.
 */
export async function listDecks(
  userId:  string,
  limit:   number,
  cursor?: string,
): Promise<ApiList<ApiDeckWithStats>> {
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
  const items   = rows.slice(0, limit).map(toRowWithStats)
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
 * Seven parallel queries: the deck row, total due, total new, mature,
 * due/new split, due/review split, and last-reviewed timestamp.
 *
 * The list endpoint computes the same rollups via `list_decks_paginated`
 * (Backend Completion Plan Stage 3). For a single deck, keeping the
 * direct-table-query path is simpler than narrowing the RPC to one row —
 * the index coverage on (deck_id, user_id) handles each filter cheaply.
 */
export async function getDeck(deckId: string, userId: string): Promise<ApiDeckWithStats> {
  const now = new Date().toISOString()

  // Seven parallel queries: deck row, total due, total new, mature
  // (state=Review AND interval ≥ 21d, Anki convention), the new/review
  // split of `due`, and the deck-wide last_review timestamp.
  const [deckResult, dueResult, newResult, matureResult, dueNewResult, dueReviewResult, lastReviewedResult] = await Promise.all([
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

    // Mature: graduated to Review state with scheduled interval ≥ 21 days.
    // Suspended cards excluded so the mature % reflects what's actively in
    // rotation (matches how dueCount excludes suspended cards).
    supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .eq('state', State.Review)
      .eq('is_suspended', false)
      .gte('scheduled_days', 21),

    // Due breakdown — new cards portion of the due bucket.
    supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .lte('due', now)
      .eq('is_suspended', false)
      .eq('state', State.New),

    // Due breakdown — review portion (everything in due that is NOT state=New).
    // We count anything with state != New (Learning / Review / Relearning) to
    // keep this exhaustive against any future state-enum changes.
    supabaseAdmin
      .from('cards')
      .select('id', { count: 'exact', head: true })
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .lte('due', now)
      .eq('is_suspended', false)
      .neq('state', State.New),

    // Last review across any card in this deck — mirrors the
    // `MAX(cards.last_review)` aggregate that list_decks_paginated computes
    // server-side (Stage 3 migration). Returned as a single-row max via
    // ORDER BY DESC + LIMIT 1; `.maybeSingle()` handles the empty-deck case
    // by returning `data: null` without raising.
    supabaseAdmin
      .from('cards')
      .select('last_review')
      .eq('deck_id', deckId)
      .eq('user_id', userId)
      .not('last_review', 'is', null)
      .order('last_review', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (deckResult.error !== null || deckResult.data === null) {
    // PGRST116 = no rows from .single() — deck missing or wrong owner.
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }

  // `.maybeSingle()` returns null data (not error) on empty result. A real
  // query error still surfaces as `lastReviewedResult.error` and is treated
  // as a 500 — same convention as the count queries above.
  if (lastReviewedResult.error !== null) {
    throw dbError('read deck last_review', lastReviewedResult.error)
  }
  const lastReviewedAt = (lastReviewedResult.data?.last_review ?? null) as string | null

  return {
    ...toRow(DeckListRpcRowSchema.parse(deckResult.data)),
    dueCount:       dueResult.count       ?? 0,
    newCount:       newResult.count       ?? 0,
    matureCount:    matureResult.count    ?? 0,
    dueNewCount:    dueNewResult.count    ?? 0,
    dueReviewCount: dueReviewResult.count ?? 0,
    lastReviewedAt,
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
 * Backend Completion Plan Stage 4 (copy model) collapsed the prior
 * premade-fork branch — without a subscription junction to keep in sync,
 * every deck (catalogue-copied or hand-rolled) deletes identically through
 * the same path. The ownership SELECT stays so we can distinguish "not
 * found / wrong owner" from a delete failure.
 *
 * Throws 404 if the deck does not exist or does not belong to the user.
 */
export async function deleteDeck(deckId: string, userId: string): Promise<void> {
  const { data, error: fetchError } = await supabaseAdmin
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }

  // Defensive parse — keeps drift on the slim SELECT surface as a clean
  // ZodError instead of letting a malformed row reach the delete branch.
  DeckOwnerRowSchema.parse(data)

  const { error: deleteError } = await supabaseAdmin
    .from('decks')
    .delete()
    .eq('id', deckId)
    .eq('user_id', userId)

  if (deleteError !== null) {
    throw dbError('delete deck', deleteError)
  }
}

/**
 * Duplicates a user-owned deck into a new standalone deck. Backed by the
 * `copy_user_deck` RPC (migration 20260621000000). Atomic on the SQL side:
 * either the new `decks` row plus every cloned card lands, or nothing does.
 *
 * Behavior contract (mirrors the migration header):
 *   - Cloned cards start with fresh FSRS state (state=0, due=NOW, reps=0,
 *     lapses=0). Source review history stays with the original deck.
 *   - Tags and `is_suspended` are NOT carried; suspended source cards are
 *     skipped entirely.
 *   - Embeddings are carried so similarity search works without a backfill.
 *   - Caller-supplied `name` (trimmed) wins. When omitted, the RPC resolves
 *     `<source> (Copy)`, `<source> (Copy 2)`, … until the name is unique
 *     within the caller's decks.
 *
 * Premade source decks (`user_id IS NULL`) and cross-user attempts both
 * fail closed with 404 `DECK_NOT_FOUND` — the RPC's ownership check does
 * not distinguish "missing" from "not yours" so we don't leak ownership
 * signals. Premade copying still goes through `copyPremadeDeck`.
 *
 * Idempotency: callers pass `Idempotency-Key` at the controller layer via
 * `withIdempotency`. Same key + same payload → replay the original 201
 * response without re-cloning. Deliberate duplicate copies (e.g. "I want a
 * second fresh start") use distinct keys and produce independent decks —
 * that's intentional under the copy model.
 */
export async function copyDeck(
  userId:       string,
  sourceDeckId: string,
  name?:        string,
): Promise<ApiCopyDeckResult> {
  const { data, error } = await supabaseAdmin.rpc('copy_user_deck', asPayload({
    p_user_id:        userId,
    p_source_deck_id: sourceDeckId,
    p_target_name:    name ?? null,
  }))

  if (error !== null) {
    // RPC raises `deck_not_found` with SQLSTATE 02000 (no_data_found) when
    // the source is missing, owned by another user, or a premade source
    // row (user_id IS NULL). Translate to HTTP 404 — same code/shape the
    // get/update/delete paths use.
    if (error.code === '02000' && error.message.includes('deck_not_found')) {
      throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
    }
    throw dbError('copy deck', error)
  }

  const rows = z.array(CopyDeckRpcRowSchema).parse(data ?? [])
  const row  = rows[0]
  if (row === undefined) {
    // RPC succeeded but returned no row — should never happen under the
    // contract (the RPC always RETURN QUERYs one row). Surface as 500 so
    // a future regression is loud rather than silently returning empty.
    throw new AppError(500, 'Copy RPC returned no row', { code: 'DECK_COPY_RPC_EMPTY' })
  }

  log.info(
    { userId, sourceDeckId, deckId: row.deck_id, cardCount: row.card_count },
    'copied user deck',
  )

  return {
    deckId:    row.deck_id,
    cardCount: row.card_count,
  }
}
