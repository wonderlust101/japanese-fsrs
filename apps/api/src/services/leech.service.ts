import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { encodeCursor, decodeCursor } from '../lib/http.ts'
import { componentLogger } from '../lib/logger.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import {
  leechCreatedAtCursorSchema,
  type CreateDrillSessionInput,
  type ListLeechesQuery,
  type RecordDrillAttemptInput,
} from '../schemas/leech.schema.ts'
import {
  getWordFields,
  type ApiLeechListItem,
  type ApiLeechListResponse,
  type ApiLeechDrillSession,
  type ApiLeechDrillSessionDetail,
  type ApiLeechDrillAttempt,
  type FieldsData,
  type LayoutType,
  type CardType,
  type JLPTLevel,
} from '@fsrs-japanese/shared-types'

const log = componentLogger('leech.service')

// ─── Column projections ───────────────────────────────────────────────────────
//
// PostgREST embedded-select syntax. The relationships are inferred from the
// foreign keys: `leeches.card_id → cards.id` and `cards.deck_id → decks.id`,
// so the embed names are `cards` and `decks`. Never use `select('*')` — it
// keeps PII out of accidental log dumps and lets the schema evolve.
//
// The embed defaults to a LEFT JOIN so leeches with `card_id IS NULL`
// (preserved-after-card-deletion, per migration 20260425000001) still appear
// in the list view. When a card-side filter is applied we swap to
// `cards!inner` so non-matching cards drop the parent row instead of
// surfacing as a leech with `card: null`.

function leechSelect(innerJoin: boolean): string {
  const cardEmbed = innerJoin ? 'cards!inner' : 'cards'
  return `
    id,
    card_id,
    diagnosis,
    prescription,
    resolved,
    resolved_at,
    created_at,
    card:${cardEmbed} (
      deck_id,
      fields_data,
      layout_type,
      card_type,
      jlpt_level,
      lapses,
      reps,
      due,
      last_review,
      is_suspended,
      deck:decks ( name )
    )
  `
}

const LEECH_SELECT_LEFT  = leechSelect(false)
const LEECH_SELECT_INNER = leechSelect(true)

// ─── Row schemas ──────────────────────────────────────────────────────────────
//
// Parse every Supabase response with a Zod schema so silent column drift
// surfaces as a clean ZodError instead of an `undefined` at the wire boundary.
// Mirrors the precedent set in analytics.service.ts / deck.service.ts.

const LeechDeckRowSchema = z.object({
  name: z.string(),
}).nullable()

const LeechCardRowSchema = z.object({
  deck_id:      z.string().uuid(),
  fields_data:  z.record(z.string(), z.unknown()),
  layout_type:  z.enum(['vocabulary', 'grammar', 'sentence']),
  card_type:    z.enum(['comprehension', 'production', 'listening']),
  jlpt_level:   z.enum(['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt']).nullable(),
  lapses:       z.number().int().nonnegative(),
  reps:         z.number().int().nonnegative(),
  due:          z.string(),
  last_review:  z.string().nullable(),
  is_suspended: z.boolean(),
  deck:         LeechDeckRowSchema,
}).nullable()

const LeechRowSchema = z.object({
  id:           z.string().uuid(),
  card_id:      z.string().uuid().nullable(),
  diagnosis:    z.string().nullable(),
  prescription: z.string().nullable(),
  resolved:     z.boolean(),
  resolved_at:  z.string().nullable(),
  created_at:   z.string(),
  card:         LeechCardRowSchema,
})

/** Internal row type. Exported solely so the unit test can type its fixtures
 *  without redeclaring the joined-row shape. Not part of the public API. */
export type LeechRow = z.infer<typeof LeechRowSchema>

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Snake_case DB row → camelCase wire shape. Card-derived fields fall back to
 * null when the joined card row is absent (orphaned leech: card was deleted
 * but the leech is kept as historical learning data, per [[DATABASE]]).
 */
