import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { ZodError } from 'zod'

import { createSupabaseHarness } from '../../../tests/support'

// One supabase mock for the whole FSRS service (mock.module is process-global
// in Bun, so a single harness per service module avoids cross-file collisions).
// The FSRS write paths fire-and-forget invalidate the due cache (Redis); no-op
// it so these unit tests stay off the network and out of the circuit breaker.
const sb = createSupabaseHarness()
mock.module('../../db/supabase.ts', () => ({ supabaseAdmin: sb.supabaseAdmin }))
mock.module('../../lib/due-cache.ts', () => ({ invalidateDueCache: async () => { /* no-op */ } }))

const {
  getInitialFsrsState,
  getRetrievability,
  previewNextStates,
  previewCardRatings,
  processReview,
  processReviewBatch,
  forgetCard,
  rollbackReview,
  rescheduleFromHistory,
} = await import('../fsrs.service.ts')

beforeEach(() => { sb.reset() })

// ── Fixtures ────────────────────────────────────────────────────────────────

/** A cards-row shaped for FSRS_SELECT_COLUMNS / FsrsCardRowSchema. state 2 = Review. */
function makeFsrsRow(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:             'card-1',
    user_id:        'user-1',
    state:          2,
    is_suspended:   false,
    due:            '2026-05-01T00:00:00.000Z',
    stability:      10,
    difficulty:     5,
    elapsed_days:   3,
    scheduled_days: 7,
    learning_steps: 0,
    reps:           4,
    lapses:         1,
    last_review:    '2026-04-24T00:00:00.000Z',
    ...over,
  }
}

/** A review_logs row with non-null before-snapshot (rollback-able). */
function makeReviewLog(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id:                    'log-1',
    card_id:               'card-1',
    user_id:               'user-1',
    rating:                'good',
    review_time_ms:        4200,
    stability_after:       12,
    difficulty_after:      5,
    due_after:             '2026-05-10T00:00:00.000Z',
    scheduled_days_after:  9,
    reviewed_at:           '2026-05-01T12:00:00.000Z',
    state_before:          2,
    stability_before:      8,
    difficulty_before:     4,
    due_before:            '2026-04-25T00:00:00.000Z',
    scheduled_days_before: 3,
    learning_steps_before: 0,
    elapsed_days_before:   6,
    last_review_before:    '2026-04-19T00:00:00.000Z',
    reps_before:           3,
    lapses_before:         1,
    ...over,
  }
}

function rpcNames(): string[] { return sb.state.rpcCalls.map((c) => c.name) }
async function statusOf(p: Promise<unknown>): Promise<number | undefined> {
  try { await p } catch (e) { return (e as { statusCode?: number }).statusCode }
  return undefined
}

// ── Pure helpers (no DB) ──────────────────────────────────────────────────────

describe('fsrs.service — getInitialFsrsState', () => {
  it('returns New-card FSRS defaults with an ISO due timestamp', () => {
    const s = getInitialFsrsState()
    expect(s.state).toBe(0)
    expect(s.reps).toBe(0)
    expect(s.lapses).toBe(0)
    expect(s.elapsed_days).toBe(0)
    expect(s.scheduled_days).toBe(0)
    expect(s.learning_steps).toBe(0)
    expect(s.last_review).toBeNull()
    expect(typeof s.due).toBe('string')
    expect(Number.isNaN(Date.parse(s.due))).toBe(false)
  })
})

describe('fsrs.service — getRetrievability', () => {
  it('is 1 immediately after a review (0 elapsed days)', () => {
    expect(getRetrievability(10, 0)).toBeCloseTo(1, 5)
  })

  it('decays monotonically as elapsed days grow', () => {
    const r0 = getRetrievability(10, 0)
    const r10 = getRetrievability(10, 10)
    const r90 = getRetrievability(10, 90)
    const r999 = getRetrievability(10, 999)
    expect(r0).toBeGreaterThan(r10)
    expect(r10).toBeGreaterThan(r90)
    expect(r90).toBeGreaterThan(r999)
    expect(r999).toBeLessThan(0.5)
  })
})

