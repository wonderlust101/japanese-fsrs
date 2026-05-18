import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Backend Completion Plan Stage 7 — insights.service.ts unit harness.
// Mocks at the supabaseAdmin.rpc boundary; this lets us pin the
// success-path projection, the unknown-bucket → 400 mapping, the generic
// dbError fallthrough, and the universal-list-envelope shape.

interface RpcRow {
  card_id:     string
  deck_id:     string | null
  layout_type: 'vocabulary' | 'grammar' | 'sentence'
  card_type:   'comprehension' | 'production' | 'listening'
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
  rpcResult: RpcRow[] | CardQualityRpcRow[] | null
  rpcError:  { message: string; code?: string } | null
  rpcCalls:  Array<{ fn: string; params: unknown }>
}

interface CardQualityRpcRow {
  issue_type: string
  count:      number
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

const { listProblemCards, listCardQualityIssues } = await import('../insights.service.ts')

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
        card_type:   'comprehension',
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
    expect(item.cardType).toBe('comprehension')
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
