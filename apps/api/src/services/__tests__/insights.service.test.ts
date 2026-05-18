import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Backend Completion Plan Stage 7 — insights.service.ts unit harness.
// Mocks at the supabaseAdmin.rpc boundary; this lets us pin the
// success-path projection, the unknown-bucket → 400 mapping, the generic
// dbError fallthrough, and the universal-list-envelope shape.

interface RpcRow {
  card_id:     string
  deck_id:     string | null
  layout_type: 'vocabulary' | 'grammar' | 'sentence'
  jlpt_level:  string | null
  fields_data: Record<string, unknown>
  state:       number
  lapses:      number
  reps:        number
  due:         string
  last_review: string | null
}

// Tagged-union mock state — each RPC's tests preload a different row shape,
// and casts at the seam tell TS which payload is current. Avoids widening
// `rpcResult` to `unknown[]` which would lose the inferred type on the
// problem-card tests.
interface MockState {
  rpcResult: RpcRow[] | CardQualityRpcRow[] | MaturitySnapshotRpcRow[] | ConfusablePairRpcRow[] | null
  rpcError:  { message: string; code?: string } | null
  rpcCalls:  Array<{ fn: string; params: unknown }>
}

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

interface ConfusablePairRpcRow {
  card_a_id:        string
  card_b_id:        string
  card_a_word:      string | null
  card_a_reading:   string | null
  card_a_meaning:   string | null
  card_b_word:      string | null
  card_b_reading:   string | null
  card_b_meaning:   string | null
  miss_count:       number
  similarity_score: number
  last_observed:    string
}

const state: MockState = {
  rpcResult: null,
  rpcError:  null,
  rpcCalls:  [],
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async (fn: string, params: unknown) => {
      state.rpcCalls.push({ fn, params })
      return { data: state.rpcResult, error: state.rpcError }
    }),
  },
}))

const {
  listProblemCards,
  listCardQualityIssues,
  listMaturityHistory,
  listConfusablePairs,
} = await import('../insights.service.ts')

beforeEach(() => {
  state.rpcResult = null
  state.rpcError  = null
  state.rpcCalls  = []
})