describe('fsrs.service — previewNextStates', () => {
  const baseRow = {
    id: 'card-1', user_id: 'user-1', state: 0, is_suspended: false,
    due: new Date().toISOString(), stability: 0, difficulty: 0,
    elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0,
    last_review: null,
  }

  it('returns four outcomes whose intervals order again ≤ hard ≤ good ≤ easy', () => {
    const p = previewNextStates(baseRow)
    expect(Object.keys(p).sort()).toEqual(['again', 'easy', 'good', 'hard'])
    expect(p.easy.scheduledDays).toBeGreaterThanOrEqual(p.good.scheduledDays)
    expect(p.good.scheduledDays).toBeGreaterThanOrEqual(p.hard.scheduledDays)
    expect(p.hard.scheduledDays).toBeGreaterThanOrEqual(p.again.scheduledDays)
    for (const r of ['again', 'hard', 'good', 'easy'] as const) {
      expect(p[r].due).toBeInstanceOf(Date)
      expect(p[r].stability).toBeGreaterThanOrEqual(0)
    }
  })
})

// ── processReview ─────────────────────────────────────────────────────────────

describe('fsrs.service — processReview', () => {
  it('reschedules a New card on "good" and persists it via process_review', async () => {
    sb.state.responses['cards']       = [{ data: makeFsrsRow({ state: 0, stability: 0, difficulty: 0, reps: 0, due: '2026-05-01T00:00:00.000Z' }), error: null }]
    sb.state.rpcResponses['process_review'] = [{ data: null, error: null }]
    sb.state.responses['review_logs'] = [{ data: { id: 'log-7' }, error: null }]   // fetchLatestReviewLogId

    const result = await processReview('card-1', 'good', 'user-1', 4000)

    expect(result.id).toBe('card-1')
    expect(result.reviewLogId).toBe('log-7')
    expect(result.state).toBeGreaterThan(0)                                  // left New
    expect(result.stability).toBeGreaterThan(0)
    expect(Date.parse(result.due)).toBeGreaterThan(Date.parse('2026-05-01T00:00:00.000Z'))
  })

  it('persists the BEFORE snapshot from the original row so the review is rollback-able', async () => {
    sb.state.responses['cards']       = [{ data: makeFsrsRow({ state: 2, stability: 10, due: '2026-05-01T00:00:00.000Z' }), error: null }]
    sb.state.rpcResponses['process_review'] = [{ data: null, error: null }]
    sb.state.responses['review_logs'] = [{ data: { id: 'log-7' }, error: null }]

    await processReview('card-1', 'good', 'user-1')

    const call = sb.state.rpcCalls.find((c) => c.name === 'process_review')
    const p = call?.payload as Record<string, unknown>
    expect(p['p_card_id']).toBe('card-1')
    expect(p['p_user_id']).toBe('user-1')
    expect(p['p_rating']).toBe('good')
    // The snapshot must capture the PRE-review state, not the post-schedule one —
    // rollback restores from these. Regress the wiring and this fails.
    expect(p['p_state_before']).toBe(2)
    expect(p['p_stability_before']).toBe(10)
    expect(p['p_due_before']).toBe('2026-05-01T00:00:00.000Z')
    expect(p['p_leech_threshold']).toBe(8)   // env default WEAK_SPOT_THRESHOLD
  })

  it('rejects a premade source card (user_id null) with 403 and never calls process_review', async () => {
    // Defense-in-depth: the fetch filters by user_id so a NULL-owner row is
    // normally excluded, but the guard fails closed if that filter is ever lost.
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ user_id: null }), error: null }]

    await expect(processReview('card-1', 'good', 'user-1'))
      .rejects.toMatchObject({ statusCode: 403, code: 'PREMADE_CARD_NOT_REVIEWABLE' })
    expect(rpcNames()).not.toContain('process_review')
  })

  it('rejects a suspended card with 409 CARD_SUSPENDED before scheduling', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ is_suspended: true }), error: null }]

    await expect(processReview('card-1', 'good', 'user-1'))
      .rejects.toMatchObject({ statusCode: 409, code: 'CARD_SUSPENDED' })
    expect(rpcNames()).not.toContain('process_review')
  })

  it('throws FSRS_MANUAL_RATING_BUG (500) if a "manual" rating reaches the service (Zod-boundary backstop)', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow(), error: null }]

    await expect(processReview('card-1', 'manual', 'user-1'))
      .rejects.toMatchObject({ statusCode: 500, code: 'FSRS_MANUAL_RATING_BUG' })
    expect(rpcNames()).not.toContain('process_review')
  })

  it('throws 404 CARD_NOT_FOUND when the card row is absent', async () => {
    sb.state.responses['cards'] = [{ data: null, error: null }]

    await expect(processReview('card-1', 'good', 'user-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'CARD_NOT_FOUND' })
  })

  it('surfaces an RPC column drift as a ZodError and never calls process_review', async () => {
    // Schema-as-source: FsrsCardRowSchema.parse runs before any scheduling.
    // If a SELECT/RPC ever returns a drifted column type (here: `stability`
    // arriving as text), the parse must throw loudly rather than coerce garbage
    // into the scheduler. This is the malformed-external-response guard.
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ stability: 'not-a-number' }), error: null }]

    const err = await processReview('card-1', 'good', 'user-1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ZodError)
    expect(rpcNames()).not.toContain('process_review')
  })

  it('maps the process_review P0420 archive guard to 422 DECK_ARCHIVED', async () => {
    sb.state.responses['cards']       = [{ data: makeFsrsRow(), error: null }]
    sb.state.rpcResponses['process_review'] = [{ data: null, error: { code: 'P0420', message: 'deck archived' } }]

    await expect(processReview('card-1', 'good', 'user-1'))
      .rejects.toMatchObject({ statusCode: 422, code: 'DECK_ARCHIVED' })
  })

  it('surfaces a generic 5xx when process_review fails for a non-archive reason', async () => {
    sb.state.responses['cards']       = [{ data: makeFsrsRow(), error: null }]
    sb.state.rpcResponses['process_review'] = [{ data: null, error: { code: '08006', message: 'connection refused' } }]

    expect(await statusOf(processReview('card-1', 'good', 'user-1'))).toBeGreaterThanOrEqual(500)
  })
})

