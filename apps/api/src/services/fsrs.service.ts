/**
 * FSRS scheduling service.
 *
 * Sole owner of FSRS state writes on the `cards` table. All other code that
 * needs to advance a card's schedule must go through this module.
 *
 * Runtime dependencies beyond the initial migration:
 *   - `review_logs` table  (next migration)
 *   - `leeches` table      (next migration)
 */

import { createEmptyCard, fsrs, generatorParameters, Rating, State } from 'ts-fsrs'
import type { Card as TsFsrsCard, Grade, FSRS as TsFsrsInstance } from 'ts-fsrs'

import { CardStatus } from '@fsrs-japanese/shared-types'
import type { CardType, ReviewRating } from '@fsrs-japanese/shared-types'

import { supabaseAdmin } from '../db/supabase.ts'
import { AppError } from '../middleware/errorHandler.ts'

// ─── Constants ────────────────────────────────────────────────────────────────

const LEECH_THRESHOLD = Number.parseInt(process.env['LEECH_THRESHOLD'] ?? '8', 10)

// ─── Per-type scheduler instances ────────────────────────────────────────────

/**
 * One FSRS scheduler per card type, initialised at module load.
 *
 * Each modality has a distinct `request_retention` target because recognition,
 * production, reading, and audio cards exhibit measurably different forgetting
 * curves in Japanese learners. Do not consolidate into one instance.
 */
const schedulers: Record<CardType, TsFsrsInstance> = {
  recognition: fsrs(generatorParameters({ request_retention: 0.90 })),
  production:  fsrs(generatorParameters({ request_retention: 0.85 })),
  reading:     fsrs(generatorParameters({ request_retention: 0.88 })),
  audio:       fsrs(generatorParameters({ request_retention: 0.82 })),
  grammar:     fsrs(generatorParameters({ request_retention: 0.87 })),
}

// ─── Public types ─────────────────────────────────────────────────────────────

/** Shape returned by processReview — contains all fields needed for the API response. */
export interface ProcessReviewResult {
  id: string
  due: Date
  stability: number
  difficulty: number
  scheduledDays: number
  state: number
  status: CardStatus
}

