import { z } from 'zod';

import { supabaseAdmin } from '../db/supabase.ts';
import { asPayload } from '../lib/db.ts';
import { componentLogger } from '../lib/logger.ts';
import { encodeCursor, decodeCursor } from '../lib/http.ts';
import { invalidateDueCache } from '../lib/due-cache.ts';
import { AppError, ServiceUnavailableError, dbError } from '../middleware/errorHandler.ts';
import { uuidIdCursorSchema } from '../schemas/common.schema.ts';
import { getInitialFsrsState } from './fsrs.service.ts';
import { backfillEmbedding } from './card.embeddings.ts';

// Re-exports: keep card.service.ts the public entry point for all card
// operations. Callers (controllers, scripts) import everything from here so
// the embeddings extraction is transparent at the call site. See
// services/card.embeddings.ts for the implementation.
export {
  regenerateEmbedding,
  backfillPremadeEmbeddings,
  generateEmbedding,
} from './card.embeddings.ts'

const log = componentLogger('card.service');
import {
    State,
    jlptLevelEnum,
    layoutTypeEnum,
    type ApiBulkCardMutationResult,
    type ApiCard,
    type ApiCardListItem,
    type ApiCrossDeckCardListItem,
    type ApiDueCard,
    type ApiList,
    type ApiSimilarCard,
    type CardMissingField,
    type CardPresentField,
    type CardSortField,
    type CardSortDir,
    type CardStatusFilter,
    type CrossDeckJlptFilter,
    type PitchPattern,
    type FieldsData,
    type GeneratedCardData,
    type GeneratedSentenceCard,
    type JLPTLevel,
    type LayoutType,
    type UpdateCardInput,
    assertNever,
} from '@fsrs-japanese/shared-types';

// ─── Column projection ────────────────────────────────────────────────────────
// Excludes tokens, parsed_at, embedding — internal/heavy fields not needed by clients.

export const CARD_COLUMNS = [
  'id',
  'user_id',
  'deck_id',
  'premade_deck_id',
  'layout_type',
  'fields_data',
  'parent_card_id',
  'jlpt_level',
  'state',
  'is_suspended',
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'last_review',
  'version',
  'created_at',
  'updated_at',
].join(', ')

// Slim projection for the review session — only the fields the UI renders.
// Mirrors ApiDueCard in shared-types. Keeps FSRS internals (stability,
// difficulty, reps, lapses, …) off the wire during reviews.
export const DUE_CARD_COLUMNS = [
  'id',
  'deck_id',
  'jlpt_level',
  'state',
  'due',
  'fields_data',
  'layout_type',
].join(', ')

// Slim projection for the deck card-browser list — mirrors ApiCardListItem.
export const CARD_LIST_COLUMNS = [
  'id',
  'fields_data',
  'layout_type',
  'jlpt_level',
  'state',
  'is_suspended',
  'due',
].join(', ')

// ─── Return shapes ────────────────────────────────────────────────────────────

export interface CardListResult {
  items:      ApiCardListItem[]
  nextCursor: string | null
  hasMore:    boolean
  totalCount: number
}