export function toListItem(raw: LeechRow): ApiLeechListItem {
  const card = raw.card

  let word: string | null = null
  let reading: string | null = null
  let meaning: string | null = null

  if (card !== null) {
    // `getWordFields` returns null for sentence-layout cards; vocabulary and
    // grammar both expose word/reading/meaning via WordFields.
    const fields = getWordFields({
      layoutType: card.layout_type as LayoutType,
      fieldsData: card.fields_data as FieldsData,
    })
    if (fields !== null) {
      word    = fields.word
      reading = fields.reading
      meaning = fields.meaning
    }
  }

  return {
    id:           raw.id,
    cardId:       raw.card_id,
    deckId:       card?.deck_id ?? null,
    deckName:     card?.deck?.name ?? null,
    word,
    reading,
    meaning,
    layoutType:   (card?.layout_type as LayoutType | undefined) ?? null,
    cardType:     (card?.card_type as CardType | undefined)     ?? null,
    jlptLevel:    (card?.jlpt_level as JLPTLevel | null | undefined) ?? null,
    lapses:       card?.lapses      ?? null,
    reps:         card?.reps        ?? null,
    due:          card?.due         ?? null,
    lastReview:   card?.last_review ?? null,
    diagnosis:    raw.diagnosis,
    prescription: raw.prescription,
    resolved:     raw.resolved,
    resolvedAt:   raw.resolved_at,
    createdAt:    raw.created_at,
  }
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Returns a cursor-paginated list of the authenticated user's leeches.
 *
 * Sort modes:
 *   - 'mostRecent'       (default) — ORDER BY created_at DESC, id DESC
 *   - 'oldestUnresolved'           — ORDER BY created_at ASC,  id ASC
 *   - 'mostLapses'                 — ORDER BY card.lapses DESC NULLS LAST,
 *                                             created_at DESC, id DESC
 *   - 'deckOrder'                  — ORDER BY card.deck_id ASC,
 *                                             created_at DESC, id DESC
 *
 * Cursor pagination is supported for the two time-keyed sorts; both keys are
 * immutable on `leeches`, so the cursor is stable across concurrent UPDATEs
 * (a resolve flip does not move a row in the index).
 *
 * `mostLapses` and `deckOrder` are currently top-N only: their head sort keys
 * live on the joined card row, and a correct keyset implementation needs an
 * RPC that can express the multi-column tuple comparison atomically. A
 * follow-up RPC migration in a later stage can lift this restriction.
 *
 * Filter dimensions (`status`, `deckId`, `jlptLevel`, `cardType`) all apply at
 * the SQL `WHERE` clause boundary. The `diagnosis` filter is in the same shape
 * but lives on `leeches` itself, not on the joined card row, so it does not
 * trigger the LEFT→INNER join switch that the card-side filters do.
 */
export async function listLeeches(
  userId: string,
  params: ListLeechesQuery,
): Promise<ApiLeechListResponse> {
  const { status, deckId, jlptLevel, cardType, diagnosis, sort, limit, cursor } = params

  // Card-side filters force an inner join so non-matching cards drop the
  // parent leech rather than surface with `card: null`. Orphans (card_id IS
  // NULL) are dropped naturally when any card filter is applied — that's the
  // desired behavior since the user is asking "which leeches match this
  // deck/JLPT/etc."
  //
  // The `diagnosis` filter is intentionally NOT part of hasCardFilter — it
  // lives on `leeches`, not on `cards`. Forcing inner-join because of it
  // would incorrectly drop orphan leeches (card_id NULL) where a diagnosis
  // was recorded before the card was deleted.
  const hasCardFilter = deckId !== undefined || jlptLevel !== undefined || cardType !== undefined
  const selectStr = hasCardFilter ? LEECH_SELECT_INNER : LEECH_SELECT_LEFT

  let q = supabaseAdmin
    .from('leeches')
    .select(selectStr)
    .eq('user_id', userId)
    .eq('resolved', status === 'resolved')
    .limit(limit + 1)

  if (deckId    !== undefined) q = q.eq('card.deck_id',    deckId)
  if (jlptLevel !== undefined) q = q.eq('card.jlpt_level', jlptLevel)
  if (cardType  !== undefined) q = q.eq('card.card_type',  cardType)

  if (diagnosis === 'available') {
    // PostgREST compiles `.not('diagnosis', 'is', null)` to `diagnosis IS NOT NULL`.
    q = q.not('diagnosis', 'is', null)
  } else if (diagnosis === 'missing') {
    q = q.is('diagnosis', null)
  }

  // ── Ordering ──
  if (sort === 'mostRecent') {
    q = q
      .order('created_at', { ascending: false })
      .order('id',         { ascending: false })
  } else if (sort === 'oldestUnresolved') {
    q = q
      .order('created_at', { ascending: true })
      .order('id',         { ascending: true })
  } else if (sort === 'mostLapses') {
    // `foreignTable` orders by the joined cards row; nullsFirst:false keeps
    // orphan leeches (card row absent) at the end of the list.
    q = q
      .order('lapses',     { ascending: false, nullsFirst: false, foreignTable: 'cards' })
      .order('created_at', { ascending: false })
      .order('id',         { ascending: false })
  } else {
    // deckOrder. Groups adjacent leeches by deck. Across decks the order is
    // by deck UUID (deterministic but not alphabetical) — that's an acceptable
    // trade for avoiding an extra join just to sort on deck.name. In practice
    // this sort is most useful paired with a deckId filter, where intra-deck
    // ordering matters and inter-deck ordering doesn't.
    q = q
      .order('deck_id',    { ascending: true, foreignTable: 'cards' })
      .order('created_at', { ascending: false })
      .order('id',         { ascending: false })
  }

  // ── Cursor ──
  if (cursor !== undefined) {
    if (sort === 'mostLapses' || sort === 'deckOrder') {
      // See docstring — both sorts are top-N only for now. Their head sort key
      // lives on the joined card row, so a correct keyset cursor needs an RPC
      // we haven't built. A clean 400 is better than silently returning the
      // same page on every "next" click.
      throw new AppError(400, 'Cursor pagination is not supported for this sort order', { code: 'CURSOR_INVALID' })
    }
    const { createdAt, id } = decodeCursor(cursor, leechCreatedAtCursorSchema)
    // Keyset pagination over the tuple (created_at, id). For DESC order:
    //   WHERE created_at < cursor.createdAt
    //      OR (created_at = cursor.createdAt AND id < cursor.id)
    // For ASC order, swap < / > operators.
    //
    // Supabase JS's .or() takes a single string of comma-separated filter
    // alternatives; nested AND is `and(<filter>,<filter>)`. UUIDs and ISO-8601
    // timestamps cannot contain commas or unescaped reserved chars, so direct
    // interpolation is safe — but if the cursor schema ever widens, revisit.
    const op = sort === 'mostRecent' ? 'lt' : 'gt'
    q = q.or(`created_at.${op}.${createdAt},and(created_at.eq.${createdAt},id.${op}.${id})`)
  }

  const { data, error } = await q

  if (error !== null) {
    throw dbError('list leeches', error)
  }

  const rows    = z.array(LeechRowSchema).parse(data ?? [])
  const hasMore = rows.length > limit
  const visible = rows.slice(0, limit)
  const items   = visible.map(toListItem)

  let nextCursor: string | null = null
  if (hasMore && sort !== 'mostLapses' && sort !== 'deckOrder') {
    const last = visible[visible.length - 1]
    if (last !== undefined) {
      nextCursor = encodeCursor({ createdAt: last.created_at, id: last.id })
    }
  }

  return { items, nextCursor, hasMore }
}

/**
 * Returns a single leech with full joined context, or throws 404 if the row
 * does not exist for the authenticated user. The query filters by user_id in
 * SQL — RLS would also block cross-user reads, but we use the service-role
 * client so explicit filtering is the only safety belt.
 */
export async function getLeechById(userId: string, id: string): Promise<ApiLeechListItem> {
  const { data, error } = await supabaseAdmin
    .from('leeches')
    .select(LEECH_SELECT_LEFT)
    .eq('id',      id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error !== null) {
    log.error({ leechId: id, err: { message: error.message, code: error.code } }, 'getLeechById query failed')
    throw dbError('fetch leech', error)
  }
  if (data === null) {
    throw new AppError(404, 'Leech not found', { code: 'LEECH_NOT_FOUND' })
  }

  return toListItem(LeechRowSchema.parse(data))
}

// ─── Write path (Stage 2) ─────────────────────────────────────────────────────
//
// Slim projection used by the pre-fetch step of resolveLeech / reopenLeech.
// We only need to know the row's current state to decide between:
//   - 404 (row missing or wrong owner)
//   - idempotent return (already in target state)
//   - real UPDATE (state needs flipping)
// Keeping the projection minimal here avoids paying for the full joined
// payload on the idempotent path; the post-update select brings back the
// LEECH_SELECT_LEFT shape so callers always get the same response as
// getLeechById.

const LeechStateRowSchema = z.object({
  id:          z.string().uuid(),
  resolved:    z.boolean(),
  resolved_at: z.string().nullable(),
})

async function fetchLeechState(userId: string, id: string): Promise<z.infer<typeof LeechStateRowSchema>> {
  const { data, error } = await supabaseAdmin
    .from('leeches')
    .select('id, resolved, resolved_at')
    .eq('id',      id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error !== null) {
    log.error({ leechId: id, err: { message: error.message, code: error.code } }, 'fetchLeechState query failed')
    throw dbError('fetch leech', error)
  }
  if (data === null) {
    // Same 404 shape as getLeechById for cross-user attempts — does not leak
    // existence to other users.
    throw new AppError(404, 'Leech not found', { code: 'LEECH_NOT_FOUND' })
  }
  return LeechStateRowSchema.parse(data)
}

async function fetchLeechJoined(userId: string, id: string): Promise<ApiLeechListItem> {
  // Reads the row we just mutated. .single() is the right terminal here:
  // the row provably exists (we just confirmed it in the pre-fetch and the
  // UPDATE returned without 404 conditions), so a null result would be a
  // genuine 500-class anomaly worth surfacing as such.
  const { data, error } = await supabaseAdmin
    .from('leeches')
    .select(LEECH_SELECT_LEFT)
    .eq('id',      id)
    .eq('user_id', userId)
    .single()

  if (error !== null) {
    log.error({ leechId: id, err: { message: error.message, code: error.code } }, 'fetchLeechJoined query failed')
    throw dbError('refetch leech', error)
  }
  return toListItem(LeechRowSchema.parse(data))
}

/**
 * Marks a leech as resolved. Idempotent: resolving an already-resolved leech
 * returns the row unchanged so the original `resolved_at` (the moment the
 * learner actually closed the loop) is preserved across accidental retries.
 *
 * Two round-trips:
 *   1) State pre-fetch — 404 cleanly when missing or cross-user; short-circuit
 *      to a joined fetch when already in the target state.
 *   2) UPDATE — flips resolved + stamps resolved_at, then the joined refetch
 *      returns the same shape as getLeechById so callers can drop the
 *      response directly into their cache.
 */
export async function resolveLeech(userId: string, id: string): Promise<ApiLeechListItem> {
  const current = await fetchLeechState(userId, id)

  if (current.resolved) {
    // Already resolved — return the existing joined payload without writing.
    return fetchLeechJoined(userId, id)
  }

  const { error } = await supabaseAdmin
    .from('leeches')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id',      id)
    .eq('user_id', userId)

  if (error !== null) {
    throw dbError('resolve leech', error)
  }

  return fetchLeechJoined(userId, id)
}

/**
 * Reopens a previously-resolved leech.
 *
 * Idempotent on the happy path; throws 409 LEECH_ALREADY_OPEN when another
 * unresolved leech for the same (card_id, user_id) already exists. That
 * conflict is enforced at the DB layer by the partial unique index
 * `leeches_card_user_unresolved_idx` (migration 20260425000001) — we catch
 * SQLSTATE 23505 from the UPDATE and translate it before it falls through to
 * the generic `dbError` mapper. A pre-check would race; the only correct
 * pattern is "UPDATE optimistically, catch 23505, translate to 409".
 */
export async function reopenLeech(userId: string, id: string): Promise<ApiLeechListItem> {
  const current = await fetchLeechState(userId, id)

  if (!current.resolved) {
    // Already open — return the existing joined payload without writing.
    return fetchLeechJoined(userId, id)
  }

  const { error } = await supabaseAdmin
    .from('leeches')
    .update({ resolved: false, resolved_at: null })
    .eq('id',      id)
    .eq('user_id', userId)

  if (error !== null) {
    if (typeof error === 'object' && 'code' in error && error.code === '23505') {
      throw new AppError(
        409,
        'Another unresolved leech exists for this card; resolve it first',
        { cause: error, code: 'LEECH_ALREADY_OPEN' },
      )
    }
    throw dbError('reopen leech', error)
  }

  return fetchLeechJoined(userId, id)
}

// ─── Drill sessions (Stage 3) ─────────────────────────────────────────────────
//
// The RPC `create_leech_drill_session` (migration 20260531000000) runs the
// candidate selection, session INSERT, and N snapshot INSERTs inside one
// transaction. The service does not call the FSRS layer and never writes to
// `cards` or `review_logs` — drill is a parallel namespace by design.

const DrillSessionCardRowSchema = z.object({
  sessionCardId: z.string().uuid(),
  leechId:       z.string().uuid(),
  cardId:        z.string().uuid(),
  ordinal:       z.number().int().nonnegative(),
  layoutType:    z.enum(['vocabulary', 'grammar', 'sentence']),
  cardType:      z.enum(['comprehension', 'production', 'listening']),
  fieldsData:    z.record(z.string(), z.unknown()),
  lapses:        z.number().int().nonnegative(),
})

const DrillSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  status:    z.enum(['active', 'finished', 'aborted']),
  cards:     z.array(DrillSessionCardRowSchema),
})