/** Default FSRS field values for a newly inserted card row. */
export interface FsrsInitialState {
  status: CardStatus
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Columns selected for every FSRS operation — keep in sync with CardRow below. */
const FSRS_SELECT_COLUMNS = [
  'id',
  'user_id',
  'card_type',
  'status',
  'due',
  'stability',
  'difficulty',
  'elapsed_days',
  'scheduled_days',
  'learning_steps',
  'reps',
  'lapses',
  'state',
  'last_review',
].join(', ')

/** Row shape returned by the SELECT above. */
interface CardRow {
  id: string
  user_id: string | null
  card_type: string
  status: string
  due: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  state: number
  last_review: string | null
}

function mapStateToStatus(state: State): CardStatus {
  switch (state) {
    case State.New:        return CardStatus.New
    case State.Learning:   return CardStatus.Learning
    case State.Review:     return CardStatus.Review
    case State.Relearning: return CardStatus.Relearning
    default: {
      // `State` is a numeric enum; this branch is unreachable at runtime.
      const _exhaustive: never = state
      void _exhaustive
      return CardStatus.New
    }
  }
}

function mapRatingToGrade(rating: ReviewRating): Grade {
  switch (rating) {
    case 'again': return Rating.Again
    case 'hard':  return Rating.Hard
    case 'good':  return Rating.Good
    case 'easy':  return Rating.Easy
  }
}

/**
 * Converts a DB card row into the shape ts-fsrs expects.
 * Uses conditional spreading for `last_review` to satisfy exactOptionalPropertyTypes.
 */
function buildFsrsCard(row: CardRow): TsFsrsCard {
  return {
    due:            new Date(row.due),
    stability:      row.stability,
    difficulty:     row.difficulty,
    elapsed_days:   row.elapsed_days,
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps:           row.reps,
    lapses:         row.lapses,
    state:          row.state as State,
    ...(row.last_review !== null ? { last_review: new Date(row.last_review) } : {}),
  }
}

// ─── Leech detection ──────────────────────────────────────────────────────────

/**
 * Checks whether a card has crossed the leech threshold after a review and
 * creates a leech record if no unresolved one already exists.
 *
 * Must only be called from processReview. Duplicating this check anywhere
 * else produces duplicate leech records (see CLAUDE.md common pitfalls).
 *
 * The AI diagnosis/prescription fields are populated later by ai.service.ts
 * when the route handler processes the leech event.
 */
async function checkLeech(cardId: string, userId: string, lapses: number): Promise<void> {
  if (lapses < LEECH_THRESHOLD) return

  const { data: existing } = await supabaseAdmin
    .from('leeches')
    .select('id')
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .eq('resolved', false)
    .maybeSingle()

  if (existing !== null) return

  const { error: insertError } = await supabaseAdmin
    .from('leeches')
    .insert({ card_id: cardId, user_id: userId })

  if (insertError !== null) {
    console.error(`[FSRS] Failed to create leech record for card ${cardId}:`, insertError.message)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Processes a single review rating and updates the card's FSRS scheduling state.
 *
 * This is the **only** function that writes FSRS state fields to `cards`.
 * It also writes a review log entry and performs leech detection.
 * Do not call f.repeat() / f.next() anywhere else in the codebase.
 *
 * @param cardId      - UUID of the card being reviewed
 * @param rating      - User's rating for this review
 * @param userId      - Authenticated user's ID (proves ownership; excludes premade source cards)
 * @param reviewTimeMs - Optional time spent on card in milliseconds
 * @returns Updated scheduling fields — sufficient to build the API response
 */
export async function processReview(
  cardId: string,
  rating: ReviewRating,
  userId: string,
  reviewTimeMs?: number,
): Promise<ProcessReviewResult> {
  // ── 1. Fetch card — filter by user_id to exclude premade source cards ────────
  const { data, error: fetchError } = await supabaseAdmin
    .from('cards')
    .select(FSRS_SELECT_COLUMNS)
    .eq('id', cardId)
    .eq('user_id', userId)
    .single()

  if (fetchError !== null || data === null) {
    throw new AppError(404, `Card ${cardId} not found or does not belong to user`)
  }

  const row = data as unknown as CardRow

  // Defensive guard — the WHERE clause already prevents this, but it must
  // never silently succeed even if that filter were accidentally dropped.
  if (row.user_id === null) {
    throw new AppError(403, `Refusing to apply FSRS to premade source card ${cardId}`)
  }

  if (row.status === CardStatus.Suspended) {
    throw new Error(`Card ${cardId} is suspended; unsuspend it before reviewing`)
  }

  // ── 2. Select scheduler for this card's modality ─────────────────────────────
  const scheduler = schedulers[row.card_type as CardType] ?? schedulers.recognition

  // ── 3. Advance the FSRS state ─────────────────────────────────────────────────
  // Call next() exactly once per review. It computes only the chosen rating,
  // avoiding the wasted work of repeat() which computes all four outcomes.
  // CLAUDE.md: "Do not call f.repeat() more than once per review."
  const grade = mapRatingToGrade(rating)
  const reviewedAt = new Date()
  const { card: updated } = scheduler.next(buildFsrsCard(row), reviewedAt, grade)
  const newStatus = mapStateToStatus(updated.state)

  // ── 4. Persist FSRS state ────────────────────────────────────────────────────
  const { error: updateError } = await supabaseAdmin
    .from('cards')
    .update({
      status:         newStatus,
      due:            updated.due.toISOString(),
      stability:      updated.stability,
      difficulty:     updated.difficulty,
      elapsed_days:   updated.elapsed_days,
      scheduled_days: updated.scheduled_days,
      learning_steps: updated.learning_steps,
      reps:           updated.reps,
      lapses:         updated.lapses,
      state:          updated.state,
      last_review:    (updated.last_review ?? reviewedAt).toISOString(),
      updated_at:     reviewedAt.toISOString(),
    })
    .eq('id', cardId)

  if (updateError !== null) {
    throw new Error(`Failed to persist FSRS state for card ${cardId}: ${updateError.message}`)
  }

  // ── 5. Write review log ───────────────────────────────────────────────────────
  // Requires the review_logs table (next migration after initial_schema).
  const { error: logError } = await supabaseAdmin
    .from('review_logs')
    .insert({
      card_id:              cardId,
      user_id:              userId,
      rating,
      review_time_ms:       reviewTimeMs ?? null,
      stability_after:      updated.stability,
      difficulty_after:     updated.difficulty,
      due_after:            updated.due.toISOString(),
      scheduled_days_after: updated.scheduled_days,
    })

  if (logError !== null) {
    throw new Error(`Failed to write review log for card ${cardId}: ${logError.message}`)
  }

  // ── 6. Leech detection ────────────────────────────────────────────────────────
  // Runs here and only here. Adding leech checks elsewhere creates duplicates.
  // Requires the leeches table (next migration after initial_schema).
  await checkLeech(cardId, userId, updated.lapses)

  return {
    id:            cardId,
    due:           updated.due,
    stability:     updated.stability,
    difficulty:    updated.difficulty,
    scheduledDays: updated.scheduled_days,
    state:         updated.state,
    status:        newStatus,
  }
}

/**
 * Returns the default FSRS field values for a newly inserted card row.
 * Call this when creating a card to get a consistent initial scheduling state.
 */
export function getInitialFsrsState(): FsrsInitialState {
  const empty = createEmptyCard()
  return {
    status:         CardStatus.New,
    due:            empty.due.toISOString(),
    stability:      empty.stability,
    difficulty:     empty.difficulty,
    elapsed_days:   empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    learning_steps: empty.learning_steps,
    reps:           empty.reps,
    lapses:         empty.lapses,
    state:          empty.state,
    last_review:    null,
  }
}