export interface CreateCardMeta {
  layoutType:   LayoutType
  jlptLevel:    JLPTLevel | undefined
  parentCardId: string | undefined
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Raw snake_case row shape returned by SELECT CARD_COLUMNS. Inferred from
 *  CardDbRowSchema below — the schema is the single source of truth. */
export type CardDbRow = z.infer<typeof CardDbRowSchema>

export function toCardRow(raw: CardDbRow): ApiCard {
  return {
    id:            raw.id,
    userId:        raw.user_id,
    deckId:        raw.deck_id,
    premadeDeckId: raw.premade_deck_id,
    layoutType:    raw.layout_type,
    fieldsData:    raw.fields_data as FieldsData,
    parentCardId:  raw.parent_card_id,
    jlptLevel:     raw.jlpt_level,
    state:         raw.state,
    isSuspended:   raw.is_suspended,
    due:           raw.due,
    stability:     raw.stability,
    difficulty:    raw.difficulty,
    elapsedDays:   raw.elapsed_days,
    scheduledDays: raw.scheduled_days,
    learningSteps: raw.learning_steps,
    reps:          raw.reps,
    lapses:        raw.lapses,
    lastReview:    raw.last_review,
    version:       raw.version,
    createdAt:     raw.created_at,
    updatedAt:     raw.updated_at,
  }
}

/** Raw snake_case row shape returned by SELECT DUE_CARD_COLUMNS. */
export type DueCardDbRow = Pick<
  CardDbRow,
  'id' | 'deck_id' | 'jlpt_level' | 'state' | 'due' | 'fields_data' | 'layout_type'
>

/** Maps a DUE_CARD_COLUMNS row to the wire-format ApiDueCard. */
export function toApiDueCard(raw: DueCardDbRow): ApiDueCard {
  return {
    id:         raw.id,
    deckId:     raw.deck_id,
    jlptLevel:  raw.jlpt_level,
    state:      raw.state,
    due:        raw.due,
    fieldsData: raw.fields_data as FieldsData,
    layoutType: raw.layout_type,
  }
}

/** Raw snake_case row shape returned by SELECT CARD_LIST_COLUMNS. */
export type CardListDbRow = Pick<
  CardDbRow,
  'id' | 'fields_data' | 'layout_type' | 'jlpt_level' | 'state' | 'is_suspended' | 'due'
>

/** Maps a CARD_LIST_COLUMNS row to the wire-format ApiCardListItem. */
export function toApiCardListItem(raw: CardListDbRow): ApiCardListItem {
  return {
    id:          raw.id,
    fieldsData:  raw.fields_data as FieldsData,
    layoutType:  raw.layout_type,
    jlptLevel:   raw.jlpt_level,
    state:       raw.state,
    isSuspended: raw.is_suspended,
    due:         raw.due,
  }
}

// ─── RPC envelope schemas ─────────────────────────────────────────────────────
// Module-level Zod schemas for the RPC return shapes consumed below. Mirrors
// the precedent in analytics.service.ts and review.service.ts: parsed at
// runtime so any future column-rename surfaces as a clean ZodError instead of
// silently propagating bad data.

/** Master schema mirroring CardDbRow (full SELECT CARD_COLUMNS shape). */
const CardDbRowSchema = z.object({
  id:              z.string(),
  user_id:         z.string().nullable(),
  deck_id:         z.string().nullable(),
  premade_deck_id: z.string().nullable(),
  layout_type:     layoutTypeEnum,
  fields_data:     z.record(z.string(), z.unknown()),
  parent_card_id:  z.string().nullable(),
  jlpt_level:      jlptLevelEnum.nullable(),
  state:           z.nativeEnum(State),
  is_suspended:    z.boolean(),
  due:             z.string(),
  stability:       z.number(),
  difficulty:      z.number(),
  elapsed_days:    z.number(),
  scheduled_days:  z.number(),
  learning_steps:  z.number(),
  reps:            z.number(),
  lapses:          z.number(),
  last_review:     z.string().nullable(),
  version:         z.number(),
  created_at:      z.string(),
  updated_at:      z.string(),
})

/** Slim projection returned by the `list_cards_paginated` RPC. */
const CardListRpcRowSchema = CardDbRowSchema.pick({
  id:           true,
  fields_data:  true,
  layout_type:  true,
  jlpt_level:   true,
  state:        true,
  is_suspended: true,
  due:          true,
})

/**
 * Slim projection returned by the `get_due_cards` RPC. Exported so
 * review.service.ts can validate the same shape without redefining it.
 */
export const DueCardRpcRowSchema = CardDbRowSchema.pick({
  id:          true,
  deck_id:     true,
  jlpt_level:  true,
  state:       true,
  due:         true,
  fields_data: true,
  layout_type: true,
})

/** Distinct shape returned by the `find_similar_cards` RPC (no FSRS state). */
const SimilarCardRpcRowSchema = z.object({
  id:          z.string(),
  deck_id:     z.string(),
  layout_type: layoutTypeEnum,
  fields_data: z.record(z.string(), z.unknown()),
  jlpt_level:  jlptLevelEnum.nullable(),
  similarity:  z.number(),
})

/** Cursor payload for the cards-list endpoint. The `list_cards_paginated`
 *  RPC re-derives `created_at` from the row pointed to by `id`, so the cursor
 *  itself only needs to carry `id` today. Shared with deck.service.ts and
 *  premade.service.ts via `uuidIdCursorSchema` — see schemas/common.schema.ts
 *  for the rationale on the object-shape (vs bare-string) cursor. */
const cardListCursorSchema = uuidIdCursorSchema

// ─── Internal helpers (cont.) ─────────────────────────────────────────────────

/** Verifies a deck exists and belongs to the given user. Throws 404 otherwise. */
async function assertDeckOwnership(deckId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of cards in a deck owned by the user.
 * Optional `status` filter: 'new', 'learning' (includes relearning), 'review', 'suspended'.
 *
 * Backed by the `list_cards_paginated` RPC, which folds the deck-ownership
 * check, cursor resolution, and the page query into one round-trip and
 * uses tuple comparison `(created_at, id) < (cursor_at, cursor_id)` so that
 * cards sharing a `created_at` (e.g. siblings cloned in subscribe_to_premade_deck)
 * don't drop out at page boundaries.
 *
 * Throws 404 if the deck does not exist or belongs to a different user.
 */
export async function listCards(
  deckId:  string,
  userId:  string,
  limit:   number,
  cursor?: string,
  status?: CardStatusFilter,
): Promise<CardListResult> {
  // Decode the opaque cursor into the bare `id` the RPC expects. The RPC
  // resolves the (created_at, id) tuple from the row internally; the API
  // only needs to round-trip the id portion today.
  const cursorId = cursor !== undefined ? decodeCursor(cursor, cardListCursorSchema).id : null

  const [listResult, totalCount] = await Promise.all([
    supabaseAdmin.rpc(
      'list_cards_paginated',
      asPayload({
        p_user_id:       userId,
        p_deck_id:       deckId,
        p_limit:         limit + 1,
        p_cursor:        cursorId,
        p_status_filter: status ?? null,
      }),
    ),
    countCardsForDeck(userId, deckId, status),
  ])

  const { data, error } = listResult

  if (error !== null) {
    if (error.code === '02000' && error.message.includes('deck_not_found')) {
      throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
    }
    throw dbError('list cards', error)
  }

  const rows    = z.array(CardListRpcRowSchema).parse(data ?? [])
  const hasMore = rows.length > limit
  const items   = rows.slice(0, limit).map(toApiCardListItem)
  const lastId  = items[items.length - 1]?.id

  return {
    items,
    nextCursor: hasMore && lastId !== undefined ? encodeCursor({ id: lastId }) : null,
    hasMore,
    totalCount,
  }
}

/**
 * Counts cards in a deck for the current user, applying the same status
 * filter as listCards. Mirrors the RPC's internal filter logic
 * (supabase/migrations/20260516000000_pagination_and_session_summary_rpcs.sql:80-85)
 * at the service layer; cheap because (user_id, deck_id) is indexed.
 */
async function countCardsForDeck(
  userId:  string,
  deckId:  string,
  status?: CardStatusFilter,
): Promise<number> {
  let query = supabaseAdmin
    .from('cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('deck_id', deckId)

  if (status !== undefined && status !== 'all') {
    switch (status) {
      case 'new':
        query = query.eq('state', State.New).eq('is_suspended', false)
        break
      case 'learning':
        query = query.in('state', [State.Learning, State.Relearning]).eq('is_suspended', false)
        break
      case 'review':
        query = query.eq('state', State.Review).eq('is_suspended', false)
        break
      case 'suspended':
        query = query.eq('is_suspended', true)
        break
      default:
        assertNever(status)
    }
  }

  const { count, error } = await query
  if (error !== null) throw dbError('count cards', error)
  return count ?? 0
}

/**
 * Returns a single card by ID.
 * Throws 404 if the card does not exist or belongs to a different user, or
 * (when `expectedDeckId` is provided) does not belong to that deck. The
 * deck-scoping is what makes the dual-mount card router safe — see app.ts:48.
 */
export async function getCard(
  cardId:          string,
  userId:          string,
  expectedDeckId?: string,
): Promise<ApiCard> {
  let query = supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)

  if (expectedDeckId !== undefined) query = query.eq('deck_id', expectedDeckId)

  const { data, error } = await query.single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Card not found', { code: 'CARD_NOT_FOUND' })
  }

  return toCardRow(CardDbRowSchema.parse(data))
}

/**
 * Creates a new card in the given deck, initializing FSRS state to New.
 *
 * The caller is responsible for resolving fields_data (either from AI generation
 * or from the manual request body) before calling this function.
 * Throws 404 if the deck does not exist or belongs to a different user.
 */
export async function createCard(
  deckId:     string,
  userId:     string,
  // Accepts one of three shapes:
  //   - validated wire-format FieldsData (manual creation path)
  //   - GeneratedCardData from the vocabulary / grammar AI generator
  //   - GeneratedSentenceCard from the sentence AI generator (Stage 13)
  // All are JSONB-compatible; the DB-side `cards_fields_data_shape` CHECK
  // constraint enforces the minimum keys required per `layout_type` (Stage 12
  // tightened the sentence-layout arm). The asPayload() call below bridges
  // to Supabase's Json type.
  fieldsData: FieldsData | GeneratedCardData | GeneratedSentenceCard,
  meta:       CreateCardMeta,
): Promise<ApiCard> {
  await assertDeckOwnership(deckId, userId)

  // Reject parent_card_id pointing to a card the caller doesn't own. Without
  // this, an attacker who learned a victim's card UUID could create a child
  // card whose parent_card_id points into the victim's row (security audit
  // FIND-A-01). Sibling-sync is already user-scoped, so the practical impact
  // is small, but the integrity gap is worth closing.
  if (meta.parentCardId !== undefined) {
    const { data: parent, error: parentError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('id', meta.parentCardId)
      .eq('user_id', userId)
      .maybeSingle()
    if (parentError !== null || parent === null) {
      throw new AppError(404, 'Parent card not found', { code: 'CARD_NOT_FOUND' })
    }
  }

  const fsrs = getInitialFsrsState()

  const { data, error } = await supabaseAdmin
    .from('cards')
    .insert({
      user_id:        userId,
      deck_id:        deckId,
      // fieldsData is Record<string, unknown> from the controller; the
      // generated Insert type expects Json. JSON-serialisable at runtime.
      fields_data:    asPayload(fieldsData),
      layout_type:    meta.layoutType,
      jlpt_level:     meta.jlptLevel    ?? null,
      parent_card_id: meta.parentCardId ?? null,
      // FSRS initial state. is_suspended uses the column default (FALSE).
      state:          fsrs.state,
      due:            fsrs.due,
      stability:      fsrs.stability,
      difficulty:     fsrs.difficulty,
      elapsed_days:   fsrs.elapsed_days,
      scheduled_days: fsrs.scheduled_days,
      reps:           fsrs.reps,
      lapses:         fsrs.lapses,
      last_review:    fsrs.last_review,
    })
    .select(CARD_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw dbError('create card', error)
  }

  const created = toCardRow(CardDbRowSchema.parse(data))

  // Async embedding backfill. Fire-and-forget — failures (no OpenAI key,
  // network error, malformed fields) must not block card creation. The card
  // remains usable for FSRS; only similarity search is delayed.
  //
  // backfillEmbedding wraps its OpenAI call in `withBreaker`, so an open
  // breaker surfaces as a `ServiceUnavailableError` here. We branch on it in
  // the catch so expected outage-time skips log at warn (no Sentry alert)
  // while genuine failures stay at error.
  void backfillEmbedding(created.id, userId, fieldsData).catch((err: unknown) => {
    if (err instanceof ServiceUnavailableError) {
      log.warn({ cardId: created.id }, 'embedding backfill skipped: breaker open or call failed')
      return
    }
    log.error({ cardId: created.id, err }, 'embedding backfill failed')
  })

  // A new card enters the New pool, so the cached due set is now stale.
  // Fire-and-forget, mirroring the FSRS write paths in fsrs.service.ts —
  // without this, a freshly added card doesn't surface as a review until the
  // 60s due-cache TTL lapses.
  void invalidateDueCache(userId)

  return created
}

/**
 * Applies a partial update to a card's content fields and atomically
 * propagates the shared sub-fields (word, reading, meaning) to sibling
 * cards via the update_card_with_sibling_sync RPC.
 *
 * Siblings are cards sharing parent_card_id with the target, plus the root
 * card itself. Each sibling maintains its own embedding (different cognitive
 * modalities); embeddings are intentionally NOT synced and become stale on
 * content change — regenerate via POST /api/v1/cards/:id/regenerate-embedding.
 *
 * FSRS state fields must only be modified via fsrs.service.ts.
 * Throws 404 if the card does not exist or belongs to a different user.
 */
export async function updateCard(
  cardId:          string,
  userId:          string,
  input:           UpdateCardInput,
  expectedVersion: number,
  expectedDeckId?: string,
): Promise<ApiCard> {
  // When the caller routed through /decks/:deckId/cards/:id, verify the card
  // actually belongs to that deck before mutating. The RPC itself doesn't
  // take a deck filter; one extra SELECT is the cost of the safety check.
  if (expectedDeckId !== undefined) {
    await getCard(cardId, userId, expectedDeckId)
  }

  const { data, error } = await supabaseAdmin.rpc('update_card_with_sibling_sync', asPayload({
    p_card_id:          cardId,
    p_user_id:          userId,
    p_expected_version: expectedVersion,
    p_fields_data:      input.fieldsData ?? null,
    p_layout_type:      input.layoutType ?? null,
    p_jlpt_level:       input.jlptLevel  ?? null,
  }))

  if (error !== null) {
    // RPC raises 'card_not_found' with SQLSTATE 02000 (no_data_found) when
    // the row is missing or owned by another user.
    if (error.code === '02000' && error.message.includes('card_not_found')) {
      throw new AppError(404, 'Card not found', { code: 'CARD_NOT_FOUND' })
    }
    // RPC raises 'card_version_mismatch' with SQLSTATE 22000 when the
    // optimistic-concurrency check fails — the caller's snapshot is stale.
    if (error.code === '22000' && error.message.includes('card_version_mismatch')) {
      throw new AppError(412, 'Card has been modified since you loaded it; refresh and retry', { code: 'VERSION_CONFLICT' })
    }
    throw dbError('update card', error)
  }

  // RPC returns the freshly-updated target row (migration 20260528000000),
  // so we skip the previous follow-up getCard() round-trip.
  const rows = z.array(CardDbRowSchema).parse(data ?? [])
  const updated = rows[0]
  if (updated === undefined) {
    // RPC succeeded but returned no row — only reachable if the row was
    // concurrently deleted between UPDATE and RETURN QUERY. Map to 404.
    throw new AppError(404, 'Card not found', { code: 'CARD_NOT_FOUND' })
  }
  return toCardRow(updated)
}

/**
 * Deletes a card. Confirms ownership via a SELECT before deleting so we can
 * distinguish "not found / wrong owner" from a delete failure.
 * The DB trigger decrements decks.card_count automatically.
 * Throws 404 if the card does not exist or belongs to a different user.
 */
export async function deleteCard(
  cardId:          string,
  userId:          string,
  expectedDeckId?: string,
): Promise<void> {
  let fetch = supabaseAdmin
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', userId)
  if (expectedDeckId !== undefined) fetch = fetch.eq('deck_id', expectedDeckId)

  const { data, error: fetchError } = await fetch.single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, 'Card not found', { code: 'CARD_NOT_FOUND' })
  }

