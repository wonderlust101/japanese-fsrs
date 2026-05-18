import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import {
  layoutTypeEnum,
  jlptLevelEnum,
  ApiCardQualityIssueTypeSchema,
  type ApiList,
  type ApiProblemCard,
  type ApiProblemCardBucketSchema,
  type ApiCardQualityIssue,
  type ApiMaturitySnapshot,
  type ApiMaturityHistoryDaysSchema,
  type ApiConfusablePair,
  type FieldsData,
} from '@fsrs-japanese/shared-types'

type MaturityHistoryDays = z.infer<typeof ApiMaturityHistoryDaysSchema>

type ProblemCardBucket = z.infer<typeof ApiProblemCardBucketSchema>

// ─── RPC envelope ────────────────────────────────────────────────────────────
//
// Mirrors the analytics / review / deck precedent: parse the RPC result so
// any future signature drift surfaces as a clean ZodError. The RPC body
// projects `cards.fields_data` as JSONB; the wire-format consumer narrows
// via the existing `getWordFields` / `getVocabularyFields` helpers.

const ProblemCardRpcRowSchema = z.object({
  card_id:     z.string().uuid(),
  deck_id:     z.string().uuid().nullable(),
  layout_type: layoutTypeEnum,
  jlpt_level:  jlptLevelEnum.nullable(),
  fields_data: z.record(z.string(), z.unknown()),
  state:       z.number().int().nonnegative(),
  lapses:      z.number().int().nonnegative(),
  reps:        z.number().int().nonnegative(),
  due:         z.string(),
  last_review: z.string().nullable(),
})

type ProblemCardDbRow = z.infer<typeof ProblemCardRpcRowSchema>

