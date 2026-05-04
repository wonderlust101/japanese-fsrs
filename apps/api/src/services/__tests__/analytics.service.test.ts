import { describe, it, expect, mock, beforeEach } from 'bun:test'

interface MockState {
  rpcResponses: Record<string, { data: unknown; error: { message: string } | null }>
  lastRpcName:  string | null
}

const state: MockState = {
  rpcResponses: {},
  lastRpcName:  null,
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async (name: string) => {
      state.lastRpcName = name
      return state.rpcResponses[name] ?? { data: null, error: null }
    }),
    from: mock(() => ({})),
  },
}))

const {
  getAccuracyByLayout,
  getStreak,
  getJlptGap,
} = await import('../analytics.service.ts')

beforeEach(() => {
  state.rpcResponses = {}
  state.lastRpcName  = null
})

describe('analytics.service — getAccuracyByLayout', () => {
  it('rounds accuracy to one decimal place', async () => {
    state.rpcResponses['get_accuracy_by_layout'] = {
      data: [
        { layout: 'comprehension', total: 7,   successful: 5 },
        { layout: 'production',    total: 100, successful: 87 },
        { layout: 'listening',     total: 0,   successful: 0 },
      ],
      error: null,
    }

    const out = await getAccuracyByLayout('user-1')
    expect(out).toHaveLength(3)
    expect(out[0]).toEqual({ layout: 'comprehension', total: 7,   successful: 5,  accuracyPct: 71.4 })
    expect(out[1]).toEqual({ layout: 'production',    total: 100, successful: 87, accuracyPct: 87 })
    expect(out[2]).toEqual({ layout: 'listening',     total: 0,   successful: 0,  accuracyPct: 0 })
  })
})

describe('analytics.service — getStreak', () => {
  it('returns zeros when the RPC yields no rows', async () => {
    state.rpcResponses['get_streak'] = { data: [], error: null }
    const out = await getStreak('user-1')
    expect(out).toEqual({ currentStreak: 0, longestStreak: 0, lastReviewDate: null })
  })

  it('coerces RPC numeric strings to numbers', async () => {
    state.rpcResponses['get_streak'] = {
      data: [{ current_streak: '5', longest_streak: '17', last_review_date: '2026-05-03' }],
      error: null,
    }
    const out = await getStreak('user-1')
    expect(out).toEqual({ currentStreak: 5, longestStreak: 17, lastReviewDate: '2026-05-03' })
  })
})

describe('analytics.service — getJlptGap', () => {
  it('computes progressPct per row', async () => {
    state.rpcResponses['get_jlpt_gap'] = {
      data: [
        { jlpt_level: 'N5', total: 1000, learned: 820, due: 12 },
        { jlpt_level: 'N4', total: 0,    learned: 0,   due: 0  },
      ],
      error: null,
    }
    const out = await getJlptGap('user-1')
    expect(out[0]).toEqual({ jlptLevel: 'N5', total: 1000, learned: 820, due: 12, progressPct: 82 })
    expect(out[1]).toEqual({ jlptLevel: 'N4', total: 0,    learned: 0,   due: 0,  progressPct: 0 })
  })
})