describe('insights.service — listProblemCards', () => {
  it('projects RPC rows to the camelCase ApiProblemCard wire shape', async () => {
    state.rpcResult = [
      {
        card_id:     '00000000-0000-4000-8000-000000000001',
        deck_id:     '00000000-0000-4000-8000-000000000002',
        layout_type: 'vocabulary',
        jlpt_level:  'N3',
        fields_data: { word: '猫', reading: 'ねこ', meaning: 'cat' },
        state:       2,
        lapses:      5,
        reps:        12,
        due:         '2026-05-18T00:00:00.000Z',
        last_review: '2026-05-15T10:00:00.000Z',
      },
    ]

    const result = await listProblemCards('user-1', '4-5')

    expect(result.items).toHaveLength(1)
    const item = result.items[0]
    if (item === undefined) throw new Error('expected one item')
    expect(item.cardId).toBe('00000000-0000-4000-8000-000000000001')
    expect(item.deckId).toBe('00000000-0000-4000-8000-000000000002')
    expect(item.layoutType).toBe('vocabulary')
    expect(item.jlptLevel).toBe('N3')
    expect(item.lapses).toBe(5)
    expect(item.reps).toBe(12)
    expect(item.state).toBe(2)
    expect(item.due).toBe('2026-05-18T00:00:00.000Z')
    expect(item.lastReview).toBe('2026-05-15T10:00:00.000Z')
    // The endpoint is bounded by the user's card count; the envelope
    // intentionally reports no cursor / no more.
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })

  it('passes the bucket through to the RPC verbatim', async () => {
    state.rpcResult = []
    await listProblemCards('user-1', '8plus')

    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('expected one RPC call')
    expect(call.fn).toBe('get_problem_cards')
    expect(call.params).toEqual({
      p_user_id: 'user-1',
      p_bucket:  '8plus',
    })
  })

  it('maps the RPC unknown-bucket SQLSTATE (22023) to HTTP 400 PROBLEM_CARD_BUCKET_INVALID', async () => {
    state.rpcError = {
      message: 'invalid_problem_card_bucket',
      code:    '22023',
    }

    let captured: { statusCode: number; code?: string } | null = null
    try {
      // Cast to bypass the type check — we're simulating what would happen
      // if a direct-SQL caller slipped in an unknown bucket past the Zod
      // layer. The wire enum forbids this value at compile time.
      await listProblemCards('user-1', 'nonsense' as never)
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(400)
    expect(captured?.code).toBe('PROBLEM_CARD_BUCKET_INVALID')
  })

  it('surfaces a generic 5xx via dbError on any other RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await listProblemCards('user-1', '2-3')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })

  it('returns an empty list (no error) when the bucket has no matching cards', async () => {
    state.rpcResult = []
    const result = await listProblemCards('user-with-nothing', '8plus')
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })
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

// ─── Backend Completion Plan Stage 10 — confusable pairs ─────────────────────
describe('insights.service — listConfusablePairs', () => {
  it('projects flat RPC rows into nested cardA / cardB display shape', async () => {
    state.rpcResult = [
      {
        card_a_id:        '00000000-0000-4000-8000-000000000001',
        card_b_id:        '00000000-0000-4000-8000-000000000002',
        card_a_word:      '来る',
        card_a_reading:   'くる',
        card_a_meaning:   'to come',
        card_b_word:      '入る',
        card_b_reading:   'はいる',
        card_b_meaning:   'to enter',
        miss_count:       5,
        similarity_score: 0.84,
        last_observed:    '2026-05-16T22:00:00.000Z',
      },
    ]

    const result = await listConfusablePairs('user-1', 20)

    expect(result.items).toHaveLength(1)
    const pair = result.items[0]
    if (pair === undefined) throw new Error('expected one pair')
    expect(pair.cardA.id).toBe('00000000-0000-4000-8000-000000000001')
    expect(pair.cardA.word).toBe('来る')
    expect(pair.cardA.reading).toBe('くる')
    expect(pair.cardA.meaning).toBe('to come')
    expect(pair.cardB.id).toBe('00000000-0000-4000-8000-000000000002')
    expect(pair.cardB.word).toBe('入る')
    expect(pair.missCount).toBe(5)
    expect(pair.similarityScore).toBe(0.84)
    expect(pair.lastObserved).toBe('2026-05-16T22:00:00.000Z')
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })

  it('passes user_id and limit to the RPC verbatim', async () => {
    state.rpcResult = []
    await listConfusablePairs('user-1', 42)

    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('expected one RPC call')
    expect(call.fn).toBe('get_confusable_pairs')
    expect(call.params).toEqual({ p_user_id: 'user-1', p_limit: 42 })
  })

  it('surfaces a generic 5xx via dbError on RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await listConfusablePairs('user-1', 20)
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })

  it('returns an empty list when the user has no detected pairs', async () => {
    state.rpcResult = []
    const result = await listConfusablePairs('user-with-no-confusables', 20)
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeNull()
    expect(result.hasMore).toBe(false)
  })

  it('preserves null display fields when a card has no word/reading/meaning yet', async () => {
    // Sentence-layout cards (or freshly-created cards still being filled in)
    // may not carry word/reading/meaning. The RPC returns NULLs in that case;
    // the service must pass them through cleanly without coercing to '' so
    // the consumer can render a placeholder.
    state.rpcResult = [
      {
        card_a_id:        '00000000-0000-4000-8000-000000000003',
        card_b_id:        '00000000-0000-4000-8000-000000000004',
        card_a_word:      null,
        card_a_reading:   null,
        card_a_meaning:   null,
        card_b_word:      '完璧',
        card_b_reading:   'かんぺき',
        card_b_meaning:   'perfect',
        miss_count:       2,
        similarity_score: 0.71,
        last_observed:    '2026-05-10T10:00:00.000Z',
      },
    ]
    const result = await listConfusablePairs('user-1', 20)
    expect(result.items).toHaveLength(1)
    const pair = result.items[0]
    if (pair === undefined) throw new Error('expected one pair')
    expect(pair.cardA.word).toBeNull()
    expect(pair.cardA.reading).toBeNull()
    expect(pair.cardA.meaning).toBeNull()
    expect(pair.cardB.word).toBe('完璧')
  })
})