// ── processReviewBatch ────────────────────────────────────────────────────────

describe('fsrs.service — processReviewBatch', () => {
  it('returns empty results/errors and issues no query for an empty batch', async () => {
    const out = await processReviewBatch([], 'user-1')
    expect(out).toEqual({ results: [], errors: [] })
    expect(sb.state.lastTable).toBeNull()
  })

  it('soft-fails premade, suspended, and missing cards per-row without calling the batch RPC', async () => {
    // Main card fetch returns the premade + suspended rows; the third id is
    // simply absent from the result set (missing). No archived cards.
    sb.state.responses['cards'] = [
      { data: [makeFsrsRow({ id: 'premade', user_id: null }), makeFsrsRow({ id: 'suspended', is_suspended: true })], error: null },
      { data: [], error: null }, // getArchivedCardIds
    ]

    const out = await processReviewBatch(
      [
        { cardId: 'premade',   rating: 'good' },
        { cardId: 'suspended', rating: 'good' },
        { cardId: 'missing',   rating: 'good' },
      ],
      'user-1',
    )

    expect(out.results).toEqual([])
    expect(out.errors).toHaveLength(3)
    const byId = new Map(out.errors.map((e) => [e.cardId, e.error]))
    expect(byId.get('premade')).toMatch(/premade source card/i)
    expect(byId.get('suspended')).toMatch(/suspended/i)
    expect(byId.get('missing')).toMatch(/not found/i)
    // Every row failed pre-RPC, so the batch RPC must not run.
    expect(rpcNames()).not.toContain('process_review_batch')
  })

  it('persists a valid review through process_review_batch and maps the result row', async () => {
    sb.state.responses['cards'] = [
      { data: [makeFsrsRow({ id: 'card-9', state: 2 })], error: null },
      { data: [], error: null }, // no archived cards
    ]
    sb.state.rpcResponses['process_review_batch'] = [{
      data: [{
        card_id: 'card-9', success: true, error_message: null,
        due: '2026-05-10T00:00:00.000Z', stability: 12, difficulty: 5,
        scheduled_days: 9, state: 2, review_log_id: 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c',
      }],
      error: null,
    }]

    const out = await processReviewBatch([{ cardId: 'card-9', rating: 'good' }], 'user-1')

    expect(out.errors).toEqual([])
    expect(out.results).toHaveLength(1)
    expect(out.results[0]?.id).toBe('card-9')
    expect(out.results[0]?.reviewLogId).toBe('a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c')

    const call = sb.state.rpcCalls.find((c) => c.name === 'process_review_batch')
    const p = call?.payload as { p_user_id: string; p_leech_threshold: number; p_reviews: Array<Record<string, unknown>> }
    expect(p.p_user_id).toBe('user-1')
    expect(p.p_leech_threshold).toBe(8)
    expect(p.p_reviews[0]?.['p_state_before']).toBe(2)   // before-snapshot wired per row
  })
})

// ── forgetCard ────────────────────────────────────────────────────────────────