/** Wire camelCase → DB snake_case for the `source` enum. The DB CHECK admits
 *  the snake_case values; the API accepts only the two Stage 3 implements. */
function sourceToDb(source: CreateDrillSessionInput['source']): string {
  return source === 'unresolvedLeeches' ? 'unresolved_leeches' : 'deck_scoped'
}

/** Wire camelCase → DB snake_case for the `repeat_policy` enum. */
function repeatPolicyToDb(policy: CreateDrillSessionInput['repeatPolicy']): string {
  return policy === 'missedAfterLag' ? 'missed_after_lag' : 'none'
}

/**
 * Creates a persisted drill session for the authenticated user and returns
 * the ordered queue (each card stamped with its `sessionCardId` for Stage 5
 * attempts). The RPC snapshots canonical FSRS state for every queued card so
 * Stage 4's resume endpoint can detect staleness without re-querying the
 * full history.
 *
 * An empty queue is a valid result (status 'active', cards: []) — the caller
 * decides how to surface "nothing to drill right now" in UX.
 *
 * Idempotency: the controller wraps this call in `withIdempotency`, so
 * network retries with the same `Idempotency-Key` + body return the same
 * sessionId rather than creating duplicate sessions.
 */
export async function createDrillSession(
  userId: string,
  input:  CreateDrillSessionInput,
): Promise<ApiLeechDrillSession> {
  const { data, error } = await supabaseAdmin.rpc('create_leech_drill_session', asPayload({
    p_user_id:       userId,
    p_source:        sourceToDb(input.source),
    p_deck_id:       input.deckId    ?? null,
    p_jlpt_level:    input.jlptLevel ?? null,
    p_card_type:     input.cardType  ?? null,
    p_order:         input.order,
    p_limit:         input.limit,
    p_mode:          input.mode,
    p_repeat_policy: repeatPolicyToDb(input.repeatPolicy),
    p_stop_rule:     input.stopRule,
    // source_query is the analytics breadcrumb. Persist the wire-level filters
    // (camelCase) so future analytics queries don't have to reverse-map.
    p_source_query: {
      deckId:    input.deckId    ?? null,
      jlptLevel: input.jlptLevel ?? null,
      cardType:  input.cardType  ?? null,
      order:     input.order,
      limit:     input.limit,
    },
  }))

  if (error !== null) {
    log.error({ err: { message: error.message, code: error.code } }, 'createDrillSession RPC failed')
    throw dbError('create drill session', error)
  }

  // The RPC's RETURNS JSONB carries the full envelope. Parse it through Zod
  // so silent schema drift surfaces as a clean ZodError at this boundary.
  return DrillSessionResponseSchema.parse(data)
}