  const { error: deleteError } = await supabaseAdmin
    .from('cards')
    .delete()
    .eq('id', cardId)
    .eq('user_id', userId)

  if (deleteError !== null) {
    throw dbError('delete card', deleteError)
  }
}

/**
 * Returns up to 10 cards semantically similar to the given card via pgvector.
 * Returns an empty array if the card has no embedding yet.
 *
 * The find_similar_cards RPC returns a slim projection (id, deck_id,
 * layout_type, fields_data, jlpt_level, similarity), not the full 21
 * fields of ApiCard. The return type mirrors the actual RPC shape.
 */
export async function getSimilarCards(
  cardId:          string,
  userId:          string,
  expectedDeckId?: string,
): Promise<ApiList<ApiSimilarCard>> {
  // Verify the source card belongs to the caller before computing similarity.
  // The find_similar_cards RPC scopes its *results* to p_user_id but joins the
  // source vector by id alone (src.id = p_card_id, no owner check), so a
  // non-owned p_card_id is usable as a similarity oracle against the caller's
  // own cards. Pre-checking here makes the flat /cards/:id/similar mount 404 on
  // a foreign id, matching every other :id route. (deckId still scopes when set.)
  await getCard(cardId, userId, expectedDeckId)

  const { data, error } = await supabaseAdmin.rpc('find_similar_cards', {
    p_card_id: cardId,
    p_user_id: userId,
  })

  if (error !== null) {
    throw dbError('find similar cards', error)
  }

  const rows  = z.array(SimilarCardRpcRowSchema).parse(data ?? [])
  const items: ApiSimilarCard[] = rows.map((row) => ({
    id:         row.id,
    deckId:     row.deck_id,
    layoutType: row.layout_type,
    fieldsData: row.fields_data as FieldsData,
    jlptLevel:  row.jlpt_level,
    similarity: row.similarity,
  }))
  // Bounded by find_similar_cards (top-K); no cursor pagination.
  return { items, nextCursor: null, hasMore: false }
}

