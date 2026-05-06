import { supabaseAdmin } from '../db/supabase.ts'
import { narrowRow, asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import type { ListPremadeDecksQuery } from '../schemas/premade.schema.ts'
import type {
  ApiPremadeDeck,
  ApiPremadeSubscription,
  ApiSubscribeResult,
  DeckType,
  JLPTLevel,
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
 * Returns active premade decks, optionally filtered by deck_type, jlpt_level, or domain.
 */
export async function listPremadeDecks(
  filters: ListPremadeDecksQuery,
): Promise<ApiPremadeDeck[]> {
  let query = supabaseAdmin
    .from('premade_decks')
    .select(PREMADE_COLUMNS)
    .eq('is_active', true)
    .order('jlpt_level', { ascending: true })
    .order('name',       { ascending: true })
    // Defensive cap — the curated catalogue is small (single-digit decks today).
    // If it ever grows past this, real pagination is the answer.
    .limit(50)

  if (filters.deckType  !== undefined) query = query.eq('deck_type',  filters.deckType)
  if (filters.jlptLevel !== undefined) query = query.eq('jlpt_level', filters.jlptLevel)
  if (filters.domain    !== undefined) query = query.eq('domain',     filters.domain)

  const { data, error } = await query

  if (error !== null) {
    throw dbError('list premade decks', error)
  }

  return (data ?? []).map((row) => toPremadeRow(narrowRow<PremadeDeckDbRow>(row)))
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
 */
export async function listSubscriptions(userId: string): Promise<ApiPremadeSubscription[]> {
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

interface SubscribeRpcRow {
  subscription_id: string
  deck_id:         string
  card_count:      number
  already_existed: boolean
}

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
      const existing = (await listSubscriptions(userId))
        .find((s) => s.premadeDeckId === premadeDeckId)
      if (existing !== undefined) {
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

  const row = narrowRow<SubscribeRpcRow[] | null>(data)?.[0]
  if (row === undefined) {
    throw new AppError(500, 'Subscribe RPC returned no row')
  }

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
  // Function name cast: database.types.ts is auto-generated and won't include
  // unsubscribe_from_premade_deck until `supabase gen types` runs post-deploy.
  const { error } = await supabaseAdmin.rpc('unsubscribe_from_premade_deck' as never, asPayload({
    p_user_id:         userId,
    p_premade_deck_id: premadeDeckId,
  }))

  if (error !== null) {
    throw dbError('unsubscribe from premade deck', error)
  }
}
