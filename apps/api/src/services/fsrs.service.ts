import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  type FSRS as TsFsrsInstance,
  type Card as TsFsrsCard,
  type CardInput,
  type RecordLogItem,
  type ReviewLogInput,
  type FSRSHistory,
  type Grade,
  type State,
} from 'ts-fsrs'

import {
  isCardType,
  type CardType,
  type ReviewRating,
  type ApiReviewedCard,
  type ApiBatchResult,
  type SubmitReviewInput,
} from '@fsrs-japanese/shared-types'

import { supabaseAdmin } from '../db/supabase.ts'
import { env }           from '../lib/env.ts'
import { narrowRow, asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEECH_THRESHOLD = env.LEECH_THRESHOLD

// ─── Per-type FSRS instances ──────────────────────────────────────────────────
// Each card type gets its own FSRS instance baked with its request_retention.
// Do not share instances across types — params are fixed at construction.
//
// Retention targets are tuned to the cognitive load of each modality:
// - comprehension (0.90): passive recognition; high bar reflects ease of recall
// - production (0.84): active oral/written recall; harder, realistic lower target
// - listening (0.82): most cognitively demanding; lowest target balances difficulty
//
// These values are empirically validated against user forgetting curves.

const schedulers: Record<CardType, TsFsrsInstance> = {
  comprehension: fsrs(generatorParameters({ request_retention: 0.90 })),
  production:    fsrs(generatorParameters({ request_retention: 0.84 })),
  listening:     fsrs(generatorParameters({ request_retention: 0.82 })),
}

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * Shape returned by all FSRS write operations. Aliased to the wire-format
 * ApiReviewedCard so the service-layer return type and the `card` payload
 * embedded in /reviews/submit responses cannot drift.
 */
export type ProcessReviewResult = ApiReviewedCard

/** Rating preview for a single outcome — returned by previewNextStates(). */
export interface RatingPreview {
  due: Date
  scheduledDays: number
  stability: number
}

/** Default FSRS field values for a newly inserted card row. */
export interface FsrsInitialState {
  state: State
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Columns selected for every FSRS operation — keep in sync with FsrsCardRow below. */
const FSRS_SELECT_COLUMNS = [
  'id',
  'user_id',
  'card_type',
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
].join(', ')

/** Row shape returned by the SELECT above. */
interface FsrsCardRow {
  id: string
  user_id: string | null
  card_type: string
  state: State
  is_suspended: boolean
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  last_review: string | null
}

/** review_logs row shape — includes before-snapshot columns added in migration 20260502000001. */
interface ReviewLogRow {
  id: string
  card_id: string
  user_id: string
  rating: string
  review_time_ms: number | null
  stability_after: number
  difficulty_after: number
  due_after: string
  scheduled_days_after: number
  reviewed_at: string
  state_before: number | null
  stability_before: number | null
  difficulty_before: number | null
  due_before: string | null
  scheduled_days_before: number | null
  learning_steps_before: number | null
  elapsed_days_before: number | null
  last_review_before: string | null
  reps_before: number | null
  lapses_before: number | null
}

// Column projections for review_logs SELECTs. Avoid select('*') so payload
// scales with `ReviewLogRow` (the type) rather than the full row width.
const REVIEW_LOG_FULL_COLUMNS = [
  'id',
  'card_id',
  'user_id',
  'rating',
  'review_time_ms',
  'stability_after',
  'difficulty_after',
  'due_after',
  'scheduled_days_after',
  'reviewed_at',
  'state_before',
  'stability_before',
  'difficulty_before',
  'due_before',
  'scheduled_days_before',
  'learning_steps_before',
  'elapsed_days_before',
  'last_review_before',
  'reps_before',
  'lapses_before',
].join(', ')

/** Slim review_logs projection used by rescheduleFromHistory — only the two
 *  fields the FSRSHistory mapper consumes. ~10× payload reduction for cards
 *  with long review history. */
const REVIEW_LOG_HISTORY_COLUMNS = 'rating, reviewed_at'

interface ReviewLogHistoryRow {
  rating:      string
  reviewed_at: string
}

/** Convert a DB card row to the CardInput shape ts-fsrs expects. */
function buildFsrsCard(row: FsrsCardRow): CardInput {
  return {
    due:            new Date(row.due),
    stability:      row.stability,
    difficulty:     row.difficulty,
    elapsed_days:   row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps:           row.reps,
    lapses:         row.lapses,
    state:          row.state,
    // exactOptionalPropertyTypes: omit the key entirely when null so we don't
    // assign `undefined` to a property typed `DateInput | null`.
    ...(row.last_review !== null ? { last_review: new Date(row.last_review) } : {}),
  }
}

/** Map a user-facing ReviewRating string to the ts-fsrs Grade (excludes Manual). */
function mapRatingToGrade(rating: ReviewRating): Grade {
  switch (rating) {
    case 'again':  return Rating.Again
    case 'hard':   return Rating.Hard
    case 'good':   return Rating.Good
    case 'easy':   return Rating.Easy
    // 'manual' is never passed by users — Zod rejects it at submission. Map to
    // Good defensively so the schedule still moves forward if somehow reached.
    case 'manual': return Rating.Good
    default: {
      const _exhaustiveCheck: never = rating
      return _exhaustiveCheck
    }
  }
}

/** Map a rating string from review_logs (including 'manual') to the ts-fsrs Rating enum. */
function mapRatingStringToEnum(rating: string): Rating {
  switch (rating) {
    case 'again': return Rating.Again
    case 'hard':  return Rating.Hard
    case 'good':  return Rating.Good
    case 'easy':  return Rating.Easy
    default:      return Rating.Manual
  }
}

function getScheduler(cardType: string): TsFsrsInstance {
  return isCardType(cardType) ? schedulers[cardType] : schedulers.comprehension
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Processes a single review rating and updates the card's FSRS scheduling state.
 *
 * This is the **only** function that writes FSRS state fields to `cards`.
 * Card update, review log, and leech detection are executed inside a single
 * PostgreSQL transaction via the `process_review` RPC.
 */
export async function processReview(
  cardId:       string,
  rating:       ReviewRating,
  userId:       string,
  reviewTimeMs?: number,
  sessionId?:   string,
): Promise<ProcessReviewResult> {
  // ── 1. Fetch card — filter by user_id to exclude premade source cards ────────
  const { data, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select(FSRS_SELECT_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null) {
    throw dbError('fetch card', fetchError)
  }
  if (data === null) {
    throw new AppError(404, 'Card not found')
  }

  const row = narrowRow<FsrsCardRow>(data)

  if (row.user_id === null) {
    throw new AppError(403, 'Cannot review a premade source card')
  }

  if (row.is_suspended) {
    throw new AppError(409, 'Card is suspended; unsuspend it before reviewing')
  }

  // ── 2. Schedule via ts-fsrs ────────────────────────────────────────────────
  const scheduler = getScheduler(row.card_type)
  const grade = mapRatingToGrade(rating)
  const reviewedAt = new Date()
  const { card: updated }: RecordLogItem = scheduler.next(buildFsrsCard(row), reviewedAt, grade)

  // ── 3. Atomically persist FSRS state, review log, and leech detection ─────
  // Args cast: nullable RPC params (p_review_time_ms, p_last_review_before,
  // p_session_id) are typed as non-nullable in the generated Database type
  // because the migration declares them without DEFAULT NULL. The DB accepts
  // NULL at runtime; supabase-js sends NULL correctly.
  const { error: rpcError } = await supabaseAdmin.rpc('process_review', asPayload({
    p_card_id:              cardId,
    p_user_id:              userId,
    p_state:                updated.state,
    p_due:                  updated.due.toISOString(),
    p_stability:            updated.stability,
    p_difficulty:           updated.difficulty,
    p_elapsed_days:         updated.elapsed_days,
    p_scheduled_days:       updated.scheduled_days,
    p_learning_steps:       updated.learning_steps,
    p_reps:                 updated.reps,
    p_lapses:               updated.lapses,
    p_last_review:          reviewedAt.toISOString(),
    p_updated_at:           reviewedAt.toISOString(),
    p_rating:               rating,
    p_review_time_ms:       reviewTimeMs ?? null,
    p_stability_after:      updated.stability,
    p_difficulty_after:     updated.difficulty,
    p_due_after:            updated.due.toISOString(),
    p_scheduled_days_after: updated.scheduled_days,
    p_leech_threshold:      LEECH_THRESHOLD,
    // Before-snapshot — enables rollback via rollbackReview().
    p_state_before:          row.state,
    p_stability_before:      row.stability,
    p_difficulty_before:     row.difficulty,
    p_due_before:            row.due,
    p_scheduled_days_before: row.scheduled_days,
    p_learning_steps_before: row.learning_steps,
    p_elapsed_days_before:   row.elapsed_days,
    p_last_review_before:    row.last_review ?? null,
    p_reps_before:           row.reps,
    p_lapses_before:         row.lapses,
    p_session_id:            sessionId ?? null,
  }))

  if (rpcError !== null) {
    throw dbError('persist review', rpcError)
  }

  return {
    id:            cardId,
    due:           updated.due.toISOString(),
    stability:     updated.stability,
    difficulty:    updated.difficulty,
    scheduledDays: updated.scheduled_days,
    state:         updated.state,
  }
}

/**
 * Processes a batch of reviews in a single round-trip via the
 * `process_review_batch` RPC. Pre-fetches all target cards in one query,
 * runs ts-fsrs scheduling per review in JS, then submits all post-schedule
 * states + before-snapshots as one JSONB payload.
 *
 * Per-review failures are caught inside the RPC's per-iteration EXCEPTION
 * block and surfaced via the `errors` array, preserving the contract of
 * the previous serial implementation. Pre-RPC validation failures (missing
 * card, suspended card) skip the RPC entry and go straight to `errors`.
 */
export async function processReviewBatch(
  reviews: SubmitReviewInput[],
  userId:  string,
): Promise<ApiBatchResult<ProcessReviewResult>> {
  if (reviews.length === 0) {
    return { results: [], errors: [] }
  }

  const cardIds = reviews.map((r) => r.cardId)

  const { data: cardData, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select(FSRS_SELECT_COLUMNS)
    .in('id', cardIds)
    .eq('user_id', userId)

  if (fetchError !== null) {
    throw dbError('fetch cards for batch review', fetchError)
  }

  const cardMap = new Map<string, FsrsCardRow>(
    (cardData ?? []).map((row) => {
      const r = narrowRow<FsrsCardRow>(row)
      return [r.id, r]
    }),
  )

  // RPC payload row mirrors the per-review fields process_review takes,
  // packed flat per the JSONB shape declared in the migration.
  interface BatchRpcRow {
    card_id:                 string
    rating:                  ReviewRating
    review_time_ms:          number | null
    session_id:              string | null
    p_state:                 number
    p_due:                   string
    p_stability:             number
    p_difficulty:            number
    p_elapsed_days:          number
    p_scheduled_days:        number
    p_learning_steps:        number
    p_reps:                  number
    p_lapses:                number
    p_last_review:           string
    p_state_before:          number
    p_stability_before:      number
    p_difficulty_before:     number
    p_due_before:            string
    p_scheduled_days_before: number
    p_learning_steps_before: number
    p_elapsed_days_before:   number
    p_last_review_before:    string | null
    p_reps_before:           number
    p_lapses_before:         number
  }

  const batch:  BatchRpcRow[]                              = []
  const errors: Array<{ cardId: string; error: string }>   = []

  for (const review of reviews) {
    const row = cardMap.get(review.cardId)
    if (row === undefined) {
      errors.push({ cardId: review.cardId, error: 'Card not found' })
      continue
    }
    if (row.user_id === null) {
      errors.push({ cardId: review.cardId, error: 'Cannot review a premade source card' })
      continue
    }
    if (row.is_suspended) {
      errors.push({ cardId: review.cardId, error: 'Card is suspended; unsuspend it before reviewing' })
      continue
    }

    const scheduler              = getScheduler(row.card_type)
    const grade                  = mapRatingToGrade(review.rating)
    const reviewedAt             = new Date()
    const { card: updated }: RecordLogItem = scheduler.next(buildFsrsCard(row), reviewedAt, grade)

    batch.push({
      card_id:                 review.cardId,
      rating:                  review.rating,
      review_time_ms:          review.reviewTimeMs ?? null,
      session_id:              review.sessionId ?? null,
      p_state:                 updated.state,
      p_due:                   updated.due.toISOString(),
      p_stability:             updated.stability,
      p_difficulty:            updated.difficulty,
      p_elapsed_days:          updated.elapsed_days,
      p_scheduled_days:        updated.scheduled_days,
      p_learning_steps:        updated.learning_steps,
      p_reps:                  updated.reps,
      p_lapses:                updated.lapses,
      p_last_review:           reviewedAt.toISOString(),
      p_state_before:          row.state,
      p_stability_before:      row.stability,
      p_difficulty_before:     row.difficulty,
      p_due_before:            row.due,
      p_scheduled_days_before: row.scheduled_days,
      p_learning_steps_before: row.learning_steps,
      p_elapsed_days_before:   row.elapsed_days,
      p_last_review_before:    row.last_review ?? null,
      p_reps_before:           row.reps,
      p_lapses_before:         row.lapses,
    })
  }

  const results: ProcessReviewResult[] = []

  if (batch.length > 0) {
    interface BatchResultRow {
      card_id:        string
      success:        boolean
      error_message:  string | null
      due:            string | null
      stability:      number | null
      difficulty:     number | null
      scheduled_days: number | null
      state:          number | null
    }

    // Function name cast: database.types.ts is auto-generated and won't include
    // process_review_batch until `supabase gen types` runs post-deploy.
    const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc(
      'process_review_batch' as never,
      asPayload({
        p_user_id:         userId,
        p_reviews:         batch,
        p_leech_threshold: LEECH_THRESHOLD,
      }),
    )

    if (rpcError !== null) {
      throw dbError('persist review batch', rpcError)
    }

    for (const raw of (rpcData ?? []) as BatchResultRow[]) {
      const r = narrowRow<BatchResultRow>(raw)
      if (r.success && r.due !== null && r.stability !== null && r.difficulty !== null
          && r.scheduled_days !== null && r.state !== null) {
        results.push({
          id:            r.card_id,
          due:           r.due,
          stability:     r.stability,
          difficulty:    r.difficulty,
          scheduledDays: r.scheduled_days,
          state:         r.state,
        })
      } else {
        errors.push({
          cardId: r.card_id,
          error:  r.error_message ?? 'Unknown error',
        })
      }
    }
  }

  return { results, errors }
}

/**
 * Undoes a specific review log entry and restores the card to its pre-review state.
 *
 * Requires non-null before-snapshot fields on the log. Logs written before
 * migration 20260502000001 have null snapshots and return 409.
 * The log entry itself is preserved as an immutable audit trail — only the
 * card row is updated.
 */
export async function rollbackReview(
  cardId: string,
  userId: string,
  reviewLogId: string,
): Promise<ProcessReviewResult> {
  const [cardResult, logResult] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select(FSRS_SELECT_COLUMNS)
      .eq('id', cardId)
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('review_logs')
      .select(REVIEW_LOG_FULL_COLUMNS)
      .eq('id', reviewLogId)
      .eq('card_id', cardId)
      .eq('user_id', userId)
      .single(),
  ])

  if (cardResult.error !== null || cardResult.data === null) {
    throw new AppError(404, 'Card not found')
  }
  if (logResult.error !== null || logResult.data === null) {
    throw new AppError(404, 'Review log not found')
  }

  const row = narrowRow<FsrsCardRow>(cardResult.data)
  const log = narrowRow<ReviewLogRow>(logResult.data)

  if (
    log.state_before      === null ||
    log.due_before        === null ||
    log.stability_before  === null ||
    log.difficulty_before === null
  ) {
    throw new AppError(409, 'This review cannot be rolled back')
  }

  // The four _before fields above are written atomically — narrowed together by the guard.
  const reviewLogInput: ReviewLogInput = {
    rating:            mapRatingStringToEnum(log.rating),
    state:             log.state_before as State,
    due:               new Date(log.due_before),
    stability:         log.stability_before,
    difficulty:        log.difficulty_before,
    elapsed_days:      log.elapsed_days_before ?? 0,
    last_elapsed_days: 0, // not stored; deprecated ts-fsrs field
    scheduled_days:    log.scheduled_days_before ?? 0,
    learning_steps:    log.learning_steps_before ?? 0,
    review:            new Date(log.reviewed_at),
  }

  const scheduler = getScheduler(row.card_type)
  const restored: TsFsrsCard = scheduler.rollback(buildFsrsCard(row), reviewLogInput)
  const now = new Date()

  const { error: updateError } = await supabaseAdmin
    .from('cards')
    .update({
      state:          restored.state,
      due:            restored.due.toISOString(),
      stability:      restored.stability,
      difficulty:     restored.difficulty,
      elapsed_days:   restored.elapsed_days,
      scheduled_days: restored.scheduled_days,
      learning_steps: restored.learning_steps,
      reps:           restored.reps,
      lapses:         restored.lapses,
      last_review:    restored.last_review?.toISOString() ?? null,
      updated_at:     now.toISOString(),
    })
    .eq('id', cardId)
    .eq('user_id', userId)

  if (updateError !== null) {
    throw dbError('rollback card', updateError)
  }

  return {
    id:            cardId,
    due:           restored.due.toISOString(),
    stability:     restored.stability,
    difficulty:    restored.difficulty,
    scheduledDays: restored.scheduled_days,
    state:         restored.state,
  }
}

/**
 * Resets a card to New state (Anki "Forget").
 *
 * Atomically resets the card and writes a 'manual' review log via the
 * process_forget RPC. The before-snapshot is always written so the forget
 * itself can be rolled back.
 *
 * @param resetCount - When true, zeroes reps + lapses. Default false (preserves history).
 */
export async function forgetCard(
  cardId: string,
  userId: string,
  resetCount = false,
): Promise<ProcessReviewResult> {
  const { data, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select(FSRS_SELECT_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, 'Card not found')
  }

  const row = narrowRow<FsrsCardRow>(data)

  if (row.user_id === null) {
    throw new AppError(403, 'Cannot reset a premade source card')
  }

  const scheduler = getScheduler(row.card_type)
  const now = new Date()
  const { card: forgotten }: RecordLogItem = scheduler.forget(buildFsrsCard(row), now, resetCount)

  // Args wrapped via asPayload: see process_review note above.
  const { error: rpcError } = await supabaseAdmin.rpc('process_forget', asPayload({
    p_card_id:              cardId,
    p_user_id:              userId,
    p_due:                  forgotten.due.toISOString(),
    p_stability:            forgotten.stability,
    p_difficulty:           forgotten.difficulty,
    p_scheduled_days:       forgotten.scheduled_days,
    p_reps:                 forgotten.reps,
    p_lapses:               forgotten.lapses,
    p_updated_at:           now.toISOString(),
    p_state_before:          row.state,
    p_stability_before:      row.stability,
    p_difficulty_before:     row.difficulty,
    p_due_before:            row.due,
    p_scheduled_days_before: row.scheduled_days,
    p_learning_steps_before: row.learning_steps,
    p_elapsed_days_before:   row.elapsed_days,
    p_last_review_before:    row.last_review ?? null,
    p_reps_before:           row.reps,
    p_lapses_before:         row.lapses,
  }))

  if (rpcError !== null) {
    throw dbError('forget card', rpcError)
  }

  return {
    id:            cardId,
    due:           forgotten.due.toISOString(),
    stability:     forgotten.stability,
    difficulty:    forgotten.difficulty,
    scheduledDays: forgotten.scheduled_days,
    state:         forgotten.state,
  }
}

/**
 * Returns the current recall probability for a card (0–1).
 * Pure math — no DB read or write. The forgetting_curve is the same for all
 * card types (it does not depend on request_retention, only on elapsed time
 * and stability), so any scheduler instance's method can be used.
 */
export function getRetrievability(stability: number, elapsedDays: number): number {
  return schedulers.comprehension.forgetting_curve(elapsedDays, stability)
}

/**
 * Returns all 4 rating outcomes without writing to DB (for UI preview).
 *
 * This is the ONLY valid call site for scheduler.repeat(). Do not call
 * repeat() anywhere else — use scheduler.next() for actual reviews.
 */
export function previewNextStates(
  row: FsrsCardRow,
  cardType: CardType,
  now?: Date,
): Record<'again' | 'hard' | 'good' | 'easy', RatingPreview> {
  const scheduler = schedulers[cardType] ?? schedulers.comprehension
  const preview = scheduler.repeat(buildFsrsCard(row), now ?? new Date())

  return {
    again: { due: preview[Rating.Again].card.due, scheduledDays: preview[Rating.Again].card.scheduled_days, stability: preview[Rating.Again].card.stability },
    hard:  { due: preview[Rating.Hard].card.due,  scheduledDays: preview[Rating.Hard].card.scheduled_days,  stability: preview[Rating.Hard].card.stability },
    good:  { due: preview[Rating.Good].card.due,  scheduledDays: preview[Rating.Good].card.scheduled_days,  stability: preview[Rating.Good].card.stability },
    easy:  { due: preview[Rating.Easy].card.due,  scheduledDays: preview[Rating.Easy].card.scheduled_days,  stability: preview[Rating.Easy].card.stability },
  }
}

/**
 * Replays the card's full review history to recompute the schedule.
 * Use this after changing FSRS weights (e.g. after running computeParameters()).
 *
 * Only review_logs with non-null state_before are included (post-migration entries).
 * 'manual' rating entries (forget / reschedule ops) are excluded from the history
 * replay since FSRSHistory only accepts user-facing grades.
 *
 * Persists the result via process_review RPC with rating='manual'.
 */
export async function rescheduleFromHistory(
  cardId: string,
  userId: string,
): Promise<ProcessReviewResult> {
  const [cardResult, logsResult] = await Promise.all([
    supabaseAdmin
      .from('cards')
      .select(FSRS_SELECT_COLUMNS)
      .eq('id', cardId)
      .eq('user_id', userId)
      .single(),
    supabaseAdmin
      .from('review_logs')
      .select(REVIEW_LOG_HISTORY_COLUMNS)
      .eq('card_id', cardId)
      .eq('user_id', userId)
      .neq('rating', 'manual')
      .not('state_before', 'is', null)
      .order('reviewed_at', { ascending: true }),
  ])

  if (cardResult.error !== null || cardResult.data === null) {
    throw new AppError(404, 'Card not found')
  }
  if (logsResult.error !== null) {
    throw dbError('fetch review logs', logsResult.error)
  }

  const row = narrowRow<FsrsCardRow>(cardResult.data)
  const logs = narrowRow<ReviewLogHistoryRow[]>(logsResult.data ?? [])

  if (logs.length === 0) {
    throw new AppError(409, 'No eligible review logs to reschedule from')
  }

  // FSRSHistory.rating excludes Rating.Manual; the SELECT above filters
  // .neq('rating', 'manual'), so mapRatingStringToEnum never returns Manual here.
  const history: FSRSHistory[] = logs.map((log) => ({
    rating: mapRatingStringToEnum(log.rating) as Grade,
    review: new Date(log.reviewed_at),
  }))

  const scheduler = getScheduler(row.card_type)
  const emptyCard = createEmptyCard()
  const result = scheduler.reschedule(emptyCard, history)

  if (result.reschedule_item === null) {
    throw new AppError(409, 'Reschedule produced no result')
  }

  const updated: TsFsrsCard = result.reschedule_item.card
  const now = new Date()

  const { error: rpcError } = await supabaseAdmin.rpc('process_review', asPayload({
    p_card_id:              cardId,
    p_user_id:              userId,
    p_state:                updated.state,
    p_due:                  updated.due.toISOString(),
    p_stability:            updated.stability,
    p_difficulty:           updated.difficulty,
    p_elapsed_days:         updated.elapsed_days,
    p_scheduled_days:       updated.scheduled_days,
    p_learning_steps:       updated.learning_steps,
    p_reps:                 updated.reps,
    p_lapses:               updated.lapses,
    p_last_review:          updated.last_review?.toISOString() ?? now.toISOString(),
    p_updated_at:           now.toISOString(),
    p_rating:               'manual',
    p_review_time_ms:       null,
    p_stability_after:      updated.stability,
    p_difficulty_after:     updated.difficulty,
    p_due_after:            updated.due.toISOString(),
    p_scheduled_days_after: updated.scheduled_days,
    p_leech_threshold:      LEECH_THRESHOLD,
    p_state_before:          row.state,
    p_stability_before:      row.stability,
    p_difficulty_before:     row.difficulty,
    p_due_before:            row.due,
    p_scheduled_days_before: row.scheduled_days,
    p_learning_steps_before: row.learning_steps,
    p_elapsed_days_before:   row.elapsed_days,
    p_last_review_before:    row.last_review ?? null,
    p_reps_before:           row.reps,
    p_lapses_before:         row.lapses,
  }))

  if (rpcError !== null) {
    throw dbError('reschedule card', rpcError)
  }

  return {
    id:            cardId,
    due:           updated.due.toISOString(),
    stability:     updated.stability,
    difficulty:    updated.difficulty,
    scheduledDays: updated.scheduled_days,
    state:         updated.state,
  }
}

/**
 * Returns the default FSRS field values for a newly inserted card row.
 * Call this when creating a card to get a consistent initial scheduling state.
 */
export function getInitialFsrsState(): FsrsInitialState {
  const empty = createEmptyCard()
  return {
    state:          empty.state,
    due:            empty.due.toISOString(),
    stability:      empty.stability,
    difficulty:     empty.difficulty,
    elapsed_days:   empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    learning_steps: empty.learning_steps,
    reps:           empty.reps,
    lapses:         empty.lapses,
    last_review:    null,
  }
}