// ─── Embeddings ───────────────────────────────────────────────────────────────
// regenerateEmbedding, backfillPremadeEmbeddings, generateEmbedding are
// re-exported from ./card.embeddings.ts at the top of this file. The internal
// `backfillEmbedding` is imported (not re-exported) for use by createCard().


// ─── Cross-deck list ─────────────────────────────────────────────────────────
//
// Powers GET /api/v1/cards/cross-deck (the /cards browser). Two RPCs are
// fired in parallel: `list_cards_cross_deck` for the page slice and
// `count_cards_cross_deck` for the total-count footer.

/** Row shape returned by `list_cards_cross_deck`. */
const CrossDeckCardRpcRowSchema = CardDbRowSchema.pick({
  id:           true,
  fields_data:  true,
  layout_type:  true,
  jlpt_level:   true,
  state:        true,
  is_suspended: true,
  due:          true,
  lapses:       true,
  created_at:   true,
}).extend({
  deck_id:   z.string(),
  deck_name: z.string(),
})

type CrossDeckCardRpcRow = z.infer<typeof CrossDeckCardRpcRowSchema>

function toApiCrossDeckCardListItem(raw: CrossDeckCardRpcRow): ApiCrossDeckCardListItem {
  return {
    id:          raw.id,
    deckId:      raw.deck_id,
    deckName:    raw.deck_name,
    fieldsData:  raw.fields_data as FieldsData,
    layoutType:  raw.layout_type,
    jlptLevel:   raw.jlpt_level,
    state:       raw.state,
    isSuspended: raw.is_suspended,
    due:         raw.due,
    lapses:      raw.lapses,
  }
}