describe('fsrs.service — forgetCard', () => {
  it('resets a card to New (state 0) and persists via process_forget with a before-snapshot', async () => {
    sb.state.responses['cards']      = [{ data: makeFsrsRow({ state: 2, reps: 6, lapses: 2 }), error: null }]
    sb.state.rpcResponses['process_forget'] = [{ data: null, error: null }]

    const result = await forgetCard('card-1', 'user-1')

    expect(result.id).toBe('card-1')
    expect(result.state).toBe(0)   // forgotten → New
    const call = sb.state.rpcCalls.find((c) => c.name === 'process_forget')
    expect((call?.payload as Record<string, unknown>)['p_state_before']).toBe(2)
  })

  it('rejects a premade source card with 403 PREMADE_CARD_NOT_RESETTABLE', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ user_id: null }), error: null }]

    await expect(forgetCard('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 403, code: 'PREMADE_CARD_NOT_RESETTABLE' })
    expect(rpcNames()).not.toContain('process_forget')
  })

  it('throws 404 CARD_NOT_FOUND when the card is absent', async () => {
    sb.state.responses['cards'] = [{ data: null, error: null }]
    await expect(forgetCard('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'CARD_NOT_FOUND' })
  })
})

// ── previewCardRatings ────────────────────────────────────────────────────────

describe('fsrs.service — previewCardRatings', () => {
  it('returns the four-rating preview for an owned card', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ state: 2 }), error: null }]

    const preview = await previewCardRatings('card-1', 'user-1')

    expect(Object.keys(preview).sort()).toEqual(['again', 'easy', 'good', 'hard'])
    expect(preview.easy.scheduledDays).toBeGreaterThanOrEqual(preview.again.scheduledDays)
    expect(rpcNames()).toEqual([])   // preview is read-only — no persistence RPC
  })

  it('still previews a suspended card (preview is informational)', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ is_suspended: true }), error: null }]
    const preview = await previewCardRatings('card-1', 'user-1')
    expect(Object.keys(preview)).toContain('good')
  })

  it('rejects a premade source card with 403 PREMADE_CARD_NOT_REVIEWABLE', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ user_id: null }), error: null }]
    await expect(previewCardRatings('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 403, code: 'PREMADE_CARD_NOT_REVIEWABLE' })
  })

  it('throws 404 CARD_NOT_FOUND when the card is absent', async () => {
    sb.state.responses['cards'] = [{ data: null, error: null }]
    await expect(previewCardRatings('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'CARD_NOT_FOUND' })
  })
})

// ── rollbackReview ────────────────────────────────────────────────────────────

