import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import { getInitialFsrsState } from './fsrs.service.ts'
import type { UpdateCardInput, CardType, LayoutType, JlptLevel } from '../schemas/card.schema.ts'
import type { ApiCard } from '@fsrs-japanese/shared-types'

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
  'status',
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'reps',
  'lapses',
  'last_review',
  'state',
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
  status:          string
  due:             string
  stability:       number
  difficulty:      number
  elapsed_days:    number
  scheduled_days:  number
  reps:            number
  lapses:          number
  last_review:     string | null
  state:           number
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
    status:        raw.status,
    due:           raw.due,
    stability:     raw.stability,
    difficulty:    raw.difficulty,
    elapsedDays:   raw.elapsed_days,
    scheduledDays: raw.scheduled_days,
    reps:          raw.reps,
    lapses:        raw.lapses,
    lastReview:    raw.last_review,
    state:         raw.state,
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

  if (status === 'learning') {
    query = query.or('status.eq.learning,status.eq.relearning')
  } else if (status !== undefined && status !== 'all') {
    query = query.eq('status', status)
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
    throw new AppError(500, `Failed to list cards: ${error.message}`)
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
      // FSRS initial state
      status:         fsrs.status,
      due:            fsrs.due,
      stability:      fsrs.stability,
      difficulty:     fsrs.difficulty,
      elapsed_days:   fsrs.elapsed_days,
      scheduled_days: fsrs.scheduled_days,
      reps:           fsrs.reps,
      lapses:         fsrs.lapses,
      state:          fsrs.state,
      last_review:    fsrs.last_review,
    })
    .select(CARD_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, `Failed to create card: ${error?.message ?? 'unknown error'}`)
  }

  return toCardRow(data as unknown as CardDbRow)
}

const SHARED_CARD_FIELDS = ['word', 'reading', 'meaning'] as const
type SharedFieldKey = (typeof SHARED_CARD_FIELDS)[number]

async function syncSharedFields(updatedCard: CardRow, userId: string): Promise<void> {
  const sharedValues: Partial<Record<SharedFieldKey, unknown>> = {}
  for (const key of SHARED_CARD_FIELDS) {
    if (key in updatedCard.fieldsData) {
      sharedValues[key] = updatedCard.fieldsData[key]
    }
  }
  if (Object.keys(sharedValues).length === 0) return

  const rootId = updatedCard.parentCardId ?? updatedCard.id

  const { data: siblings, error } = await supabaseAdmin
    .from('cards')
    .select('id, fields_data')
    .eq('user_id', userId)
    .or(`parent_card_id.eq.${rootId},id.eq.${rootId}`)
    .neq('id', updatedCard.id)

  if (error !== null || siblings === null || siblings.length === 0) return

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
    const status = error.code === 'PGRST116' ? 404 : 500
    throw new AppError(
      status,
      status === 404 ? 'Card not found' : `Failed to update card: ${error.message}`,
    )
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
    throw new AppError(500, `Failed to delete card: ${deleteError.message}`)
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
    throw new AppError(500, `Failed to find similar cards: ${error.message}`)
  }

  return (data ?? []).map((row: unknown) => toCardRow(row as CardDbRow))
}
