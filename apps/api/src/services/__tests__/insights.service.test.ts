import { describe, it, expect, mock, beforeEach } from 'bun:test'

// insights.service.ts unit harness. Mocks at the supabaseAdmin.rpc boundary
// so we can pin the success-path projection, the dbError fallthrough, and
// the universal-list-envelope shape.

interface CardQualityRpcRow {
  issue_type: string
  count:      number
}

interface MaturitySnapshotRpcRow {
  snapshot_date:    string
  new_count:        number
  learning_count:   number
  review_count:     number
  relearning_count: number
  mature_count:     number
}

interface MockState {
  rpcResult: CardQualityRpcRow[] | MaturitySnapshotRpcRow[] | null
  rpcError:  { message: string; code?: string } | null
  rpcCalls:  Array<{ fn: string; params: unknown }>
  // Per-RPC overrides for tests that exercise multiple RPC calls in one
  // service invocation (e.g. getDistributions fan-outs four RPCs). When
  // a function name is keyed here, the mock returns that entry instead
  // of the shared `rpcResult` slot — old tests are untouched.
  rpcByName: Record<string, { data: unknown; error: { message: string; code?: string } | null }>
}

const state: MockState = {
  rpcResult: null,
  rpcError:  null,
  rpcCalls:  [],
  rpcByName: {},
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async (fn: string, params: unknown) => {
      state.rpcCalls.push({ fn, params })
      const override = state.rpcByName[fn]
      if (override !== undefined) return override
      return { data: state.rpcResult, error: state.rpcError }
    }),
  },
}))

const {
  listCardQualityIssues,
  listMaturityHistory,
  getDistributions,
  getCardsAddedThisMonth,
} = await import('../insights.service.ts')

beforeEach(() => {
  state.rpcResult = null
  state.rpcError  = null
  state.rpcCalls  = []
  state.rpcByName = {}
})

// ─── Backend Completion Plan Stage 8 — card-quality issue counts ─────────────
describe('insights.service — listCardQualityIssues', () => {
  it('projects RPC rows to camelCase ApiCardQualityIssue and preserves the six-row contract', async () => {
    // The RPC always returns six rows — one per known issue type — even
    // when every count is zero. The service is a pass-through projector.
    state.rpcResult = [
      { issue_type: 'missing_reading',  count: 0 },
      { issue_type: 'missing_meaning',  count: 0 },
      { issue_type: 'missing_example',  count: 12 },
      { issue_type: 'missing_mnemonic', count: 47 },
      { issue_type: 'missing_picture',  count: 200 },
      { issue_type: 'missing_nuance',   count: 188 },
    ]

    const result = await listCardQualityIssues('user-1')

    expect(result.items).toHaveLength(6)
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)

    // Indexed-access on `result.items[i]` is `T | undefined` under
    // noUncheckedIndexedAccess; mapping to an object lookup keeps the
    // assertions readable without lint-tripping non-null asserts.
    const byType: Record<string, number> = {}
    for (const item of result.items) byType[item.issueType] = item.count
    expect(byType['missing_reading']).toBe(0)
    expect(byType['missing_example']).toBe(12)
    expect(byType['missing_mnemonic']).toBe(47)
    expect(byType['missing_picture']).toBe(200)
    expect(byType['missing_nuance']).toBe(188)
  })

  it('passes user_id to the RPC (no other params)', async () => {
    state.rpcResult = [
      { issue_type: 'missing_reading',  count: 0 },
      { issue_type: 'missing_meaning',  count: 0 },
      { issue_type: 'missing_example',  count: 0 },
      { issue_type: 'missing_mnemonic', count: 0 },
      { issue_type: 'missing_picture',  count: 0 },
      { issue_type: 'missing_nuance',   count: 0 },
    ]
    await listCardQualityIssues('user-1')

    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('expected one RPC call')
    expect(call.fn).toBe('get_card_quality_issues')
    expect(call.params).toEqual({ p_user_id: 'user-1' })
  })

  it('surfaces a generic 5xx via dbError on RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await listCardQualityIssues('user-1')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })

  it('Zod-rejects an RPC response carrying an unknown issue_type (drift guard)', async () => {
    // A future RPC drift that emits a row with an unrecognised issue_type
    // must surface as a clean ZodError at the service boundary — not
    // silently pass through to the consumer.
    state.rpcResult = [
      { issue_type: 'missing_reading',  count: 0 },
      { issue_type: 'missing_meaning',  count: 0 },
      { issue_type: 'missing_example',  count: 0 },
      { issue_type: 'missing_mnemonic', count: 0 },
      { issue_type: 'missing_picture',  count: 0 },
      { issue_type: 'missing_nuance',   count: 0 },
      { issue_type: 'missing_speculative_future_field', count: 99 },
    ]

    let captured: { name?: string } | null = null
    try {
      await listCardQualityIssues('user-1')
    } catch (err) {
      captured = err as { name?: string }
    }
    expect(captured?.name).toBe('ZodError')
  })

  it('returns the canonical envelope shape with nextCursor null and hasMore false', async () => {
    // Card-quality bars never paginate — the response is bounded to six
    // rows. The envelope must report so.
    state.rpcResult = [
      { issue_type: 'missing_reading',  count: 1 },
      { issue_type: 'missing_meaning',  count: 1 },
      { issue_type: 'missing_example',  count: 1 },
      { issue_type: 'missing_mnemonic', count: 1 },
      { issue_type: 'missing_picture',  count: 1 },
      { issue_type: 'missing_nuance',   count: 1 },
    ]
    const result = await listCardQualityIssues('user-1')
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })
})

