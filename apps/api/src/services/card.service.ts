import OpenAI from 'openai'

import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { getInitialFsrsState } from './fsrs.service.ts'
import type { UpdateCardInput, CardType, LayoutType, JlptLevel } from '../schemas/card.schema.ts'
import { State, type ApiCard } from '@fsrs-japanese/shared-types'

// ─── OpenAI embeddings client ─────────────────────────────────────────────────
// Module-level singleton matching ai.service.ts:23 pattern. We don't throw at
// load time because some test runs / non-embedding paths don't need OpenAI;
// the generateEmbedding() callsite throws if the key is missing.
//
// EMBEDDING_MODEL must produce 1536-dim vectors to match the
// `cards.embedding vector(1536)` column type. Switching to a model with a
// different dimension requires a schema migration.
const EMBEDDING_MODEL = process.env['OPENAI_EMBEDDING_MODEL'] ?? 'text-embedding-3-small'
const openaiKey = process.env['OPENAI_API_KEY']
const openai = openaiKey !== undefined && openaiKey.length > 0
  ? new OpenAI({ apiKey: openaiKey })
  : null

// ─── Column projection ────────────────────────────────────────────────────────
// Excludes tokens, parsed_at, embedding — internal/heavy fields not needed by clients.

export const CARD_COLUMNS = [
  'id',
  'user_id',
  'deck_id',
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
  'reps',
  'lapses',
  'last_review',
  'created_at',
  'updated_at',
].join(', ')

// ─── Return shapes ────────────────────────────────────────────────────────────

/**
 * Wire-format card row returned by the service. Aliased to ApiCard from
 * shared-types so the frontend can import the same shape it receives over HTTP.
 *
 * `layoutType`, `cardType`, and `jlptLevel` are widened to `string` in ApiCard
 * since the wire format does not carry the API's narrower enum types.
 */
export type CardRow = ApiCard

export interface CardListResult {
  items:      CardRow[]
  nextCursor: string | null
  hasMore:    boolean
}

export interface CreateCardMeta {
  card_type:      CardType
  layout_type:    LayoutType
  tags:           string[] | undefined
  jlpt_level:     JlptLevel | undefined
  parent_card_id: string | undefined
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Raw snake_case row shape returned by SELECT CARD_COLUMNS. Single cast site for DB → domain. */
export interface CardDbRow {
  id:              string
  user_id:         string
  deck_id:         string
  layout_type:     LayoutType
  fields_data:     Record<string, unknown>
  card_type:       CardType
  parent_card_id:  string | null
  tags:            string[] | null
  jlpt_level:      JlptLevel | null
  state:           State
  is_suspended:    boolean
  due:             string
  stability:       number
  difficulty:      number
  elapsed_days:    number
  scheduled_days:  number
  reps:            number
  lapses:          number
  last_review:     string | null
  created_at:      string
  updated_at:      string
}

export function toCardRow(raw: CardDbRow): CardRow {
  return {
    id:            raw.id,
    userId:        raw.user_id,
    deckId:        raw.deck_id,
    layoutType:    raw.layout_type,
    fieldsData:    raw.fields_data,
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
    reps:          raw.reps,
    lapses:        raw.lapses,
    lastReview:    raw.last_review,
    createdAt:     raw.created_at,
    updatedAt:     raw.updated_at,
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
  status?: string,
): Promise<CardListResult> {
  await assertDeckOwnership(deckId, userId)

  let query = supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  // Translate the status-shaped filter param (URL-stable) into state + is_suspended.
  // 'suspended' is orthogonal to FSRS state, so it gets its own branch.
  if (status === 'new') {
    query = query.eq('state', State.New).eq('is_suspended', false)
  } else if (status === 'learning') {
    query = query.in('state', [State.Learning, State.Relearning]).eq('is_suspended', false)
  } else if (status === 'review') {
    query = query.eq('state', State.Review).eq('is_suspended', false)
  } else if (status === 'suspended') {
    query = query.eq('is_suspended', true)
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
    .map((row) => toCardRow(row as unknown as CardDbRow))

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
export async function getCard(cardId: string, userId: string): Promise<CardRow> {
  const { data, error } = await supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Card not found')
  }

  return toCardRow(data as unknown as CardDbRow)
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
): Promise<CardRow> {
  await assertDeckOwnership(deckId, userId)

  const fsrs = getInitialFsrsState()

  const { data, error } = await supabaseAdmin
    .from('cards')
    .insert({
      user_id:        userId,
      deck_id:        deckId,
      fields_data:    fieldsData,
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

  const created = toCardRow(data as unknown as CardDbRow)

  // Async embedding backfill. Fire-and-forget — failures (no OpenAI key,
  // network error, malformed fields) must not block card creation.
  // The card remains usable for FSRS; only similarity search is delayed.
  void backfillEmbedding(created.id, userId, fieldsData).catch((err: unknown) => {
    console.error('[card] embedding backfill failed', { cardId: created.id, err })
  })

  return created
}

const SHARED_CARD_FIELDS = ['word', 'reading', 'meaning'] as const
type SharedFieldKey = (typeof SHARED_CARD_FIELDS)[number]

/**
 * Propagates shared content fields (word, reading, meaning) from the just-
 * updated card to its siblings (cards sharing parent_card_id or rooted at
 * updatedCard.id).
 *
 * IMPORTANT: Embeddings are intentionally NOT synced. Each sibling card
 * maintains its own embedding because they represent different cognitive
 * modalities (recognition, production, listening). When content fields
 * change, embeddings become stale; regeneration is manual via the
 * admin endpoint POST /api/v1/cards/:id/regenerate-embedding.
 * Stale embeddings degrade gracefully (semantic search becomes less precise),
 * but do not break core FSRS functionality.
 *
 * NOTE: Concurrent edits to two sibling cards by the same user can race —
 * each call's sibling-fetch sees pre-update data, and the later UPDATE
 * overwrites the earlier one (last-write-wins). Affects only same-user
 * concurrent edits to siblings; not a privilege boundary. Optimistic
 * concurrency on `fields_data` would close the gap; deferred for now.
 */
async function syncSharedFields(updatedCard: CardRow, userId: string): Promise<void> {
  const sharedValues: Partial<Record<SharedFieldKey, unknown>> = {}
  for (const key of SHARED_CARD_FIELDS) {
    if (key in updatedCard.fieldsData) {
      sharedValues[key] = updatedCard.fieldsData[key]
    }
  }
  if (Object.keys(sharedValues).length === 0) return

  const rootId = updatedCard.parentCardId ?? updatedCard.id

  // Two parameterised queries — sibling = same parent OR same root id — and
  // merge in JS. Avoids building a PostgREST `.or()` DSL string from a UUID,
  // which would be injectable if the column type ever changed.
  const [byParent, byId] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select('id, fields_data')
      .eq('user_id', userId)
      .eq('parent_card_id', rootId)
      .neq('id', updatedCard.id),
    supabaseAdmin
      .from('cards')
      .select('id, fields_data')
      .eq('user_id', userId)
      .eq('id', rootId)
      .neq('id', updatedCard.id),
  ])

  if (byParent.error !== null || byId.error !== null) return

  const seen = new Set<string>()
  const siblings = [...(byParent.data ?? []), ...(byId.data ?? [])].filter((row) => {
    const id = row.id as string
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })
  if (siblings.length === 0) return

  const now = new Date().toISOString()
  await Promise.all(siblings.map((sibling) => {
    const merged = {
      ...(sibling.fields_data as Record<string, unknown>),
      ...sharedValues,
    }
    return supabaseAdmin
      .from('cards')
      .update({ fields_data: merged, updated_at: now })
      .eq('id', sibling.id as string)
      .eq('user_id', userId)
  }))
}

/**
 * Applies a partial update to a card's content fields.
 * FSRS state fields must only be modified via fsrs.service.ts.
 * Throws 404 if the card does not exist or belongs to a different user.
 */
export async function updateCard(
  cardId: string,
  userId: string,
  input: UpdateCardInput,
): Promise<CardRow> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.fields_data !== undefined) patch['fields_data'] = input.fields_data
  if (input.layout_type !== undefined) patch['layout_type'] = input.layout_type
  if (input.card_type   !== undefined) patch['card_type']   = input.card_type
  if (input.tags        !== undefined) patch['tags']        = input.tags
  if (input.jlpt_level  !== undefined) patch['jlpt_level']  = input.jlpt_level

  const { data, error } = await supabaseAdmin
    .from('cards')
    .update(patch)
    .eq('id', cardId)
    .eq('user_id', userId)
    .select(CARD_COLUMNS)
    .single()

  if (error !== null) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Card not found')
    throw dbError('update card', error)
  }

