import { z } from 'zod'

import { supabaseAdmin } from '../db/supabase.ts'
import { asPayload } from '../lib/db.ts'
import { AppError, dbError } from '../middleware/errorHandler.ts'
import {
  layoutTypeEnum,
  cardTypeEnum,
  jlptLevelEnum,
  type ApiList,
  type ApiProblemCard,
  type ApiProblemCardBucketSchema,
  type FieldsData,
} from '@fsrs-japanese/shared-types'

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
  card_type:   cardTypeEnum,
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
    cardType:   raw.card_type,
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
 * The `[8plus]` bucket cardinality equals the unresolved-leech count for
 * the same user — process_review inserts a leech at `lapses >=
 * LEECH_THRESHOLD` (default 8) and the partial unique index prevents
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
    throw dbError('list problem cards', error)
  }

  const rows  = z.array(ProblemCardRpcRowSchema).parse(data ?? [])
  const items = rows.map(toProblemCard)

  return { items, nextCursor: null, hasMore: false }
}