// ─── Drill session resume (Stage 4) ───────────────────────────────────────────
//
// `GET /api/v1/leeches/drill-sessions/:sessionId` returns the persisted queue
// plus an advisory staleness signal — true when the canonical FSRS state of
// at least one queued card has changed since the session was created. The
// staleness check is non-blocking: drilling itself stays safe even when
// stale (drill attempts never read or write `cards`), the flag is just a
// hint for the frontend to suppress "what would happen next" previews.

const DrillSessionDetailCardRowSchema = z.object({
  sessionCardId: z.string().uuid(),
  leechId:       z.string().uuid().nullable(),
  cardId:        z.string().uuid().nullable(),
  ordinal:       z.number().int().nonnegative(),
  layoutType:    z.enum(['vocabulary', 'grammar', 'sentence']).nullable(),
  cardType:      z.enum(['comprehension', 'production', 'listening']).nullable(),
  fieldsData:    z.record(z.string(), z.unknown()).nullable(),
  lapses:        z.number().int().nonnegative().nullable(),
  isOrphaned:    z.boolean(),
  isStale:       z.boolean(),
})

const DrillSessionDetailResponseSchema = z.object({
  sessionId:             z.string().uuid(),
  status:                z.enum(['active', 'finished', 'aborted']),
  isCanonicalStateStale: z.boolean(),
  staleCards:            z.array(z.string().uuid()),
  cards:                 z.array(DrillSessionDetailCardRowSchema),
})