export interface CrossDeckCardListResult {
  items:      ApiCrossDeckCardListItem[]
  hasMore:    boolean
  totalCount: number
}

export interface CrossDeckListParams {
  limit:        number
  offset?:      number
  search?:      string
  deckId?:      string
  jlptLevel?:   CrossDeckJlptFilter
  status?:      CardStatusFilter
  missingField?: CardMissingField
  presentField?: CardPresentField
  pitchPattern?: PitchPattern
  sort?:        CardSortField
  sortDir?:     CardSortDir
}

export async function listCardsCrossDeck(
  userId: string,
  params: CrossDeckListParams,
): Promise<CrossDeckCardListResult> {
  const sort   = params.sort ?? 'recent'
  const offset = params.offset ?? 0

  const [listResult, countResult] = await Promise.all([
    supabaseAdmin.rpc('list_cards_cross_deck', asPayload({
      p_user_id:       userId,
      p_limit:         params.limit,
      p_offset:        offset,
      p_deck_id:       params.deckId       ?? null,
      p_status:        params.status       ?? null,
      p_jlpt_level:    params.jlptLevel    ?? null,
      p_search:        params.search       ?? null,
      p_missing_field: params.missingField ?? null,
      p_sort:          sort,
      p_present_field: params.presentField ?? null,
      p_pitch_pattern: params.pitchPattern ?? null,
      // null means "use the RPC's per-axis natural default" — see
      // migration 20260630000001 for the resolution logic.
      p_sort_dir:      params.sortDir ?? null,
    })),
    supabaseAdmin.rpc('count_cards_cross_deck', asPayload({
      p_user_id:       userId,
      p_deck_id:       params.deckId       ?? null,
      p_status:        params.status       ?? null,
      p_jlpt_level:    params.jlptLevel    ?? null,
      p_search:        params.search       ?? null,
      p_missing_field: params.missingField ?? null,
      p_present_field: params.presentField ?? null,
      p_pitch_pattern: params.pitchPattern ?? null,
    })),
  ])

  if (listResult.error !== null) {
    throw dbError('list cards cross-deck', listResult.error)
  }
  if (countResult.error !== null) {
    throw dbError('count cards cross-deck', countResult.error)
  }

  const rows       = z.array(CrossDeckCardRpcRowSchema).parse(listResult.data ?? [])
  const items      = rows.map(toApiCrossDeckCardListItem)
  const totalCount = z.number().int().nonnegative().parse(countResult.data ?? 0)
  // With offset pagination, hasMore is derived from totalCount rather
  // than from a +1 limit-bump probe. Cheaper at the RPC and removes the
  // tail-row slicing the cursor version needed.
  const hasMore    = offset + items.length < totalCount

  return {
    items,
    hasMore,
    totalCount,
  }
}

