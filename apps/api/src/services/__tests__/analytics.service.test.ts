import { describe, it, expect, mock, beforeEach } from 'bun:test'

interface MockState {
  rpcResponses: Record<string, { data: unknown; error: { message: string } | null }>
  lastRpcName:  string | null
  lastRpcArgs:  unknown
}

const state: MockState = {
  rpcResponses: {},
  lastRpcName:  null,
  lastRpcArgs:  null,
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async (name: string, params: unknown) => {
      state.lastRpcName = name
      state.lastRpcArgs = params
      return state.rpcResponses[name] ?? { data: null, error: null }
    }),
    from: mock(() => ({})),
  },
}))

const {
  getDashboardData,
} = await import('../analytics.service.ts')

beforeEach(() => {
  state.rpcResponses = {}
  state.lastRpcName  = null
  state.lastRpcArgs  = null
})

// The four granular service functions (getHeatmapData, getAccuracyByLayout,
// getJlptGap, getMilestoneForecast) were retired 2026-05-18 — they had no
// frontend consumer and the bundled `getDashboardData` is the only analytics
// read path the API exposes today. Coverage moved here.
describe('analytics.service — getDashboardData', () => {
  it('reshapes the bundled RPC envelope into the camelCase wire format', async () => {
    state.rpcResponses['get_dashboard_data'] = {
      data: {
        heatmap: [
          { date: '2026-05-15', retention: 90, count: 12, total_seconds: 420 },
        ],
        accuracy: [
          { layout_type: 'vocabulary', total: 7,   successful: 5  },
          { layout_type: 'grammar',    total: 100, successful: 87 },
          { layout_type: 'sentence',   total: 0,   successful: 0  },
        ],
        jlpt_gap: [
          { jlpt_level: 'N5', total: 1000, learned: 820, due: 12 },
          { jlpt_level: 'N4', total: 0,    learned: 0,   due: 0  },
        ],
        milestones: [
          {
            jlpt_level:                'N5',
            total:                     1000,
            learned:                   820,
            daily_pace:                5,
            days_remaining:            36,
            projected_completion_date: '2026-06-20',
          },
        ],
        cards_added_this_month: 42,
      },
      error: null,
    }

    const out = await getDashboardData('user-1', 'UTC')

    // Heatmap: snake `total_seconds` becomes camel `totalSeconds`.
    expect(out.heatmap.items).toEqual([
      { date: '2026-05-15', retention: 90, count: 12, totalSeconds: 420 },
    ])

    // Accuracy: accuracyPct rounded to one decimal place; zero-total stays 0.
    expect(out.accuracy.items).toEqual([
      { layoutType: 'vocabulary', total: 7,   successful: 5,  accuracyPct: 71.4 },
      { layoutType: 'grammar',    total: 100, successful: 87, accuracyPct: 87   },
      { layoutType: 'sentence',   total: 0,   successful: 0,  accuracyPct: 0    },
    ])

    // JLPT gap: progressPct computed per row; zero-total stays 0.
    expect(out.jlptGap.items).toEqual([
      { jlptLevel: 'N5', total: 1000, learned: 820, due: 12, progressPct: 82 },
      { jlptLevel: 'N4', total: 0,    learned: 0,   due: 0,  progressPct: 0  },
    ])

    // Milestones: null daily_pace falls back to 0; other fields pass through.
    expect(out.milestones.items).toEqual([
      {
        jlptLevel:               'N5',
        total:                   1000,
        learned:                 820,
        dailyPace:               5,
        daysRemaining:           36,
        projectedCompletionDate: '2026-06-20',
      },
    ])

    expect(out.cardsAddedThisMonth).toBe(42)

    // Bundled envelope shape: each section wrapped in the universal list
    // envelope; nextCursor/hasMore always null/false for the analytics
    // surfaces (fixed-dimension data, no real pagination).
    expect(out.heatmap.nextCursor).toBeNull()
    expect(out.heatmap.hasMore).toBe(false)
    expect(out.accuracy.nextCursor).toBeNull()
    expect(out.jlptGap.nextCursor).toBeNull()
    expect(out.milestones.nextCursor).toBeNull()
  })

  it('substitutes 0 for a null daily_pace on a milestone row', async () => {
    state.rpcResponses['get_dashboard_data'] = {
      data: {
        heatmap:                [],
        accuracy:               [],
        jlpt_gap:               [],
        milestones: [
          {
            jlpt_level:                'N1',
            total:                     1000,
            learned:                   0,
            daily_pace:                null,
            days_remaining:            null,
            projected_completion_date: null,
          },
        ],
        cards_added_this_month: 0,
      },
      error: null,
    }

    const out = await getDashboardData('user-1', 'UTC')
    expect(out.milestones.items[0]).toEqual({
      jlptLevel:               'N1',
      total:                   1000,
      learned:                 0,
      dailyPace:               0,
      daysRemaining:           null,
      projectedCompletionDate: null,
    })
  })

  it('passes through the normalized timezone to the RPC', async () => {
    state.rpcResponses['get_dashboard_data'] = {
      data: {
        heatmap:                [],
        accuracy:               [],
        jlpt_gap:               [],
        milestones:             [],
        cards_added_this_month: 0,
      },
      error: null,
    }
    await getDashboardData('user-1', 'America/New_York')
    expect(state.lastRpcName).toBe('get_dashboard_data')
    // The test name promises the timezone is forwarded — assert it, don't just
    // check the RPC name. A regression that dropped p_timezone would skew every
    // tz-aware bucket (heatmap, cards-this-month) silently.
    const args = state.lastRpcArgs as Record<string, unknown>
    expect(args['p_user_id']).toBe('user-1')
    expect(args['p_timezone']).toBe('America/New_York')
  })
})
