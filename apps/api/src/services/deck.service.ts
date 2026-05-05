import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import { State } from '@fsrs-japanese/shared-types'
import type { CreateDeckInput, UpdateDeckInput, DeckType } from '../schemas/deck.schema.ts'

// ─── Column projections ───────────────────────────────────────────────────────
// Keep these in sync with the return interfaces below. Never use select('*').

const DECK_COLUMNS = [
  'id',
  'user_id',
  'name',
  'description',
  'deck_type',
  'is_public',
  'is_premade_fork',
  'source_premade_id',
  'card_count',
  'created_at',
  'updated_at',
].join(', ')

// ─── Return shapes ────────────────────────────────────────────────────────────

/** Deck row returned by list and create endpoints. */
export interface DeckRow {
  id:              string
  userId:          string
  name:            string
  description:     string | null
  deckType:        DeckType
  isPublic:        boolean
  isPremadeFork:   boolean
  sourcePremadeId: string | null
  cardCount:       number
  createdAt:       string
  updatedAt:       string
}

/** Deck row augmented with computed review stats — returned by the detail endpoint. */
export interface DeckWithStats extends DeckRow {
  /** Cards due for review right now (due <= NOW, status != suspended). */
  dueCount: number
  /** Cards that have never been reviewed (status = new). */
  newCount: number
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface DeckDbRow {
  id:                string
  user_id:           string
  name:              string
  description:       string | null
  deck_type:         DeckType
  is_public:         boolean
  is_premade_fork:   boolean
  source_premade_id: string | null
  card_count:        number
  created_at:        string
  updated_at:        string
}

/** Maps a raw DB row (snake_case) to the camelCase API shape. */
function toRow(raw: DeckDbRow): DeckRow {
  return {
    id:              raw.id,
    userId:          raw.user_id,
    name:            raw.name,
    description:     raw.description,
    deckType:        raw.deck_type,
    isPublic:        raw.is_public,
    isPremadeFork:   raw.is_premade_fork,
    sourcePremadeId: raw.source_premade_id,
    cardCount:       raw.card_count,
    createdAt:       raw.created_at,
    updatedAt:       raw.updated_at,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns all decks owned by the given user, ordered by most recently updated.
 */
export async function listDecks(userId: string): Promise<DeckRow[]> {
  const { data, error } = await supabaseAdmin
    .from('decks')
    .select(DECK_COLUMNS)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (error !== null) {
    throw dbError('list decks', error)
  }

  return (data ?? []).map((row) => toRow(row as unknown as DeckDbRow))
}

/**
 * Returns a single deck with computed review stats.
 *
 * Throws 404 if the deck does not exist or does not belong to the user.
 * Three queries run in parallel: the deck row, due-card count, and new-card count.
 */
export async function getDeck(deckId: string, userId: string): Promise<DeckWithStats> {
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
    throw new AppError(404, 'Deck not found')
  }

  return {
    ...toRow(deckResult.data as unknown as DeckDbRow),
    dueCount: dueResult.count ?? 0,
    newCount: newResult.count ?? 0,
  }
}

/**
 * Creates a new deck owned by the given user.
 *
 * @param userId - Taken from the verified JWT; never from the request body.
 */
export async function createDeck(userId: string, input: CreateDeckInput): Promise<DeckRow> {
  const { data, error } = await supabaseAdmin
    .from('decks')
    .insert({
      user_id:     userId,
      name:        input.name,
      description: input.description ?? null,
      deck_type:   input.deck_type,
    })
    .select(DECK_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw dbError('create deck', error)
  }

  return toRow(data as unknown as DeckDbRow)
}

/**
 * Applies a partial update to a deck and returns the updated row.
 *
 * Throws 404 if the deck does not exist or does not belong to the user —
 * the ownership guard is baked into the WHERE clause rather than a
 * separate fetch, so a missing row and a wrong-owner row are indistinguishable
 * (intentional: avoids leaking deck existence to other users).
 */
export async function updateDeck(
  deckId: string,
  userId: string,
  input: UpdateDeckInput,
): Promise<DeckRow> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (input.name        !== undefined) patch['name']        = input.name
  if (input.description !== undefined) patch['description'] = input.description
  if (input.deck_type   !== undefined) patch['deck_type']   = input.deck_type
  if (input.is_public   !== undefined) patch['is_public']   = input.is_public

  const { data, error } = await supabaseAdmin
    .from('decks')
    .update(patch as never)
    .eq('id', deckId)
    .eq('user_id', userId)
    .select(DECK_COLUMNS)
    .single()

  if (error !== null) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Deck not found')
    throw dbError('update deck', error)
  }

  if (data === null) {
    throw new AppError(404, 'Deck not found')
  }

  return toRow(data as unknown as DeckDbRow)
}

/**
 * Deletes a deck and all of its cards (cascade is set in the DB schema).
 *
 * Confirms ownership via a SELECT before deleting so we can distinguish
 * "not found / wrong owner" from a delete failure.
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
    throw new AppError(404, 'Deck not found')
  }

  const { error: deleteError } = await supabaseAdmin
    .from('decks')
    .delete()
    .eq('id', deckId)

  if (deleteError !== null) {
    throw dbError('delete deck', deleteError)
  }
}
