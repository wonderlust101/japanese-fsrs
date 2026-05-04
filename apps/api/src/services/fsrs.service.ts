import {
  fsrs,
  generatorParameters,
  createEmptyCard,
  Rating,
  State,
  type FSRS as TsFsrsInstance,
  type Card as TsFsrsCard,
  type CardInput,
  type RecordLogItem,
  type ReviewLogInput,
  type FSRSHistory,
  type Grade,
} from 'ts-fsrs'

import type { CardType, ReviewRating } from '@fsrs-japanese/shared-types'

import { supabaseAdmin } from '../db/supabase.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEECH_THRESHOLD = Number.parseInt(process.env['LEECH_THRESHOLD'] ?? '8', 10)

// ─── Per-type FSRS instances ──────────────────────────────────────────────────
// Each card type gets its own FSRS instance baked with its request_retention.
// Do not share instances across types — params are fixed at construction.

const schedulers: Record<CardType, TsFsrsInstance> = {
  comprehension: fsrs(generatorParameters({ request_retention: 0.90 })),
  production:    fsrs(generatorParameters({ request_retention: 0.84 })),
  listening:     fsrs(generatorParameters({ request_retention: 0.82 })),
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** Shape returned by all FSRS write operations — contains fields needed for API response. */
export interface ProcessReviewResult {
  id: string
  due: Date
  stability: number
  difficulty: number
  scheduledDays: number
  state: State
}

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
    case 'again': return Rating.Again
    case 'hard':  return Rating.Hard
    case 'good':  return Rating.Good
    case 'easy':  return Rating.Easy
    // 'manual' is never passed by users; the Zod layer rejects it at submission.
    default:      return Rating.Good
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
  return schedulers[cardType as CardType] ?? schedulers.comprehension
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

  const row = data as unknown as FsrsCardRow

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
  const { error: rpcError } = await supabaseAdmin.rpc('process_review', {
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
  })

  if (rpcError !== null) {
    throw dbError('persist review', rpcError)
  }

  return {
    id:            cardId,
    due:           updated.due,
    stability:     updated.stability,
    difficulty:    updated.difficulty,
    scheduledDays: updated.scheduled_days,
    state:         updated.state,
  }
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
      .select('*')
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

  const row = cardResult.data as unknown as FsrsCardRow
  const log = logResult.data as unknown as ReviewLogRow

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
    rating:            log.rating as unknown as Rating,
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
    due:           restored.due,
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

  const row = data as unknown as FsrsCardRow

  if (row.user_id === null) {
    throw new AppError(403, 'Cannot reset a premade source card')
  }

  const scheduler = getScheduler(row.card_type)
  const now = new Date()
  const { card: forgotten }: RecordLogItem = scheduler.forget(buildFsrsCard(row), now, resetCount)

  const { error: rpcError } = await supabaseAdmin.rpc('process_forget', {
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
  })

  if (rpcError !== null) {
    throw dbError('forget card', rpcError)
  }

  return {
    id:            cardId,
    due:           forgotten.due,
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
      .select('*')
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

  const row = cardResult.data as unknown as FsrsCardRow
  const logs = (logsResult.data ?? []) as unknown as ReviewLogRow[]

  if (logs.length === 0) {
    throw new AppError(409, 'No eligible review logs to reschedule from')
  }

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

  const { error: rpcError } = await supabaseAdmin.rpc('process_review', {
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
  })

  if (rpcError !== null) {
    throw dbError('reschedule card', rpcError)
  }

  return {
    id:            cardId,
    due:           updated.due,
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
