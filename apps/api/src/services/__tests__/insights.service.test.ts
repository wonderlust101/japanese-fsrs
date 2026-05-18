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

interface MockState {
  rpcResult: RpcRow[] | null
  rpcError:  { message: string; code?: string } | null
  rpcCalls:  Array<{ fn: string; params: unknown }>
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

const { listProblemCards } = await import('../insights.service.ts')

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