// ─── Backend Completion Plan Stage 9 — maturity-pipeline history ─────────────
describe('insights.service — listMaturityHistory', () => {
  it('projects snapshot rows to camelCase ApiMaturitySnapshot', async () => {
    state.rpcResult = [
      {
        snapshot_date:    '2026-05-15',
        new_count:        100,
        learning_count:   20,
        review_count:     200,
        relearning_count: 5,
        mature_count:     500,
      },
      {
        snapshot_date:    '2026-05-16',
        new_count:        95,
        learning_count:   25,
        review_count:     210,
        relearning_count: 5,
        mature_count:     510,
      },
    ]

    const result = await listMaturityHistory('user-1', '90')

    expect(result.items).toHaveLength(2)
    const first = result.items[0]
    if (first === undefined) throw new Error('expected first row')
    expect(first.date).toBe('2026-05-15')
    expect(first.newCount).toBe(100)
    expect(first.learningCount).toBe(20)
    expect(first.reviewCount).toBe(200)
    expect(first.relearningCount).toBe(5)
    expect(first.matureCount).toBe(500)
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })

  it('parses the string days enum to an int when calling the RPC', async () => {
    state.rpcResult = []
    await listMaturityHistory('user-1', '180')

    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('expected one RPC call')
    expect(call.fn).toBe('get_maturity_pipeline_history')
    expect(call.params).toEqual({ p_user_id: 'user-1', p_days: 180 })
  })

  it('passes 365 through cleanly (longest window)', async () => {
    state.rpcResult = []
    await listMaturityHistory('user-1', '365')

    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('expected one RPC call')
    expect(call.params).toEqual({ p_user_id: 'user-1', p_days: 365 })
  })

  it('maps the RPC unknown-days SQLSTATE (22023) to HTTP 400 MATURITY_HISTORY_DAYS_INVALID', async () => {
    // Defence-in-depth path — the Zod controller layer rejects unknown
    // values first. We cast through `as never` to simulate the direct-SQL
    // caller scenario.
    state.rpcError = { message: 'invalid_days_parameter', code: '22023' }

    let captured: { statusCode: number; code?: string } | null = null
    try {
      await listMaturityHistory('user-1', 'nonsense' as never)
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(400)
    expect(captured?.code).toBe('MATURITY_HISTORY_DAYS_INVALID')
  })

  it('surfaces a generic 5xx via dbError on any other RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await listMaturityHistory('user-1', '90')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })

  it('returns an empty list when the RPC returns no rows (rare — today is always emitted live)', async () => {
    // The RPC always emits at least the live "today" row, so this scenario
    // only happens if the mock layer is exercised directly (no RPC call).
    // Useful to pin the envelope shape against a defensive null payload.
    state.rpcResult = []
    const result = await listMaturityHistory('user-1', '90')
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })
})

// ─── getDistributions ─────────────────────────────────────────────────────────

describe('insights.service — getDistributions', () => {
  it('bundles four RPC results into the camelCase wire shape', async () => {
    state.rpcByName = {
      get_answer_rating_distribution: {
        data: [
          { rating: 'again', count: 12 },
          { rating: 'hard',  count: 8  },
          { rating: 'good',  count: 64 },
          { rating: 'easy',  count: 16 },
        ],
        error: null,
      },
      get_interval_distribution: {
        data: [
          { bucket: '1d',    sort_key: 1, count: 10 },
          { bucket: '2-3d',  sort_key: 2, count: 8  },
          { bucket: '4-7d',  sort_key: 3, count: 20 },
        ],
        error: null,
      },
      get_stability_distribution: {
        data: [
          { bucket: '0-7d', sort_key: 1, count: 5  },
          { bucket: '1y+',  sort_key: 6, count: 1  },
        ],
        error: null,
      },
      get_difficulty_distribution: {
        data: [
          { bucket: '2.5-3.5', sort_key: 2, count: 3 },
          { bucket: '5.5+',    sort_key: 5, count: 1 },
        ],
        error: null,
      },
    }

    const out = await getDistributions('00000000-0000-4000-8000-000000000099')

    expect(out.ratings).toEqual({ again: 12, hard: 8, good: 64, easy: 16 })
    expect(out.intervals).toEqual([
      { label: '1d',   count: 10 },
      { label: '2-3d', count: 8  },
      { label: '4-7d', count: 20 },
    ])
    expect(out.stability).toEqual([
      { label: '0-7d', count: 5 },
      { label: '1y+',  count: 1 },
    ])
    expect(out.difficulty).toEqual([
      { label: '2.5-3.5', count: 3 },
      { label: '5.5+',    count: 1 },
    ])
  })

  it('zero-fills the rating distribution when the RPC returns an empty array', async () => {
    state.rpcByName = {
      get_answer_rating_distribution: { data: [], error: null },
      get_interval_distribution:      { data: [], error: null },
      get_stability_distribution:     { data: [], error: null },
      get_difficulty_distribution:    { data: [], error: null },
    }

    const out = await getDistributions('00000000-0000-4000-8000-000000000099')
    expect(out.ratings).toEqual({ again: 0, hard: 0, good: 0, easy: 0 })
    expect(out.intervals).toEqual([])
    expect(out.stability).toEqual([])
    expect(out.difficulty).toEqual([])
  })

  it('throws when any one of the four RPCs errors', async () => {
    state.rpcByName = {
      get_answer_rating_distribution: { data: [], error: null },
      get_interval_distribution:      { data: [], error: { message: 'kaboom', code: 'XX000' } },
      get_stability_distribution:     { data: [], error: null },
      get_difficulty_distribution:    { data: [], error: null },
    }

    await expect(getDistributions('00000000-0000-4000-8000-000000000099')).rejects.toBeDefined()
  })
})

// ─── getCardsAddedThisMonth ───────────────────────────────────────────────────

describe('insights.service — getCardsAddedThisMonth', () => {
  it('forwards the timezone to the RPC and returns the integer count', async () => {
    state.rpcByName = {
      get_cards_added_this_month: { data: 17, error: null },
    }
    const count = await getCardsAddedThisMonth(
      '00000000-0000-4000-8000-000000000099',
      'America/Los_Angeles',
    )
    expect(count).toBe(17)
    const call = state.rpcCalls.find((c) => c.fn === 'get_cards_added_this_month')
    expect(call).toBeDefined()
    expect((call?.params as Record<string, unknown>).p_timezone).toBe('America/Los_Angeles')
  })

  it('returns 0 when the RPC returns null', async () => {
    state.rpcByName = {
      get_cards_added_this_month: { data: null, error: null },
    }
    const count = await getCardsAddedThisMonth(
      '00000000-0000-4000-8000-000000000099',
      'UTC',
    )
    expect(count).toBe(0)
  })
})
