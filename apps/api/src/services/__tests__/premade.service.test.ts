import { describe, it, expect, mock, beforeEach } from 'bun:test'

// ── State the per-test rpc/from mocks read from ──────────────────────────────

interface RpcRow {
  subscription_id: string
  deck_id:         string
  card_count:      number
  already_existed: boolean
}

interface MockState {
  rpcResult:        RpcRow[] | null
  rpcError:         { message: string; code?: string } | null
  rpcCalls:         number
  deletedDeckCalls: number
  deletedSubCalls:  number
}

const state: MockState = {
  rpcResult:        null,
  rpcError:         null,
  rpcCalls:         0,
  deletedDeckCalls: 0,
  deletedSubCalls:  0,
}

// ── Minimal `from()` chain mock for the unsubscribe path ─────────────────────

interface DeleteStub {
  delete: () => DeleteStub
  eq:     () => DeleteStub
  then:   (resolve: (v: { data: null; error: null }) => void) => void
}

function makeDelete(table: string): DeleteStub {
  const q: DeleteStub = {
    delete: () => {
      if (table === 'decks') state.deletedDeckCalls++
      if (table === 'user_premade_subscriptions') state.deletedSubCalls++
      return q
    },
    eq: () => q,
    then: (resolve) => resolve({ data: null, error: null }),
  }
  return q
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock((table: string) => makeDelete(table)),
    rpc:  mock(async () => {
      state.rpcCalls++
      return { data: state.rpcResult, error: state.rpcError }
    }),
  },
}))

const { subscribeToPremadeDeck, unsubscribeFromPremadeDeck } =
  await import('../premade.service.ts')

beforeEach(() => {
  state.rpcResult        = null
  state.rpcError         = null
  state.rpcCalls         = 0
  state.deletedDeckCalls = 0
  state.deletedSubCalls  = 0
})

describe('premade.service — subscribeToPremadeDeck', () => {
  it('returns the new subscription/deck when the RPC reports a fresh subscribe', async () => {
    state.rpcResult = [{
      subscription_id: 'sub-new',
      deck_id:         'deck-new',
      card_count:      2,
      already_existed: false,
    }]

    const result = await subscribeToPremadeDeck('user-1', 'pre-1')

    expect(result.alreadyExisted).toBe(false)
    expect(result.subscriptionId).toBe('sub-new')
    expect(result.deckId).toBe('deck-new')
    expect(result.cardCount).toBe(2)
    expect(state.rpcCalls).toBe(1)
  })

  it('is idempotent — surfaces the existing fork when RPC reports already_existed', async () => {
    state.rpcResult = [{
      subscription_id: 'sub-old',
      deck_id:         'existing-deck',
      card_count:      2,
      already_existed: true,
    }]

    const result = await subscribeToPremadeDeck('user-1', 'pre-1')

    expect(result.alreadyExisted).toBe(true)
    expect(result.subscriptionId).toBe('sub-old')
    expect(result.deckId).toBe('existing-deck')
  })

  it('throws 404 when the RPC raises P0002 (premade deck not found)', async () => {
    state.rpcError = { message: 'Premade deck not found', code: 'P0002' }
    let captured: { statusCode: number } | null = null
    try {
      await subscribeToPremadeDeck('user-1', 'missing')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBe(404)
  })
})

describe('premade.service — unsubscribeFromPremadeDeck', () => {
  it('invokes the unsubscribe RPC exactly once', async () => {
    await unsubscribeFromPremadeDeck('user-1', 'pre-1')
    expect(state.rpcCalls).toBe(1)
    expect(state.deletedDeckCalls).toBe(0)
    expect(state.deletedSubCalls).toBe(0)
  })
})
