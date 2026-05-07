import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { narrowRow, asPayload } from '../lib/db.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

const log = componentLogger('premade.service')
import type { ListPremadeDecksQuery } from '../schemas/premade.schema.ts'
import {
  deckTypeEnum,
  jlptLevelEnum,
  type ApiList,
  type ApiPremadeDeck,
  type ApiPremadeSubscription,
  type ApiSubscribeResult,
  type DeckType,
  type JLPTLevel,
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
  'version',
  'is_active',
  'created_at',
  'updated_at',
].join(', ')

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface PremadeDeckDbRow {
  id:          string
  name:        string
  description: string | null
  deck_type:   DeckType
  jlpt_level:  JLPTLevel | null
  domain:      string | null
  card_count:  number
  version:     number
  is_active:   boolean
  created_at:  string
  updated_at:  string
}

// ─── RPC envelope schema ──────────────────────────────────────────────────────
// Mirrors the analytics / review precedent: parse the RPC result so any
// future column drift surfaces as a clean ZodError.
const PremadeDeckListRpcRowSchema = z.object({
  id:          z.string(),
  name:        z.string(),
  description: z.string().nullable(),
  deck_type:   deckTypeEnum,
  jlpt_level:  jlptLevelEnum.nullable(),
  domain:      z.string().nullable(),
  card_count:  z.number(),
  version:     z.number(),
  is_active:   z.boolean(),
  created_at:  z.string(),
  updated_at:  z.string(),
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
    version:     raw.version,
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
  const { data, error } = await supabaseAdmin.rpc('list_premade_decks_paginated', asPayload({
    p_limit:      filters.limit + 1,
    p_cursor:     filters.cursor    ?? null,
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

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
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
    throw new AppError(404, 'Premade deck not found')
  }

  return toPremadeRow(narrowRow<PremadeDeckDbRow>(data))
}

/**
 * Returns the user's subscription list joined with each premade deck's metadata
 * and the linked forked deck's id and card_count.
 * Internal helper — `subscriptionsList` wraps the result in the universal
 * list envelope. Other in-process callers (subscribe race fallback) need the
 * raw array.
 */
async function listSubscriptionsRaw(userId: string): Promise<ApiPremadeSubscription[]> {
  const { data: subs, error: subsError } = await supabaseAdmin
    .from('user_premade_subscriptions')
    .select('id, premade_deck_id, subscribed_at')
    .eq('user_id', userId)
    .order('subscribed_at', { ascending: false })

  if (subsError !== null) {
    throw dbError('list subscriptions', subsError)
  }

  interface SubscriptionDbRow { id: string; premade_deck_id: string; subscribed_at: string }
  const rows = narrowRow<SubscriptionDbRow[]>(subs ?? [])
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
    throw dbError('load premade deck names', premadeDecksResult.error)
  }
  if (decksResult.error !== null) {
    throw dbError('load forked decks', decksResult.error)
  }

  interface PremadeNameRow { id: string; name: string }
  interface ForkedDeckRow  { id: string; source_premade_id: string; card_count: number }

  const nameById  = new Map<string, string>(
    narrowRow<PremadeNameRow[]>(premadeDecksResult.data ?? [])
      .map((p) => [p.id, p.name]),
  )
  const deckBySrc = new Map<string, { id: string; cardCount: number }>(
    narrowRow<ForkedDeckRow[]>(decksResult.data ?? [])
      .map((d) => [d.source_premade_id, { id: d.id, cardCount: d.card_count }]),
  )

  return rows
    .map<ApiPremadeSubscription | null>((sub) => {
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
    .filter((r): r is ApiPremadeSubscription => r !== null)
}

/**
 * Public list endpoint for the user's premade-deck subscriptions, wrapped in
 * the universal list envelope. Subscriptions are bounded by the catalogue
 * size, so `nextCursor` is always null and `hasMore` is always false.
 */
export async function listSubscriptions(
  userId: string,
): Promise<ApiList<ApiPremadeSubscription>> {
  const items = await listSubscriptionsRaw(userId)
  return { items, nextCursor: null, hasMore: false }
}

// RPC envelope schema for subscribe_to_premade_deck. Validated at runtime via
// .parse() so a future signature drift surfaces as a ZodError instead of
// silently passing through `narrowRow`.
const SubscribeRpcRowSchema = z.object({
  subscription_id: z.string(),
  deck_id:         z.string(),
  card_count:      z.number(),
  already_existed: z.boolean(),
})

/**
 * Subscribes the user to a premade deck via the subscribe_to_premade_deck RPC.
 *
 * Atomic on the SQL side: either subscription, forked deck, and card clones
 * all exist or none do. If the user is already subscribed, returns the
 * existing fork without re-cloning.
 */
export async function subscribeToPremadeDeck(
  userId: string,
  premadeDeckId: string,
): Promise<ApiSubscribeResult> {
  const { data, error } = await supabaseAdmin.rpc('subscribe_to_premade_deck', {
    p_user_id:         userId,
    p_premade_deck_id: premadeDeckId,
  })

  if (error !== null) {
    if (error.code === 'P0002') throw new AppError(404, 'Premade deck not found')
    // Concurrent subscribe race: the other request committed the INSERT first
    // and the unique (user_id, premade_deck_id) constraint fired on this one.
    // The user is in fact subscribed; surface the existing record.
    if (error.code === '23505') {
      const existing = (await listSubscriptionsRaw(userId))
        .find((s) => s.premadeDeckId === premadeDeckId)
      if (existing !== undefined) {
        log.info(
          { userId, premadeDeckId, deckId: existing.deckId, cardCount: existing.cardCount, alreadyExisted: true },
          'subscribed (race fallback)',
        )
        return {
          subscriptionId: existing.id,
          deckId:         existing.deckId,
          cardCount:      existing.cardCount,
          alreadyExisted: true,
        }
      }
    }
    throw dbError('subscribe to premade deck', error)
  }

  const rows = z.array(SubscribeRpcRowSchema).parse(data ?? [])
  const row  = rows[0]
  if (row === undefined) {
    throw new AppError(500, 'Subscribe RPC returned no row')
  }

  log.info(
    {
      userId,
      premadeDeckId,
      deckId:         row.deck_id,
      cardCount:      row.card_count,
      alreadyExisted: row.already_existed,
    },
    'subscribed',
  )

  return {
    subscriptionId: row.subscription_id,
    deckId:         row.deck_id,
    cardCount:      row.card_count,
    alreadyExisted: row.already_existed,
  }
}

/**
 * Unsubscribes the user from a premade deck and deletes the linked forked deck
 * via the unsubscribe_from_premade_deck RPC (atomic on the SQL side).
 *
 * Idempotent: returns silently if no subscription or fork exists.
 */
export async function unsubscribeFromPremadeDeck(
  userId: string,
  premadeDeckId: string,
): Promise<void> {
  const { error } = await supabaseAdmin.rpc('unsubscribe_from_premade_deck', asPayload({
    p_user_id:         userId,
    p_premade_deck_id: premadeDeckId,
  }))

  if (error !== null) {
    throw dbError('unsubscribe from premade deck', error)
  }
}
