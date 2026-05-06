import OpenAI from 'openai';

import { supabaseAdmin } from '../db/supabase.ts';
import { env }           from '../lib/env.ts';
import { asPayload, narrowRow } from '../lib/db.ts';
import { AppError, dbError } from '../middleware/errorHandler.ts';
import { getInitialFsrsState } from './fsrs.service.ts';
import type { CardStatusFilter, UpdateCardInput } from '@fsrs-japanese/shared-types'
import {
    type ApiCard,
    type ApiCardListItem,
    type ApiDueCard,
    type ApiSimilarCard,
    type CardType,
    type FieldsData,
    type JLPTLevel,
    type LayoutType,
    State
} from '@fsrs-japanese/shared-types';

// ─── OpenAI embeddings client ─────────────────────────────────────────────────
// Module-level singleton matching ai.service.ts:23 pattern. We don't throw at
// load time because some test runs / non-embedding paths don't need OpenAI;
// the generateEmbedding() callsite throws if the key is missing.
//
// EMBEDDING_MODEL must produce 1536-dim vectors to match the
// `cards.embedding vector(1536)` column type. Switching to a model with a
// different dimension requires a schema migration.
const EMBEDDING_MODEL = env.OPENAI_EMBEDDING_MODEL
const openai = env.OPENAI_API_KEY !== undefined
  ? new OpenAI({ apiKey: env.OPENAI_API_KEY })
  : null

// ─── Column projection ────────────────────────────────────────────────────────
// Excludes tokens, parsed_at, embedding — internal/heavy fields not needed by clients.

export const CARD_COLUMNS = [
  'id',
  'user_id',
  'deck_id',
  'premade_deck_id',
  'layout_type',
  'fields_data',
  'card_type',
  'parent_card_id',
  'tags',
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
  'created_at',
  'updated_at',
].join(', ')

// Slim projection for the review session — only the fields the UI renders.
// Mirrors ApiDueCard in shared-types. Keeps FSRS internals (stability,
// difficulty, reps, lapses, …) off the wire during reviews.
export const DUE_CARD_COLUMNS = [
  'id',
  'deck_id',
  'card_type',
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
  'card_type',
  'jlpt_level',
  'state',
  'is_suspended',
  'due',
  'tags',
].join(', ')

// ─── Return shapes ────────────────────────────────────────────────────────────

export interface CardListResult {
  items:      ApiCardListItem[]
  nextCursor: string | null
  hasMore:    boolean
}