describe('fsrs.service — rollbackReview', () => {
  it('restores the card from the log before-snapshot and persists it via UPDATE', async () => {
    sb.state.responses['review_logs'] = [{ data: makeReviewLog({ card_id: 'card-1', user_id: 'user-1' }), error: null }]
    sb.state.responses['cards'] = [
      { data: makeFsrsRow({ id: 'card-1', user_id: 'user-1', state: 2, reps: 5 }), error: null }, // current card
      { data: null, error: null },                                                                // UPDATE result
    ]

    const result = await rollbackReview('user-1', 'log-1')

    // state/stability/difficulty revert to the log's *_before snapshot; ts-fsrs
    // rollback sets `due` to the review timestamp (the card becomes due again as
    // of the undone review). Pins both the snapshot wiring and that semantic.
    expect(result.id).toBe('card-1')
    expect(result.reviewLogId).toBeNull()
    expect(result.state).toBe(2)
    expect(result.due).toBe('2026-05-01T12:00:00.000Z')   // = reviewed_at
    expect(result.stability).toBe(8)                       // = stability_before
    expect(result.difficulty).toBe(4)                      // = difficulty_before

    const update = sb.state.calls.find((c) => c.method === 'update')
    expect(update).toBeDefined()
    const body = update?.args[0] as Record<string, unknown>
    expect(body['state']).toBe(2)
    expect(body['due']).toBe('2026-05-01T12:00:00.000Z')   // restored due = reviewed_at
  })

  it('throws 409 ROLLBACK_NOT_AVAILABLE for a pre-migration log with a null before-snapshot', async () => {
    sb.state.responses['review_logs'] = [{
      data: makeReviewLog({
        state_before: null, stability_before: null, difficulty_before: null, due_before: null,
      }),
      error: null,
    }]
    sb.state.responses['cards'] = [{ data: makeFsrsRow(), error: null }]

    await expect(rollbackReview('user-1', 'log-1'))
      .rejects.toMatchObject({ statusCode: 409, code: 'ROLLBACK_NOT_AVAILABLE' })
  })

  it('returns 404 REVIEW_LOG_NOT_FOUND when the log does not exist', async () => {
    sb.state.responses['review_logs'] = [{ data: null, error: null }]

    await expect(rollbackReview('user-1', 'log-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'REVIEW_LOG_NOT_FOUND' })
  })

  it('IDOR: a log owned by another user is indistinguishable from missing (404)', async () => {
    // The fetch filters by user_id, so user-B requesting user-A's log gets a
    // null row — the same opaque 404, never leaking that the log exists.
    sb.state.responses['review_logs'] = [{ data: null, error: null }]

    await expect(rollbackReview('user-B', 'log-owned-by-A'))
      .rejects.toMatchObject({ statusCode: 404, code: 'REVIEW_LOG_NOT_FOUND' })
  })
})

// ── rescheduleFromHistory ─────────────────────────────────────────────────────

describe('fsrs.service — rescheduleFromHistory', () => {
  it('replays eligible review logs and persists via process_review with rating "manual"', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow({ state: 2 }), error: null }]
    sb.state.responses['review_logs'] = [{ data: [
      { rating: 'good',  reviewed_at: '2026-04-01T00:00:00.000Z' },
      { rating: 'again', reviewed_at: '2026-04-05T00:00:00.000Z' },
      { rating: 'good',  reviewed_at: '2026-04-12T00:00:00.000Z' },
    ], error: null }]
    sb.state.rpcResponses['process_review'] = [{ data: null, error: null }]

    const result = await rescheduleFromHistory('card-1', 'user-1')

    expect(result.id).toBe('card-1')
    // Reschedule writes a synthetic 'manual' review log — it's an internal
    // recompute, not a user rating.
    const call = sb.state.rpcCalls.find((c) => c.name === 'process_review')
    expect((call?.payload as Record<string, unknown>)['p_rating']).toBe('manual')
  })

  it('throws 409 RESCHEDULE_NO_HISTORY when no eligible logs exist', async () => {
    sb.state.responses['cards'] = [{ data: makeFsrsRow(), error: null }]
    sb.state.responses['review_logs'] = [{ data: [], error: null }]

    await expect(rescheduleFromHistory('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 409, code: 'RESCHEDULE_NO_HISTORY' })
    expect(rpcNames()).not.toContain('process_review')
  })

  it('throws 404 CARD_NOT_FOUND when the card is absent', async () => {
    sb.state.responses['cards'] = [{ data: null, error: null }]
    sb.state.responses['review_logs'] = [{ data: [], error: null }]

    await expect(rescheduleFromHistory('card-1', 'user-1'))
      .rejects.toMatchObject({ statusCode: 404, code: 'CARD_NOT_FOUND' })
  })
})

// ── Wire-contract schema tests ────────────────────────────────────────────────

describe('rollbackReviewParamSchema', () => {
  it('accepts a UUID', async () => {
    const { rollbackReviewParamSchema } = await import('@fsrs-japanese/shared-types')
    expect(rollbackReviewParamSchema.safeParse({ reviewLogId: 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c' }).success).toBe(true)
  })

  it('rejects a non-UUID', async () => {
    const { rollbackReviewParamSchema } = await import('@fsrs-japanese/shared-types')
    expect(rollbackReviewParamSchema.safeParse({ reviewLogId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects unknown keys (.strict)', async () => {
    const { rollbackReviewParamSchema } = await import('@fsrs-japanese/shared-types')
    expect(rollbackReviewParamSchema.safeParse({
      reviewLogId: 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c',
      foo:         'bar',
    }).success).toBe(false)
  })
})

describe('forgetCardBodySchema', () => {
  it('defaults resetCount to false on an empty body', async () => {
    const { forgetCardBodySchema } = await import('@fsrs-japanese/shared-types')
    expect(forgetCardBodySchema.parse({}).resetCount).toBe(false)
  })

  it('accepts { resetCount: true }', async () => {
    const { forgetCardBodySchema } = await import('@fsrs-japanese/shared-types')
    expect(forgetCardBodySchema.safeParse({ resetCount: true }).success).toBe(true)
  })

  it('rejects a non-boolean resetCount', async () => {
    const { forgetCardBodySchema } = await import('@fsrs-japanese/shared-types')
    expect(forgetCardBodySchema.safeParse({ resetCount: 'true' }).success).toBe(false)
    expect(forgetCardBodySchema.safeParse({ resetCount: 1 }).success).toBe(false)
  })

  it('rejects unknown keys (.strict)', async () => {
    const { forgetCardBodySchema } = await import('@fsrs-japanese/shared-types')
    expect(forgetCardBodySchema.safeParse({ resetCount: false, force: true }).success).toBe(false)
  })
})
