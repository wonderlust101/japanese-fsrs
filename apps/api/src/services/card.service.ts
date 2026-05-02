import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import { getInitialFsrsState } from './fsrs.service.ts'
import type { UpdateCardInput, CardType, LayoutType, JlptLevel } from '../schemas/card.schema.ts'

// ─── Column projection ────────────────────────────────────────────────────────
// Excludes tokens, parsed_at, embedding — internal/heavy fields not needed by clients.

const CARD_COLUMNS = [
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

export interface CardRow {
  id:           string
  userId:       string
  deckId:       string
  layoutType:   LayoutType
  fieldsData:   Record<string, unknown>
  cardType:     CardType
  parentCardId: string | null
  tags:         string[] | null
  jlptLevel:    JlptLevel | null
  status:       string
  due:          string
  stability:    number
  difficulty:   number
  elapsedDays:  number
  scheduledDays: number
  reps:         number
  lapses:       number
  lastReview:   string | null
  state:        number
  createdAt:    string
  updatedAt:    string
}

export interface CardListResult {
  cards: CardRow[]
  total: number
}

export interface CreateCardMeta {
  card_type:      CardType
  layout_type:    LayoutType
  tags:           string[] | undefined
  jlpt_level:     JlptLevel | undefined
  parent_card_id: string | undefined
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function toCardRow(raw: Record<string, unknown>): CardRow {
  return {
    id:            raw['id'] as string,
    userId:        raw['user_id'] as string,
    deckId:        raw['deck_id'] as string,
    layoutType:    raw['layout_type'] as LayoutType,
    fieldsData:    raw['fields_data'] as Record<string, unknown>,
    cardType:      raw['card_type'] as CardType,
    parentCardId:  raw['parent_card_id'] as string | null,
    tags:          raw['tags'] as string[] | null,
    jlptLevel:     raw['jlpt_level'] as JlptLevel | null,
    status:        raw['status'] as string,
    due:           raw['due'] as string,
    stability:     raw['stability'] as number,
    difficulty:    raw['difficulty'] as number,
    elapsedDays:   raw['elapsed_days'] as number,
    scheduledDays: raw['scheduled_days'] as number,
    reps:          raw['reps'] as number,
    lapses:        raw['lapses'] as number,
    lastReview:    raw['last_review'] as string | null,
    state:         raw['state'] as number,
    createdAt:     raw['created_at'] as string,
    updatedAt:     raw['updated_at'] as string,
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
 * Returns a paginated list of cards in a deck owned by the user.
 * Throws 404 if the deck does not exist or belongs to a different user.
 */
export async function listCards(
  deckId: string,
  userId: string,
  limit: number,
  offset: number,
): Promise<CardListResult> {
  await assertDeckOwnership(deckId, userId)

  const { data, error, count } = await supabaseAdmin
    .from('cards')
    .select(CARD_COLUMNS, { count: 'exact' })
    .eq('deck_id', deckId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error !== null) {
    throw new AppError(500, `Failed to list cards: ${error.message}`)
  }

  return {
    cards: (data ?? []).map((row) => toCardRow(row as unknown as Record<string, unknown>)),
    total: count ?? 0,
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

  return toCardRow(data as unknown as Record<string, unknown>)
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
      tags:           meta.tags           ?? null,
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

  return toCardRow(data as unknown as Record<string, unknown>)
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

  return toCardRow(data as unknown as Record<string, unknown>)
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

  return (data ?? []).map((row: unknown) => toCardRow(row as Record<string, unknown>))
}