/**
 * Returns a drill session's full detail for resume: the ordered queue, per-row
 * `isStale` / `isOrphaned` flags, the top-level `isCanonicalStateStale`
 * boolean, and the `staleCards` array of card UUIDs whose stored fingerprint
 * no longer matches the current `cards` state.
 *
 * Throws 404 LEECH_DRILL_SESSION_NOT_FOUND when the session doesn't exist or
 * doesn't belong to the authenticated user — the cross-user case is
 * intentionally indistinguishable from "doesn't exist" to avoid leaking
 * existence to other users.
 *
 * The RPC `get_leech_drill_session` (migration 20260601000000) does all the
 * work in one transaction-friendly read: one LEFT JOIN scan against the
 * session's snapshot rows, fingerprint recomputation via the IMMUTABLE helper
 * `compute_card_state_fingerprint_v1`, and JSONB aggregation. The service is
 * purely a forwarder + Zod boundary parser.
 */
export async function getDrillSession(
  userId:    string,
  sessionId: string,
): Promise<ApiLeechDrillSessionDetail> {
  const { data, error } = await supabaseAdmin.rpc('get_leech_drill_session', asPayload({
    p_user_id:    userId,
    p_session_id: sessionId,
  }))

  if (error !== null) {
    // RPC raises `leech_drill_session_not_found` with SQLSTATE 02000 when the
    // session row doesn't exist for this user. Same precedent as deck.service's
    // DECK_NOT_FOUND translation (see deck.service.ts:225-227).
    if (error.code === '02000' && error.message.includes('leech_drill_session_not_found')) {
      throw new AppError(404, 'Drill session not found', { code: 'LEECH_DRILL_SESSION_NOT_FOUND' })
    }
    log.error({ sessionId, err: { message: error.message, code: error.code } }, 'getDrillSession RPC failed')
    throw dbError('fetch drill session', error)
  }

  return DrillSessionDetailResponseSchema.parse(data)
}

