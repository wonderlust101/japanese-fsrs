import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'
import { getInitialFsrsState } from './fsrs.service.ts'
import type { ListPremadeDecksQuery } from '../schemas/premade.schema.ts'
import type { DeckType } from '../schemas/deck.schema.ts'
import type { JlptLevel } from '../schemas/card.schema.ts'

// ─── Column projections ───────────────────────────────────────────────────────

const PREMADE_COLUMNS = [
  'id',
  'name',
  'description',
  'deck_type',
  'jlpt_level',
  'domain',
  'card_count',
  'version',
  'is_active',
  'created_at',
  'updated_at',
].join(', ')

// ─── Return shapes ────────────────────────────────────────────────────────────

export interface PremadeDeckRow {
  id:          string
  name:        string
  description: string | null
  deckType:    DeckType
  jlptLevel:   JlptLevel | null
  domain:      string | null
  cardCount:   number
  version:     number
  isActive:    boolean
  createdAt:   string
  updatedAt:   string
}

export interface SubscriptionRow {
  id:              string
  premadeDeckId:   string
  premadeDeckName: string
  deckId:          string
  cardCount:       number
  subscribedAt:    string
}

export interface SubscribeResult {
  subscriptionId: string
  deckId:         string
  cardCount:      number
  alreadyExisted: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPremadeRow(raw: Record<string, unknown>): PremadeDeckRow {
  return {
    id:          raw['id'] as string,
    name:        raw['name'] as string,
    description: raw['description'] as string | null,
    deckType:    raw['deck_type'] as DeckType,
    jlptLevel:   raw['jlpt_level'] as JlptLevel | null,
    domain:      raw['domain'] as string | null,
    cardCount:   raw['card_count'] as number,
    version:     raw['version'] as number,
    isActive:    raw['is_active'] as boolean,
    createdAt:   raw['created_at'] as string,
    updatedAt:   raw['updated_at'] as string,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns active premade decks, optionally filtered by deck_type, jlpt_level, or domain.
 */
export async function listPremadeDecks(
  filters: ListPremadeDecksQuery,
): Promise<PremadeDeckRow[]> {
  let query = supabaseAdmin
    .from('premade_decks')
    .select(PREMADE_COLUMNS)
    .eq('is_active', true)
    .order('jlpt_level', { ascending: true })
    .order('name',       { ascending: true })

  if (filters.deckType  !== undefined) query = query.eq('deck_type',  filters.deckType)
  if (filters.jlptLevel !== undefined) query = query.eq('jlpt_level', filters.jlptLevel)
  if (filters.domain    !== undefined) query = query.eq('domain',     filters.domain)

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, `Failed to list premade decks: ${error.message}`)
  }

  return (data ?? []).map((row) => toPremadeRow(row as unknown as Record<string, unknown>))
}

/**
 * Returns a single active premade deck by ID. Throws 404 if missing or inactive.
 */
export async function getPremadeDeck(id: string): Promise<PremadeDeckRow> {
  const { data, error } = await supabaseAdmin
    .from('premade_decks')
    .select(PREMADE_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error !== null || data === null) {
    throw new AppError(404, 'Premade deck not found')
  }

  return toPremadeRow(data as unknown as Record<string, unknown>)
}

/**
 * Returns the user's subscription list joined with each premade deck's metadata
 * and the linked forked deck's id and card_count.
 */
export async function listSubscriptions(userId: string): Promise<SubscriptionRow[]> {
  const { data: subs, error: subsError } = await supabaseAdmin
    .from('user_premade_subscriptions')
    .select('id, premade_deck_id, subscribed_at')
    .eq('user_id', userId)
    .order('subscribed_at', { ascending: false })

  if (subsError !== null) {
    throw new AppError(500, `Failed to list subscriptions: ${subsError.message}`)
  }

  const rows = (subs ?? []) as Array<{ id: string; premade_deck_id: string; subscribed_at: string }>
  if (rows.length === 0) return []

  const premadeIds = rows.map((r) => r.premade_deck_id)

  const [premadeDecksResult, decksResult] = await Promise.all([
    supabaseAdmin
      .from('premade_decks')
      .select('id, name')
      .in('id', premadeIds),
    supabaseAdmin
      .from('decks')
      .select('id, source_premade_id, card_count')
      .eq('user_id', userId)
      .eq('is_premade_fork', true)
      .in('source_premade_id', premadeIds),
  ])

  if (premadeDecksResult.error !== null) {
    throw new AppError(500, `Failed to load premade deck names: ${premadeDecksResult.error.message}`)
  }
  if (decksResult.error !== null) {
    throw new AppError(500, `Failed to load forked decks: ${decksResult.error.message}`)
  }

  const nameById  = new Map<string, string>(
    ((premadeDecksResult.data ?? []) as Array<{ id: string; name: string }>)
      .map((p) => [p.id, p.name]),
  )
  const deckBySrc = new Map<string, { id: string; cardCount: number }>(
    ((decksResult.data ?? []) as Array<{ id: string; source_premade_id: string; card_count: number }>)
      .map((d) => [d.source_premade_id, { id: d.id, cardCount: d.card_count }]),
  )

  return rows
    .map<SubscriptionRow | null>((sub) => {
      const deck = deckBySrc.get(sub.premade_deck_id)
      const name = nameById.get(sub.premade_deck_id) ?? '(unknown deck)'
      if (deck === undefined) return null
      return {
        id:              sub.id,
        premadeDeckId:   sub.premade_deck_id,
        premadeDeckName: name,
        deckId:          deck.id,
        cardCount:       deck.cardCount,
        subscribedAt:    sub.subscribed_at,
      }
    })
    .filter((r): r is SubscriptionRow => r !== null)
}

/**
 * Subscribes the user to a premade deck.
 *
 * Steps:
 *   1. Verify the premade deck exists and is active.
 *   2. Insert into user_premade_subscriptions (idempotent on UNIQUE constraint).
 *      If the row already existed, return the linked deck without re-cloning.
 *   3. Create a personal deck row (is_premade_fork = TRUE, source_premade_id set).
 *   4. Bulk-clone the premade source cards into the new deck with FSRS state
 *      reset to "new". The card_count trigger keeps decks.card_count in sync.
 */
export async function subscribeToPremadeDeck(
  userId: string,
  premadeDeckId: string,
): Promise<SubscribeResult> {
  const premade = await getPremadeDeck(premadeDeckId)

  // Step 2 — check whether the user is already subscribed.
  const { data: existingSub, error: existingErr } = await supabaseAdmin
    .from('user_premade_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('premade_deck_id', premadeDeckId)
    .maybeSingle()

  if (existingErr !== null) {
    throw new AppError(500, `Failed to check existing subscription: ${existingErr.message}`)
  }

  if (existingSub !== null) {
    const { data: existingDeck, error: deckErr } = await supabaseAdmin
      .from('decks')
      .select('id, card_count')
      .eq('user_id', userId)
      .eq('source_premade_id', premadeDeckId)
      .maybeSingle()

    if (deckErr !== null) {
      throw new AppError(500, `Failed to load existing forked deck: ${deckErr.message}`)
    }
    if (existingDeck === null) {
      throw new AppError(500, 'Subscription exists but the forked deck is missing')
    }
    return {
      subscriptionId: (existingSub as { id: string }).id,
      deckId:         (existingDeck as { id: string }).id,
      cardCount:      (existingDeck as { card_count: number }).card_count,
      alreadyExisted: true,
    }
  }

  // Step 2 (continued) — create the subscription row.
  const { data: subData, error: subError } = await supabaseAdmin
    .from('user_premade_subscriptions')
    .insert({ user_id: userId, premade_deck_id: premadeDeckId })
    .select('id')
    .single()

  if (subError !== null || subData === null) {
    throw new AppError(500, `Failed to create subscription: ${subError?.message ?? 'unknown'}`)
  }

  const subscriptionId = (subData as { id: string }).id

  // Step 3 — create the personal forked deck.
  const { data: deckData, error: deckError } = await supabaseAdmin
    .from('decks')
    .insert({
      user_id:           userId,
      name:              premade.name,
      description:       premade.description,
      deck_type:         premade.deckType,
      is_premade_fork:   true,
      source_premade_id: premadeDeckId,
    })
    .select('id')
    .single()

  if (deckError !== null || deckData === null) {
    // Roll back the subscription so the next call can re-attempt cleanly.
    await supabaseAdmin
      .from('user_premade_subscriptions')
      .delete()
      .eq('id', subscriptionId)
    throw new AppError(500, `Failed to create forked deck: ${deckError?.message ?? 'unknown'}`)
  }

  const newDeckId = (deckData as { id: string }).id

  // Step 4 — clone source cards. Fetch the source rows then bulk-insert with
  // user_id and deck_id flipped on. We don't carry FSRS state from sources;
  // every personal copy starts at "new".
  const { data: sourceCards, error: sourceErr } = await supabaseAdmin
    .from('cards')
    .select('layout_type, fields_data, card_type, jlpt_level, tags')
    .eq('premade_deck_id', premadeDeckId)
    .is('user_id', null)

  if (sourceErr !== null) {
    throw new AppError(500, `Failed to load source cards: ${sourceErr.message}`)
  }

  const fsrs = getInitialFsrsState()
  const cardsToInsert = (sourceCards ?? []).map((c) => {
    const r = c as Record<string, unknown>
    return {
      user_id:        userId,
      deck_id:        newDeckId,
      premade_deck_id: null,
      layout_type:    r['layout_type'],
      fields_data:    r['fields_data'],
      card_type:      r['card_type'],
      jlpt_level:     r['jlpt_level'],
      tags:           r['tags'] ?? [],
      status:         fsrs.status,
      due:            fsrs.due,
      stability:      fsrs.stability,
      difficulty:     fsrs.difficulty,
      elapsed_days:   fsrs.elapsed_days,
      scheduled_days: fsrs.scheduled_days,
      learning_steps: fsrs.learning_steps,
      reps:           fsrs.reps,
      lapses:         fsrs.lapses,
      state:          fsrs.state,
      last_review:    fsrs.last_review,
    }
  })

  if (cardsToInsert.length > 0) {
    const { error: insertErr } = await supabaseAdmin
      .from('cards')
      .insert(cardsToInsert)
    if (insertErr !== null) {
      throw new AppError(500, `Failed to clone cards: ${insertErr.message}`)
    }
  }

  return {
    subscriptionId,
    deckId:         newDeckId,
    cardCount:      cardsToInsert.length,
    alreadyExisted: false,
  }
}

/**
 * Unsubscribes the user from a premade deck and deletes the linked forked deck.
 *
 * Idempotent: returns silently if no subscription or fork exists.
 */
export async function unsubscribeFromPremadeDeck(
  userId: string,
  premadeDeckId: string,
): Promise<void> {
  // Delete the forked deck first — its cascade removes the user's personal cards.
  const { error: deckError } = await supabaseAdmin
    .from('decks')
    .delete()
    .eq('user_id', userId)
    .eq('source_premade_id', premadeDeckId)
    .eq('is_premade_fork', true)

  if (deckError !== null) {
    throw new AppError(500, `Failed to delete forked deck: ${deckError.message}`)
  }

  const { error: subError } = await supabaseAdmin
    .from('user_premade_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('premade_deck_id', premadeDeckId)

  if (subError !== null) {
    throw new AppError(500, `Failed to delete subscription: ${subError.message}`)
  }
}
