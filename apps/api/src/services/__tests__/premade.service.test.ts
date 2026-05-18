import { describe, it, expect, mock, beforeEach } from 'bun:test'

// ── State the per-test rpc mock reads from ──────────────────────────────────
//
// Backend Completion Plan Stage 4 (copy model). The premade service no longer
// has subscribe / unsubscribe; the only mutator we cover here is the new
// `copy_premade_deck` RPC. The unit harness mocks at the supabaseAdmin.rpc
// boundary — the from() chain isn't exercised by copyPremadeDeck, so we keep
// the harness minimal.

interface RpcRow {
  deck_id:    string
  card_count: number
}

interface MockState {
  rpcResult: RpcRow[] | null
  rpcError:  { message: string; code?: string } | null
  rpcCalls:  number
}

const state: MockState = {
  rpcResult: null,
  rpcError:  null,
  rpcCalls:  0,
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async () => {
      state.rpcCalls++
      return { data: state.rpcResult, error: state.rpcError }
    }),
    // copyPremadeDeck doesn't call .from(); the stub returns a thenable that
    // rejects so any accidental future .from() use is loud rather than silent.
    from: mock(() => ({
      select: mock(() => ({
        eq: mock(() => Promise.reject(new Error('unexpected .from() call in copy path'))),
      })),
    })),
  },
}))

const { copyPremadeDeck } = await import('../premade.service.ts')

beforeEach(() => {
  state.rpcResult = null
  state.rpcError  = null
  state.rpcCalls  = 0
})

describe('premade.service — copyPremadeDeck', () => {
  it('returns the new deckId + cardCount when the RPC succeeds', async () => {
    state.rpcResult = [{ deck_id: 'deck-new', card_count: 12 }]

    const result = await copyPremadeDeck('user-1', 'pre-1')

    expect(result.deckId).toBe('deck-new')
    expect(result.cardCount).toBe(12)
    expect(state.rpcCalls).toBe(1)
  })

  it('throws 404 when the RPC raises SQLSTATE 02000 with premade_deck_not_found', async () => {
    // The new RPC raises `RAISE EXCEPTION 'premade_deck_not_found' USING
    // ERRCODE = '02000'` (no_data_found) when the source is inactive or
    // missing. Translate to HTTP 404.
    state.rpcError = { message: 'premade_deck_not_found', code: '02000' }
    let captured: { statusCode: number; code?: string } | null = null
    try {
      await copyPremadeDeck('user-1', 'missing')
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(404)
    expect(captured?.code).toBe('PREMADE_DECK_NOT_FOUND')
  })

  it('throws 500 (PREMADE_COPY_RPC_EMPTY) when the RPC returns no row', async () => {
    // The RPC contract is "always RETURN QUERY one row." A zero-row return
    // shape indicates a real regression, so we want it to be loud and
    // distinguishable from a generic dbError.
    state.rpcResult = []

    let captured: { statusCode: number; code?: string } | null = null
    try {
      await copyPremadeDeck('user-1', 'pre-1')
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(500)
    expect(captured?.code).toBe('PREMADE_COPY_RPC_EMPTY')
  })

  it('allows duplicate copies — two calls produce two RPC invocations', async () => {
    state.rpcResult = [{ deck_id: 'deck-a', card_count: 5 }]
    const first = await copyPremadeDeck('user-1', 'pre-1')

    state.rpcResult = [{ deck_id: 'deck-b', card_count: 5 }]
    const second = await copyPremadeDeck('user-1', 'pre-1')

    // Duplicates are intentional — the copy model deliberately drops the
    // unique (user_id, premade_deck_id) check the old subscribe model had.
    expect(first.deckId).toBe('deck-a')
    expect(second.deckId).toBe('deck-b')
    expect(first.deckId).not.toBe(second.deckId)
    expect(state.rpcCalls).toBe(2)
  })

  it('surfaces a generic 5xx (dbError) on any other RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await copyPremadeDeck('user-1', 'pre-1')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    // dbError() surfaces as 5xx; we don't assert the exact code because that
    // detail lives in middleware/errorHandler.ts and is out of scope here.
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })
})