// ─── Drill attempts (Stage 5) ─────────────────────────────────────────────────
//
// `POST /api/v1/leeches/drill-sessions/:sessionId/attempts` records an
// immutable per-answer event. The DB's `UNIQUE (user_id, event_id)` on
// `leech_drill_attempts` makes eventId the structural idempotency identifier;
// the RPC uses `INSERT ... ON CONFLICT DO NOTHING` + replay-fetch so retrying
// with the same eventId returns the original row instead of creating a
// duplicate.
//
// The wire's `cardId`/`leechId` (when present) are downgraded to consistency
// assertions against the canonical session-card row — mismatches RAISE 22000
// with one of two specific message fragments, which the service translates
// to HTTP 422 `LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH`.

const DrillAttemptResponseSchema = z.object({
  attemptId:      z.string().uuid(),
  eventId:        z.string().uuid(),
  sessionId:      z.string().uuid(),
  sessionCardId:  z.string().uuid(),
  leechId:        z.string().uuid().nullable(),
  cardId:         z.string().uuid().nullable(),
  result:         z.enum(['missed', 'hesitated', 'remembered']),
  localSequence:  z.number().int().nonnegative().nullable(),
  responseTimeMs: z.number().int().nonnegative().nullable(),
  shownAt:        z.string().nullable(),
  answeredAt:     z.string(),
  createdAt:      z.string(),
})

