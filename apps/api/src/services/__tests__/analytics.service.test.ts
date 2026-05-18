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
  getJlptGap,
} = await import('../analytics.service.ts')

beforeEach(() => {
  state.rpcResponses = {}
  state.lastRpcName  = null
})

describe('analytics.service — getAccuracyByLayout', () => {
  it('rounds accuracy to one decimal place', async () => {
    state.rpcResponses['get_accuracy_by_layout_type'] = {
      data: [
        { layout_type: 'vocabulary', total: 7,   successful: 5 },
        { layout_type: 'grammar',    total: 100, successful: 87 },
        { layout_type: 'sentence',   total: 0,   successful: 0 },
      ],
      error: null,
    }

    const out = await getAccuracyByLayout('user-1')
    expect(out.items).toHaveLength(3)
    expect(out.nextCursor).toBeNull()
    expect(out.hasMore).toBe(false)
    expect(out.items[0]).toEqual({ layoutType: 'vocabulary', total: 7,   successful: 5,  accuracyPct: 71.4 })
    expect(out.items[1]).toEqual({ layoutType: 'grammar',    total: 100, successful: 87, accuracyPct: 87 })
    expect(out.items[2]).toEqual({ layoutType: 'sentence',   total: 0,   successful: 0,  accuracyPct: 0 })
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
    expect(out.items[0]).toEqual({ jlptLevel: 'N5', total: 1000, learned: 820, due: 12, progressPct: 82 })
    expect(out.items[1]).toEqual({ jlptLevel: 'N4', total: 0,    learned: 0,   due: 0,  progressPct: 0 })
  })
})
