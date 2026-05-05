import { describe, it, expect, mock } from 'bun:test'

// supabaseAdmin throws at load time when env vars are missing — mock first.
mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock(() => ({})),
    rpc:  mock(() => Promise.resolve({ data: null, error: null })),
  },
}))

const {
  getInitialFsrsState,
  getRetrievability,
  previewNextStates,
  rollbackReview,
} = await import('../fsrs.service.ts')

describe('fsrs.service — getInitialFsrsState', () => {
  it('returns FSRS field defaults for a fresh card', () => {
    const s = getInitialFsrsState()
    expect(s.state).toBe(0)
    expect(s.reps).toBe(0)
    expect(s.lapses).toBe(0)
    expect(s.elapsed_days).toBe(0)
    expect(s.scheduled_days).toBe(0)
    expect(s.learning_steps).toBe(0)
    expect(s.last_review).toBeNull()
    // due is an ISO timestamp.
    expect(typeof s.due).toBe('string')
    expect(Number.isNaN(Date.parse(s.due))).toBe(false)
  })
})

describe('fsrs.service — getRetrievability', () => {
  it('returns 1 immediately after a successful review (elapsedDays = 0)', () => {
    expect(getRetrievability(10, 0)).toBeCloseTo(1, 5)
  })

  it('decays monotonically as elapsed days grow', () => {
    const r0   = getRetrievability(10, 0)
    const r10  = getRetrievability(10, 10)
    const r90  = getRetrievability(10, 90)
    const r999 = getRetrievability(10, 999)
    expect(r0).toBeGreaterThan(r10)
    expect(r10).toBeGreaterThan(r90)
    expect(r90).toBeGreaterThan(r999)
    expect(r999).toBeLessThan(0.5)
  })
})

describe('fsrs.service — previewNextStates', () => {
  const baseRow = {
    id:             'card-1',
    user_id:        'user-1',
    card_type:      'comprehension',
    state:          0,
    is_suspended:   false,
    due:            new Date().toISOString(),
    stability:      0,
    difficulty:     0,
    elapsed_days:   0,
    scheduled_days: 0,
    learning_steps: 0,
    reps:           0,
    lapses:         0,
    last_review:    null,
  }

  it('returns four rating outcomes with monotonically increasing intervals', () => {
    const p = previewNextStates(baseRow, 'comprehension')
    expect(Object.keys(p).sort()).toEqual(['again', 'easy', 'good', 'hard'])
    // Easy intervals should be longer than Good which should be longer than Again.
    expect(p.easy.scheduledDays).toBeGreaterThanOrEqual(p.good.scheduledDays)
    expect(p.good.scheduledDays).toBeGreaterThanOrEqual(p.again.scheduledDays)
    for (const r of ['again', 'hard', 'good', 'easy'] as const) {
      expect(p[r].due).toBeInstanceOf(Date)
      expect(p[r].stability).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('fsrs.service — rollbackReview', () => {
  /** Builds a from() chain that returns a different row depending on the table name. */
  interface EqChain {
    eq: (col: string, val: unknown) => EqChain
    single: () => Promise<{ data: unknown; error: unknown }>
  }

  function makeFromMock(byTable: Record<string, { data: unknown; error: unknown }>) {
    return mock((tableName: string) => {
      const response = byTable[tableName] ?? { data: null, error: { message: 'no mock' } }
      const buildChain = (): EqChain => ({
        eq:     mock(() => buildChain()),
        single: mock(() => Promise.resolve(response)),
      })
      return {
        select: mock(() => buildChain()),
        update: mock(() => ({
          eq: mock(() => ({
            eq: mock(() => Promise.resolve({ error: null })),
          })),
        })),
      }
    })
  }

  const cardRow = {
    id:             'card-1',
    user_id:        'user-1',
    card_type:      'comprehension',
    state:          1,
    is_suspended:   false,
    due:            new Date().toISOString(),
    stability:      5,
    difficulty:     3,
    elapsed_days:   1,
    scheduled_days: 1,
    learning_steps: 0,
    reps:           1,
    lapses:         0,
    last_review:    null,
  }

  it('throws 409 when review_log has null state_before (pre-migration log)', async () => {
    const { supabaseAdmin } = await import('../../db/supabase.ts')
    const fromMock = makeFromMock({
      cards: { data: cardRow, error: null },
      review_logs: {
        // Pre-migration log: state_before is null even though card_id matches.
        data: {
          id: 'log-1',
          card_id: 'card-1',
          user_id: 'user-1',
          rating: 'good',
          reviewed_at: new Date().toISOString(),
          state_before: null,
          due_before: null,
          stability_before: null,
          difficulty_before: null,
        },
        error: null,
      },
    })
    ;(supabaseAdmin as unknown as { from: typeof fromMock }).from = fromMock

    try {
      await rollbackReview('card-1', 'user-1', 'log-1')
      expect.unreachable('Should throw 409')
    } catch (err) {
      const e = err as { statusCode?: number; message?: string }
      expect(e.statusCode).toBe(409)
      expect(e.message).toContain('cannot be rolled back')
    }
  })

  it('returns 404 when the review log does not exist', async () => {
    const { supabaseAdmin } = await import('../../db/supabase.ts')
    const fromMock = makeFromMock({
      cards: { data: cardRow, error: null },
      review_logs: { data: null, error: { code: 'PGRST116' } },
    })
    ;(supabaseAdmin as unknown as { from: typeof fromMock }).from = fromMock

    try {
      await rollbackReview('card-1', 'user-1', 'log-1')
      expect.unreachable('Should throw 404')
    } catch (err) {
      const e = err as { statusCode?: number; message?: string }
      expect(e.statusCode).toBe(404)
      expect(e.message).toContain('Review log not found')
    }
  })
})