// ─── Move / copy / suspend / unsuspend ───────────────────────────────────────

/** Maps the RPC's SQLSTATE-tagged exception to a 404 AppError. */
function rpcCardNotFoundError(message?: string): never {
  throw new AppError(404, message ?? 'Card not found', { code: 'CARD_NOT_FOUND' })
}

/** Maps the RPC's `deck_not_found` exception to a 404 AppError. */
function rpcDeckNotFoundError(): never {
  throw new AppError(404, 'Deck not found', { code: 'DECK_NOT_FOUND' })
}

/** Reusable adapter: NO_DATA_FOUND (02000) → 404 with a stable code. */
function mapNotFoundError(err: { code?: string; message?: string } | null): void {
  if (err === null) return
  if (err.code === '02000' && (err.message ?? '').includes('card_not_found')) {
    rpcCardNotFoundError()
  }
  if (err.code === '02000' && (err.message ?? '').includes('deck_not_found')) {
    rpcDeckNotFoundError()
  }
}

export async function moveCard(
  cardId:       string,
  userId:       string,
  targetDeckId: string,
): Promise<ApiCard> {
  const { error } = await supabaseAdmin.rpc('move_card', asPayload({
    p_card_id:        cardId,
    p_user_id:        userId,
    p_target_deck_id: targetDeckId,
  }))

  if (error !== null) {
    mapNotFoundError(error)
    throw dbError('move card', error)
  }

  return getCard(cardId, userId)
}