function toProblemCard(raw: ProblemCardDbRow): ApiProblemCard {
  return {
    cardId:     raw.card_id,
    deckId:     raw.deck_id,
    layoutType: raw.layout_type,
    jlptLevel:  raw.jlpt_level,
    // The DB enforces fields_data shape via cards_fields_data_shape CHECK;
    // the cast moves the discriminated-union narrowing to the consumer
    // (same pattern as card.service.ts toCardRow / toApiDueCard).
    fieldsData: raw.fields_data as FieldsData,
    state:      raw.state,
    lapses:     raw.lapses,
    reps:       raw.reps,
    due:        raw.due,
    lastReview: raw.last_review,
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Backend Completion Plan Stage 7. Returns the user's cards that fall into
 * the given lapse bucket, ordered by `last_review DESC NULLS LAST, id DESC`.
 * Backed by the `get_problem_cards(p_user_id, p_bucket)` RPC.
 *
 * Bucket values are: `'2-3'`, `'4-5'`, `'6-7'`, `'8plus'`. Suspended cards
 * are excluded. Bounded by the user's card count; the response envelope
 * uses `nextCursor: null` / `hasMore: false` per the universal list
 * convention because the bucket sizes are small enough at typical scale
 * that pagination would be overkill (a user with 200+ lapse-2 cards is
 * an outlier; the front-end can virtualize the list if needed).
 *
 * The `[8plus]` bucket cardinality equals the unresolved-weakSpot count for
 * the same user — process_review inserts a weakSpot at `lapses >=
 * WEAK_SPOT_THRESHOLD` (default 8) and the partial unique index prevents
 * duplicates. The integration test pins this invariant.
 */
export async function listProblemCards(
  userId: string,
  bucket: ProblemCardBucket,
): Promise<ApiList<ApiProblemCard>> {
  const { data, error } = await supabaseAdmin.rpc('get_problem_cards', asPayload({
    p_user_id: userId,
    p_bucket:  bucket,
  }))

  if (error !== null) {
    // The RPC raises SQLSTATE 22023 (`invalid_problem_card_bucket`) for an
    // unknown bucket. The Zod layer at the controller rejects unknown
    // values first, so this branch is unreachable from the public route —
    // but a future direct-SQL caller (or a typo in a Stage 8 surface)
    // would surface here. Map to 400 so it stays a clean client error.
    if (error.code === '22023' && error.message.includes('invalid_problem_card_bucket')) {
      throw new AppError(400, 'Unknown problem-card bucket', { code: 'PROBLEM_CARD_BUCKET_INVALID' })
    }
    throw dbError('list weak spots', error)
  }

  const rows  = z.array(ProblemCardRpcRowSchema).parse(data ?? [])
  const items = rows.map(toProblemCard)

  return { items, nextCursor: null, hasMore: false }
}

// ─── Stage 8 — card-quality issue counts ─────────────────────────────────────

const CardQualityIssueRpcRowSchema = z.object({
  // Mirrors the RPC's TEXT column. The Zod enum at the API boundary narrows
  // this back to the wire-format enum, so an unknown value from a future
  // RPC drift surfaces as a clean ZodError instead of leaking through.
  issue_type: ApiCardQualityIssueTypeSchema,
  count:      z.number().int().nonnegative(),
})

/**
 * Backend Completion Plan Stage 8. Returns one row per known issue type
 * (six total), with the count of the user's vocabulary+grammar cards
 * exhibiting that issue. Sentence-layout cards are excluded server-side.
 *
 * The contract guarantees all six issue types are present in every
 * response, even when every count is zero — the SQL `LATERAL VALUES`
 * unpivot emits them unconditionally, so frontend consumers can iterate
 * a stable shape without conditionally handling missing keys.
 *
 * `missing_picture` and `missing_nuance` are zero today on most rows
 * (the AI generator path under Stage 2 produces `nuance` only, and
 * `picture` requires an asset-hosting story that hasn't shipped). The
 * counts will populate naturally as generated content lands; no service
 * change required.
 */
export async function listCardQualityIssues(
  userId: string,
): Promise<ApiList<ApiCardQualityIssue>> {
  const { data, error } = await supabaseAdmin.rpc('get_card_quality_issues', asPayload({
    p_user_id: userId,
  }))

  if (error !== null) {
    throw dbError('list card-quality issues', error)
  }

  const rows = z.array(CardQualityIssueRpcRowSchema).parse(data ?? [])
  const items: ApiCardQualityIssue[] = rows.map((r) => ({
    issueType: r.issue_type,
    count:     r.count,
  }))

  return { items, nextCursor: null, hasMore: false }
}

// ─── Stage 9 — maturity-pipeline history ─────────────────────────────────────

const MaturitySnapshotRpcRowSchema = z.object({
  // Postgres returns DATE as an ISO YYYY-MM-DD string over the supabase-js
  // wire. The RPC's "today" row is computed in the learner's timezone.
  snapshot_date:    z.string(),
  new_count:        z.number().int().nonnegative(),
  learning_count:   z.number().int().nonnegative(),
  review_count:     z.number().int().nonnegative(),
  relearning_count: z.number().int().nonnegative(),
  mature_count:     z.number().int().nonnegative(),
})

/**
 * Backend Completion Plan Stage 9. Returns up to `days` rows of per-state
 * card counts, one per learner-local day. Historical rows come from the
 * `card_state_snapshots` table; today's row is always computed live from
 * `cards` so the chart reflects the current moment between cron runs.
 *
 * The `days` enum is the shared wire-format enum ('90' | '180' | '365');
 * the RPC takes an int, so we parse here. The Zod layer at the controller
 * rejects unknown enum values first; the RPC's SQLSTATE 22023 guard is
 * defence in depth for direct-SQL callers.
 *
 * A user with no reviews and no cards still gets a non-empty response —
 * the live `today` row is always emitted, with zeros across every count.
 * Historical rows may be sparse until the daily cron has run for several
 * days; that's expected per the plan ("a user with no reviews still gets
 * a sparse history").
 */
export async function listMaturityHistory(
  userId: string,
  days:   MaturityHistoryDays,
): Promise<ApiList<ApiMaturitySnapshot>> {
  const daysInt = Number.parseInt(days, 10)
  const { data, error } = await supabaseAdmin.rpc('get_maturity_pipeline_history', asPayload({
    p_user_id: userId,
    p_days:    daysInt,
  }))

  if (error !== null) {
    if (error.code === '22023' && error.message.includes('invalid_days_parameter')) {
      throw new AppError(400, 'Unknown maturity-history window', {
        code: 'MATURITY_HISTORY_DAYS_INVALID',
      })
    }
    throw dbError('list maturity-pipeline history', error)
  }

  const rows  = z.array(MaturitySnapshotRpcRowSchema).parse(data ?? [])
  const items: ApiMaturitySnapshot[] = rows.map((r) => ({
    date:            r.snapshot_date,
    newCount:        r.new_count,
    learningCount:   r.learning_count,
    reviewCount:     r.review_count,
    relearningCount: r.relearning_count,
    matureCount:     r.mature_count,
  }))

  return { items, nextCursor: null, hasMore: false }
}

// ─── Stage 10 — confusable-pair list ─────────────────────────────────────────

const ConfusablePairRpcRowSchema = z.object({
  card_a_id:        z.string().uuid(),
  card_b_id:        z.string().uuid(),
  card_a_word:      z.string().nullable(),
  card_a_reading:   z.string().nullable(),
  card_a_meaning:   z.string().nullable(),
  card_b_word:      z.string().nullable(),
  card_b_reading:   z.string().nullable(),
  card_b_meaning:   z.string().nullable(),
  miss_count:       z.number().int().nonnegative(),
  similarity_score: z.number(),
  last_observed:    z.string(),
})

/**
 * Backend Completion Plan Stage 10. Returns the user's top confusable
 * pairs — card pairs they've mis-rated in the same session AND that are
 * semantically similar (cosine ≥ 0.70). Ordered by miss_count DESC,
 * similarity_score DESC.
 *
 * Detection runs daily via pg_cron and populates the `confusable_pairs`
 * table; this reader is a simple JOIN-to-card-display-fields projection.
 * A user with no detected pairs gets an empty list, not an error — that's
 * the expected state for fresh accounts or users without similar cards
 * in their library.
 */
export async function listConfusablePairs(
  userId: string,
  limit:  number,
): Promise<ApiList<ApiConfusablePair>> {
  const { data, error } = await supabaseAdmin.rpc('get_confusable_pairs', asPayload({
    p_user_id: userId,
    p_limit:   limit,
  }))

  if (error !== null) {
    throw dbError('list confusable pairs', error)
  }

  const rows  = z.array(ConfusablePairRpcRowSchema).parse(data ?? [])
  const items: ApiConfusablePair[] = rows.map((r) => ({
    cardA: {
      id:      r.card_a_id,
      word:    r.card_a_word,
      reading: r.card_a_reading,
      meaning: r.card_a_meaning,
    },
    cardB: {
      id:      r.card_b_id,
      word:    r.card_b_word,
      reading: r.card_b_reading,
      meaning: r.card_b_meaning,
    },
    missCount:       r.miss_count,
    similarityScore: r.similarity_score,
    lastObserved:    r.last_observed,
  }))

  return { items, nextCursor: null, hasMore: false }
}