  if (data === null) {
    throw new AppError(404, 'Card not found')
  }

  const updated = toCardRow(data as unknown as CardDbRow)

  if (input.fields_data !== undefined) {
    await syncSharedFields(updated, userId)
  }

  return updated
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

  if (deleteError !== null) {
    throw dbError('delete card', deleteError)
  }
}

/**
 * Returns up to 10 cards semantically similar to the given card via pgvector.
 * Returns an empty array if the card has no embedding yet.
 */
export async function getSimilarCards(cardId: string, userId: string): Promise<CardRow[]> {
  const { data, error } = await supabaseAdmin.rpc('find_similar_cards', {
    p_card_id: cardId,
    p_user_id: userId,
  })

  if (error !== null) {
    throw dbError('find similar cards', error)
  }

  return (data ?? []).map((row: unknown) => toCardRow(row as CardDbRow))
}

/**
 * Returns all cards belonging to a user that have stale embeddings.
 *
 * A stale embedding has embedding_updated_at < updated_at (i.e. content was
 * modified after the embedding was last computed). Backed by the
 * get_stale_embedding_cards RPC because PostgREST .filter() does not support
 * column-vs-column comparison.
 */
export async function getStaleEmbeddingCards(userId: string): Promise<CardRow[]> {
  const { data, error } = await supabaseAdmin.rpc('get_stale_embedding_cards', {
    p_user_id: userId,
  })

  if (error !== null) {
    throw dbError('fetch stale embedding cards', error)
  }

  return (data ?? []).map((row: unknown) => toCardRow(row as CardDbRow))
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

  const cardData = data as unknown as { fields_data: Record<string, unknown> }
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
      embedding,
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

  const rows = (data ?? []) as Array<{ id: string; fields_data: Record<string, unknown> }>
  let succeeded = 0
  let failed    = 0

  for (const row of rows) {
    try {
      const text = buildEmbeddingText(row.fields_data)
      if (text === null) {
        failed++
        continue
      }
      const embedding = await generateEmbedding(text)
      const { error: updateError } = await supabaseAdmin
        .from('cards')
        .update({ embedding, embedding_updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (updateError !== null) {
        console.error('[admin] failed to update premade embedding', { cardId: row.id, err: updateError })
        failed++
        continue
      }
      succeeded++
    } catch (err) {
      console.error('[admin] failed to embed premade card', { cardId: row.id, err })
      failed++
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