/**
 * Records a drill attempt against the named session-card. Idempotent by
 * `eventId`: a retry with the same `(userId, eventId)` returns the original
 * row rather than minting a new one. The wire-side `cardId`/`leechId`, when
 * supplied, are validated against the canonical session-card values and a
 * mismatch raises 422 `LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH`.
 *
 * Throws:
 *   • 404 LEECH_DRILL_SESSION_CARD_NOT_FOUND — session-card row missing or
 *     not owned by the caller / not part of the requested session.
 *   • 422 LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH — body cardId or leechId
 *     disagrees with the canonical session-card values.
 *   • Other DB errors fall through to `dbError` (typically 500, or 409 for
 *     a 23503 FK violation on the rare card-deletion race).
 *
 * Scheduler invariance: the service does not import `fsrs.service.ts`, and
 * the RPC's body contains no UPDATE/DELETE/INSERT against `cards` or
 * `review_logs`. See the property-based test suite in this file's tests for
 * the structural assertion.
 */
export async function recordDrillAttempt(
  userId:    string,
  sessionId: string,
  input:     RecordDrillAttemptInput,
): Promise<ApiLeechDrillAttempt> {
  const { data, error } = await supabaseAdmin.rpc('record_leech_drill_attempt', asPayload({
    p_user_id:           userId,
    p_session_id:        sessionId,
    p_event_id:          input.eventId,
    p_session_card_id:   input.sessionCardId,
    p_asserted_card_id:  input.cardId         ?? null,
    p_asserted_leech_id: input.leechId        ?? null,
    p_result:            input.result,
    p_local_sequence:    input.localSequence  ?? null,
    p_response_time_ms:  input.responseTimeMs ?? null,
    p_shown_at:          input.shownAt        ?? null,
    p_answered_at:       input.answeredAt     ?? null,
  }))

  if (error !== null) {
    // 404: sessionCardId/sessionId/user triple mismatch.
    if (error.code === '02000' && error.message.includes('leech_drill_session_card_not_found')) {
      throw new AppError(404, 'Drill session card not found', {
        code: 'LEECH_DRILL_SESSION_CARD_NOT_FOUND',
      })
    }
    // 422: body cardId/leechId disagrees with canonical session-card values.
    // Two distinct RAISE message fragments share the same wire code because
    // the client only needs one bit of information: "your assertion was wrong."
    if (error.code === '22000' && (
      error.message.includes('leech_drill_attempt_card_mismatch') ||
      error.message.includes('leech_drill_attempt_leech_mismatch')
    )) {
      throw new AppError(422, 'Drill attempt body cardId/leechId does not match the session card', {
        code: 'LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH',
      })
    }
    log.error({ sessionId, eventId: input.eventId, err: { message: error.message, code: error.code } },
              'recordDrillAttempt RPC failed')
    throw dbError('record drill attempt', error)
  }

  return DrillAttemptResponseSchema.parse(data)
}
