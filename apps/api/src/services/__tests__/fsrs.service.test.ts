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
} = await import('../fsrs.service.ts')

describe('fsrs.service — getInitialFsrsState', () => {
  it('returns FSRS field defaults for a fresh card', () => {
    const s = getInitialFsrsState()
    expect(s.status).toBe('new')
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
    status:         'new',
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