export async function copyCard(
  cardId:       string,
  userId:       string,
  targetDeckId: string,
): Promise<ApiCard> {
  const { data, error } = await supabaseAdmin.rpc('copy_card', asPayload({
    p_card_id:        cardId,
    p_user_id:        userId,
    p_target_deck_id: targetDeckId,
  }))

  if (error !== null) {
    mapNotFoundError(error)
    throw dbError('copy card', error)
  }

  const newId = z.string().uuid().parse(data)
  // The clone resets to New FSRS state, so the cached due set is now stale.
  void invalidateDueCache(userId)
  return getCard(newId, userId)
}

export async function suspendCard(
  cardId: string,
  userId: string,
): Promise<ApiCard> {
  const { error } = await supabaseAdmin.rpc('suspend_card', asPayload({
    p_card_id: cardId,
    p_user_id: userId,
  }))

  if (error !== null) {
    mapNotFoundError(error)
    throw dbError('suspend card', error)
  }

  return getCard(cardId, userId)
}

export async function unsuspendCard(
  cardId: string,
  userId: string,
): Promise<ApiCard> {
  const { error } = await supabaseAdmin.rpc('unsuspend_card', asPayload({
    p_card_id: cardId,
    p_user_id: userId,
  }))

  if (error !== null) {
    mapNotFoundError(error)
    throw dbError('unsuspend card', error)
  }

  return getCard(cardId, userId)
}