export interface CreateCardMeta {
  card_type:      CardType
  layout_type:    LayoutType
  tags:           string[] | undefined
  jlpt_level:     JLPTLevel | undefined
  parent_card_id: string | undefined
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Raw snake_case row shape returned by SELECT CARD_COLUMNS. Single cast site for DB → domain. */
export interface CardDbRow {
  id:              string
  user_id:         string | null
  deck_id:         string | null
  premade_deck_id: string | null
  layout_type:     LayoutType
  fields_data:     Record<string, unknown>
  card_type:       CardType
  parent_card_id:  string | null
  tags:            string[]
  jlpt_level:      JLPTLevel | null
  state:           State
  is_suspended:    boolean
  due:             string
  stability:       number
  difficulty:      number
  elapsed_days:    number
  scheduled_days:  number
  learning_steps:  number
  reps:            number
  lapses:          number
  last_review:     string | null
  created_at:      string
  updated_at:      string
}

export function toCardRow(raw: CardDbRow): ApiCard {
  return {
    id:            raw.id,
    userId:        raw.user_id,
    deckId:        raw.deck_id,
    premadeDeckId: raw.premade_deck_id,
    layoutType:    raw.layout_type,
    // The DB enforces fields_data shape via cards_fields_data_shape CHECK
    // (migration 20260504000007 M3): vocabulary/grammar layouts have
    // {word, reading, meaning}; sentence is unconstrained. The cast moves the
    // discriminated-union narrowing to the consumer.
    fieldsData:    raw.fields_data as FieldsData,
    cardType:      raw.card_type,
    parentCardId:  raw.parent_card_id,
    tags:          raw.tags,
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
    createdAt:     raw.created_at,
    updatedAt:     raw.updated_at,
  }
}

/** Raw snake_case row shape returned by SELECT DUE_CARD_COLUMNS. */
export type DueCardDbRow = Pick<
  CardDbRow,
  'id' | 'deck_id' | 'card_type' | 'jlpt_level' | 'state' | 'due' | 'fields_data' | 'layout_type'
>

/** Maps a DUE_CARD_COLUMNS row to the wire-format ApiDueCard. */
export function toApiDueCard(raw: DueCardDbRow): ApiDueCard {
  return {
    id:         raw.id,
    deckId:     raw.deck_id,
    cardType:   raw.card_type,
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
  'id' | 'fields_data' | 'layout_type' | 'card_type' | 'jlpt_level' | 'state' | 'is_suspended' | 'due' | 'tags'
>

/** Maps a CARD_LIST_COLUMNS row to the wire-format ApiCardListItem. */
export function toApiCardListItem(raw: CardListDbRow): ApiCardListItem {
  return {
    id:          raw.id,
    fieldsData:  raw.fields_data as FieldsData,
    layoutType:  raw.layout_type,
    cardType:    raw.card_type,
    jlptLevel:   raw.jlpt_level,
    state:       raw.state,
    isSuspended: raw.is_suspended,
    due:         raw.due,
    tags:        raw.tags,
  }
}

/** Verifies a deck exists and belongs to the given user. Throws 404 otherwise. */
async function assertDeckOwnership(deckId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('decks')
    .select('id')
    .eq('id', deckId)
    .eq('user_id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Deck not found')
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of cards in a deck owned by the user.
 * Optional `status` filter: 'new', 'learning' (includes relearning), 'review', 'suspended'.
 * Throws 404 if the deck does not exist or belongs to a different user.
 */
export async function listCards(
  deckId:  string,
  userId:  string,
  limit:   number,
  cursor?: string,
  status?: CardStatusFilter,
): Promise<CardListResult> {
  await assertDeckOwnership(deckId, userId)

  let query = supabaseAdmin
    .from('cards')
    .select(CARD_LIST_COLUMNS)
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  // Translate the status-shaped filter param (URL-stable) into state + is_suspended.
  // 'suspended' is orthogonal to FSRS state, so it gets its own branch.
  // 'all' and undefined intentionally apply no filter; the explicit branch +
  // exhaustive default makes a future enum addition fail compilation here.
  if (status === undefined || status === 'all') {
    // no-op
  } else if (status === 'new') {
    query = query.eq('state', State.New).eq('is_suspended', false)
  } else if (status === 'learning') {
    query = query.in('state', [State.Learning, State.Relearning]).eq('is_suspended', false)
  } else if (status === 'review') {
    query = query.eq('state', State.Review).eq('is_suspended', false)
  } else if (status === 'suspended') {
    query = query.eq('is_suspended', true)
  } else {
      throw new Error(`Unhandled card status filter: ${String(status)}`)
  }

  if (cursor !== undefined) {
    // Scope the cursor lookup to the authenticated user so an attacker cannot
    // probe whether a card UUID belongs to another user via response timing /
    // result-shape differences.
    const { data: cursorCard } = await supabaseAdmin
      .from('cards')
      .select('created_at')
      .eq('id', cursor)
      .eq('user_id', userId)
      .single()

    if (cursorCard !== null) {
      query = query.lt('created_at', (cursorCard as { created_at: string }).created_at)
    }
  }

  const { data, error } = await query

  if (error !== null) {
    throw dbError('list cards', error)
  }

  const rows    = data ?? []
  const hasMore = rows.length > limit
  const items   = rows
    .slice(0, limit)
    .map((row) => toApiCardListItem(narrowRow<CardListDbRow>(row)))

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    hasMore,
  }
}

/**
 * Returns a single card by ID.
 * Throws 404 if the card does not exist or belongs to a different user.
 */
export async function getCard(cardId: string, userId: string): Promise<ApiCard> {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Card not found')
  }

  return toCardRow(narrowRow<CardDbRow>(data))
}

/**
 * Creates a new card in the given deck, initializing FSRS state to New.
 *
 * The caller is responsible for resolving fields_data (either from AI generation
 * or from the manual request body) before calling this function.
 * Throws 404 if the deck does not exist or belongs to a different user.
 */
export async function createCard(
  deckId: string,
  userId: string,
  fieldsData: Record<string, unknown>,
  meta: CreateCardMeta,
): Promise<ApiCard> {
  await assertDeckOwnership(deckId, userId)

  const fsrs = getInitialFsrsState()

  const { data, error } = await supabaseAdmin
    .from('cards')
    .insert({
      user_id:        userId,
      deck_id:        deckId,
      // fieldsData is Record<string, unknown> from the controller; the
      // generated Insert type expects Json. JSON-serialisable at runtime.
      fields_data:    asPayload(fieldsData),
      card_type:      meta.card_type,
      layout_type:    meta.layout_type,
      tags:           meta.tags           ?? [],
      jlpt_level:     meta.jlpt_level     ?? null,
      parent_card_id: meta.parent_card_id ?? null,
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

  const created = toCardRow(narrowRow<CardDbRow>(data))

  // Async embedding backfill. Fire-and-forget — failures (no OpenAI key,
  // network error, malformed fields) must not block card creation.
  // The card remains usable for FSRS; only similarity search is delayed.
  void backfillEmbedding(created.id, userId, fieldsData).catch((err: unknown) => {
    console.error('[card] embedding backfill failed', { cardId: created.id, err })
  })

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
  cardId: string,
  userId: string,
  input: UpdateCardInput,
): Promise<ApiCard> {
  // Function name cast: database.types.ts is auto-generated and won't include
  // update_card_with_sibling_sync until `supabase gen types` runs post-deploy.
  const { error } = await supabaseAdmin.rpc('update_card_with_sibling_sync' as never, asPayload({
    p_card_id:     cardId,
    p_user_id:     userId,
    p_fields_data: input.fields_data ?? null,
    p_layout_type: input.layout_type ?? null,
    p_card_type:   input.card_type   ?? null,
    p_tags:        input.tags        ?? null,
    p_jlpt_level:  input.jlpt_level  ?? null,
  }))

  if (error !== null) {
    // RPC raises 'card_not_found' with SQLSTATE 02000 (no_data_found) when
    // the row is missing or owned by another user.
    if (error.code === '02000' || error.message.includes('card_not_found')) {
      throw new AppError(404, 'Card not found')
    }
    throw dbError('update card', error)
  }

  return getCard(cardId, userId)
}

/**
 * Deletes a card. Confirms ownership via a SELECT before deleting so we can
 * distinguish "not found / wrong owner" from a delete failure.
 * The DB trigger decrements decks.card_count automatically.
 * Throws 404 if the card does not exist or belongs to a different user.
 */
export async function deleteCard(cardId: string, userId: string): Promise<void> {
  const { data, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select('id')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, 'Card not found')
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
 * The find_similar_cards RPC returns 8 columns (id, deck_id, layout_type,
 * card_type, fields_data, tags, jlpt_level, similarity) — not the full 21
 * fields of ApiCard. The return type mirrors the actual RPC shape.
 */
export async function getSimilarCards(cardId: string, userId: string): Promise<ApiSimilarCard[]> {
  const { data, error } = await supabaseAdmin.rpc('find_similar_cards', {
    p_card_id: cardId,
    p_user_id: userId,
  })

  if (error !== null) {
    throw dbError('find similar cards', error)
  }

  return (data ?? []).map((row) => ({
    id:         row.id,
    deckId:     row.deck_id,
    layoutType: row.layout_type,
    cardType:   row.card_type,
    fieldsData: row.fields_data as FieldsData,
    tags:       row.tags ?? [],
    jlptLevel:  row.jlpt_level,
    similarity: row.similarity,
  }))
}

/**
 * Returns all cards belonging to a user that have stale embeddings.
 *
 * A stale embedding has embedding_updated_at < updated_at (i.e. content was
 * modified after the embedding was last computed). Backed by the
 * get_stale_embedding_cards RPC because PostgREST .filter() does not support
 * column-vs-column comparison.
 */
export async function getStaleEmbeddingCards(userId: string): Promise<ApiCard[]> {
  const { data, error } = await supabaseAdmin.rpc('get_stale_embedding_cards', {
    p_user_id: userId,
  })

  if (error !== null) {
    throw dbError('fetch stale embedding cards', error)
  }

  return (data ?? []).map((row: unknown) => toCardRow(narrowRow<CardDbRow>(row)))
}

/**
 * Regenerates the embedding for a single card.
 *
 * Loads the card (with ownership check), then delegates to backfillEmbedding.
 * Throws 404 if card not found or not owned by user.
 */
export async function regenerateEmbedding(cardId: string, userId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('id, user_id, fields_data')
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Card not found')
  }

  interface CardFieldsRow { fields_data: Record<string, unknown> }
  const cardData = narrowRow<CardFieldsRow>(data)
  await backfillEmbedding(cardId, userId, cardData.fields_data)
}

/**
 * Builds embedding text from a card's fields_data, computes the embedding via
 * OpenAI, and writes it to the card row with a fresh embedding_updated_at.
 *
 * Used by createCard() (fire-and-forget) and regenerateEmbedding() (synchronous).
 * Throws if OpenAI is misconfigured, the API call fails, or the DB update fails;
 * callers decide whether to surface or swallow these errors.
 *
 * Returns silently (no-op) if the card has no embeddable content — a sentence-
 * layout card with only example sentences, for example, intentionally does not
 * have a word/reading/meaning to embed yet.
 */
async function backfillEmbedding(
  cardId: string,
  userId: string,
  fieldsData: Record<string, unknown>,
): Promise<void> {
  const text = buildEmbeddingText(fieldsData)
  if (text === null) return

  const embedding = await generateEmbedding(text)

  const { error } = await supabaseAdmin
    .from('cards')
    .update({
      // Cast: pgvector(1536) column is generated as `string` by supabase gen
      // types; the supabase-js client serialises a number[] correctly at runtime.
      embedding: embedding as unknown as string,
      embedding_updated_at: new Date().toISOString(),
    })
    .eq('id', cardId)
    .eq('user_id', userId)

  if (error !== null) {
    throw dbError('update card embedding', error)
  }
}

/**
 * Builds the embedding input string from a card's fields_data.
 *
 * Returns a labelled "word: ... | reading: ... | meaning: ..." form so the
 * embedding model can disambiguate fields rather than treating the
 * concatenation as a single bag of tokens. Returns null if no labelled fields
 * are present (e.g. sentence-layout cards before content is filled in).
 */
function buildEmbeddingText(fieldsData: Record<string, unknown>): string | null {
  const word    = typeof fieldsData['word']    === 'string' ? fieldsData['word']    : ''
  const reading = typeof fieldsData['reading'] === 'string' ? fieldsData['reading'] : ''
  const meaning = typeof fieldsData['meaning'] === 'string' ? fieldsData['meaning'] : ''

  const parts: string[] = []
  if (word)    parts.push(`word: ${word}`)
  if (reading) parts.push(`reading: ${reading}`)
  if (meaning) parts.push(`meaning: ${meaning}`)

  return parts.length > 0 ? parts.join(' | ') : null
}

/**
 * Backfills embeddings for premade source cards (user_id IS NULL,
 * premade_deck_id NOT NULL) that don't have one yet.
 *
 * Iterates serially to respect OpenAI rate limits and to make per-card
 * failures recoverable: a failed card is logged and skipped, and the
 * function continues with the next card. Returns counts so the caller
 * (admin endpoint) can report progress.
 *
 * Idempotent: re-running on already-embedded rows is a no-op since the
 * SELECT filters embedding IS NULL.
 */
export async function backfillPremadeEmbeddings(): Promise<{
  attempted: number
  succeeded: number
  failed:    number
}> {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select('id, fields_data')
    .is('user_id', null)
    .not('premade_deck_id', 'is', null)
    .is('embedding', null)

  if (error !== null) {
    throw dbError('list premade cards needing embeddings', error)
  }

  interface PremadeEmbedRow { id: string; fields_data: Record<string, unknown> }
  const rows = narrowRow<PremadeEmbedRow[]>(data ?? [])

  // OpenAI calls stay sequential to respect rate limits; the DB writes are
  // collected and flushed once via bulk_update_card_embeddings.
  const updates: Array<{ id: string; embedding: string }> = []
  let failed = 0

  for (const row of rows) {
    try {
      const text = buildEmbeddingText(row.fields_data)
      if (text === null) {
        failed++
        continue
      }
      const embedding = await generateEmbedding(text)
      // pgvector accepts the literal-array form as TEXT and casts at the SQL
      // boundary inside bulk_update_card_embeddings.
      updates.push({ id: row.id, embedding: `[${embedding.join(',')}]` })
    } catch (err) {
      console.error('[admin] failed to embed premade card', { cardId: row.id, err })
      failed++
    }
  }

  let succeeded = 0
  if (updates.length > 0) {
    // Function name cast: database.types.ts is auto-generated and won't include
    // bulk_update_card_embeddings until `supabase gen types` runs post-deploy.
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'bulk_update_card_embeddings' as never,
      asPayload({ p_updates: updates }),
    )
    if (rpcError !== null) {
      console.error('[admin] bulk embedding update failed', { err: rpcError })
      failed += updates.length
    } else {
      succeeded = (rpcData as unknown as number) ?? 0
      // Any update that didn't land (id mismatch, vector parse error, etc.)
      // counts as failed for the caller's diagnostic count.
      failed += updates.length - succeeded
    }
  }

  return { attempted: rows.length, succeeded, failed }
}

/**
 * Generates a 1536-dim embedding via OpenAI text-embedding-3-small.
 * Exported so the admin backfill endpoint can reuse it without round-tripping
 * through the per-card update logic.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (openai === null) {
    throw new AppError(500, 'OPENAI_API_KEY not configured')
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  })

  const first = response.data?.[0]
  if (first === undefined) {
    throw new AppError(500, 'OpenAI returned no embedding data')
  }

  return first.embedding
}