// ─── Bulk operations ─────────────────────────────────────────────────────────

const BulkResultRpcSchema = z.object({
  succeeded: z.array(z.string()),
  failed:    z.array(z.object({
    id:    z.string(),
    error: z.string(),
    code:  z.string().optional(),
  })),
})

function parseBulkResult(data: unknown): ApiBulkCardMutationResult {
  return BulkResultRpcSchema.parse(data ?? { succeeded: [], failed: [] })
}

export async function bulkMoveCards(
  cardIds:      string[],
  userId:       string,
  targetDeckId: string,
): Promise<ApiBulkCardMutationResult> {
  const { data, error } = await supabaseAdmin.rpc('bulk_move_cards', asPayload({
    p_card_ids:       cardIds,
    p_user_id:        userId,
    p_target_deck_id: targetDeckId,
  }))

  if (error !== null) {
    mapNotFoundError(error)
    throw dbError('bulk move cards', error)
  }
  return parseBulkResult(data)
}

export async function bulkSuspendCards(
  cardIds: string[],
  userId:  string,
): Promise<ApiBulkCardMutationResult> {
  const { data, error } = await supabaseAdmin.rpc('bulk_suspend_cards', asPayload({
    p_card_ids: cardIds,
    p_user_id:  userId,
  }))
  if (error !== null) throw dbError('bulk suspend cards', error)
  return parseBulkResult(data)
}

export async function bulkUnsuspendCards(
  cardIds: string[],
  userId:  string,
): Promise<ApiBulkCardMutationResult> {
  const { data, error } = await supabaseAdmin.rpc('bulk_unsuspend_cards', asPayload({
    p_card_ids: cardIds,
    p_user_id:  userId,
  }))
  if (error !== null) throw dbError('bulk unsuspend cards', error)
  return parseBulkResult(data)
}

export async function bulkDeleteCards(
  cardIds: string[],
  userId:  string,
): Promise<ApiBulkCardMutationResult> {
  const { data, error } = await supabaseAdmin.rpc('bulk_delete_cards', asPayload({
    p_card_ids: cardIds,
    p_user_id:  userId,
  }))
  if (error !== null) throw dbError('bulk delete cards', error)
  return parseBulkResult(data)
}

