import { describe, it, expect, mock, beforeEach } from 'bun:test'

// ── Test scope ────────────────────────────────────────────────────────────────
//
// Unit coverage for `deck.service.copyDeck` (added 2026-05-18). The harness
// mocks at the supabaseAdmin.rpc boundary; copyDeck does not call .from(),
// so a stub .from() reject is wired to keep accidental future use loud
// rather than silent. Mirrors the premade.service.test.ts shape so the
// pattern is recognisable.

interface RpcRow {
  deck_id:    string
  card_count: number
}

interface MockState {
  rpcResult:    RpcRow[] | null
  rpcError:     { message: string; code?: string } | null
  rpcCalls:     number
  lastRpcName:  string | null
  lastRpcArgs:  Record<string, unknown> | null
}

const state: MockState = {
  rpcResult:   null,
  rpcError:    null,
  rpcCalls:    0,
  lastRpcName: null,
  lastRpcArgs: null,
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    rpc: mock(async (name: string, args: Record<string, unknown>) => {
      state.rpcCalls++
      state.lastRpcName = name
      state.lastRpcArgs = args
      return { data: state.rpcResult, error: state.rpcError }
    }),
    from: mock(() => ({
      select: mock(() => ({
        eq: mock(() => Promise.reject(new Error('unexpected .from() call in copyDeck'))),
      })),
    })),
  },
}))

const { copyDeck } = await import('../deck.service.ts')

beforeEach(() => {
  state.rpcResult   = null
  state.rpcError    = null
  state.rpcCalls    = 0
  state.lastRpcName = null
  state.lastRpcArgs = null
})

describe('deck.service — copyDeck', () => {
  it('returns the new deckId + cardCount when the RPC succeeds', async () => {
    state.rpcResult = [{ deck_id: 'deck-new', card_count: 24 }]

    const result = await copyDeck('user-1', 'deck-src')

    expect(result.deckId).toBe('deck-new')
    expect(result.cardCount).toBe(24)
    expect(state.rpcCalls).toBe(1)
    expect(state.lastRpcName).toBe('copy_user_deck')
  })

  it('passes the caller-supplied name through to the RPC', async () => {
    state.rpcResult = [{ deck_id: 'deck-new', card_count: 0 }]

    await copyDeck('user-1', 'deck-src', '  N5 Vocab (mine)  ')

    // The service does not trim — trim happens server-side in the RPC so
    // both the caller-name path and the default-name path go through the
    // same canonicalisation. We assert the name is forwarded verbatim.
    expect(state.lastRpcArgs?.['p_target_name']).toBe('  N5 Vocab (mine)  ')
  })

  it('passes p_target_name=null when no name is supplied', async () => {
    state.rpcResult = [{ deck_id: 'deck-new', card_count: 0 }]

    await copyDeck('user-1', 'deck-src')

    // p_target_name=null is the contract that triggers the RPC's default
    // "<source> (Copy [N])" resolution. A bug that passes "" or undefined
    // instead would break the default-naming path silently.
    expect(state.lastRpcArgs?.['p_target_name']).toBeNull()
  })

  it('throws 404 (DECK_NOT_FOUND) when the RPC raises SQLSTATE 02000 with deck_not_found', async () => {
    state.rpcError = { message: 'deck_not_found', code: '02000' }

    let captured: { statusCode: number; code?: string } | null = null
    try {
      await copyDeck('user-1', 'missing')
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(404)
    expect(captured?.code).toBe('DECK_NOT_FOUND')
  })

  it('throws 500 (DECK_COPY_RPC_EMPTY) when the RPC returns no row', async () => {
    state.rpcResult = []

    let captured: { statusCode: number; code?: string } | null = null
    try {
      await copyDeck('user-1', 'deck-src')
    } catch (err) {
      captured = err as { statusCode: number; code?: string }
    }
    expect(captured?.statusCode).toBe(500)
    expect(captured?.code).toBe('DECK_COPY_RPC_EMPTY')
  })

  it('surfaces a generic 5xx on any other RPC failure', async () => {
    state.rpcError = { message: 'connection refused', code: '08006' }

    let captured: { statusCode: number } | null = null
    try {
      await copyDeck('user-1', 'deck-src')
    } catch (err) {
      captured = err as { statusCode: number }
    }
    expect(captured?.statusCode).toBeGreaterThanOrEqual(500)
  })

  it('allows duplicate copies — two calls produce two RPC invocations and distinct deck ids', async () => {
    state.rpcResult = [{ deck_id: 'deck-a', card_count: 7 }]
    const first = await copyDeck('user-1', 'deck-src')

    state.rpcResult = [{ deck_id: 'deck-b', card_count: 7 }]
    const second = await copyDeck('user-1', 'deck-src')

    // Same as premade copy: deliberate duplicates are legitimate. The
    // idempotency-key (controller layer) is the only guard against
    // accidental double-clicks; two distinct keys ⇒ two distinct decks.
    expect(first.deckId).toBe('deck-a')
    expect(second.deckId).toBe('deck-b')
    expect(state.rpcCalls).toBe(2)
  })

  it('forwards user_id and source_deck_id to the RPC', async () => {
    state.rpcResult = [{ deck_id: 'deck-new', card_count: 1 }]

    await copyDeck('user-42', 'deck-source-uuid')

    expect(state.lastRpcArgs?.['p_user_id']).toBe('user-42')
    expect(state.lastRpcArgs?.['p_source_deck_id']).toBe('deck-source-uuid')
  })

  it('throws a Zod parse error when the RPC returns a row with a missing column', async () => {
    // CopyDeckRpcRowSchema requires { deck_id, card_count }. A row missing
    // card_count means the migration's RETURN QUERY shape drifted — surface
    // loudly rather than passing through NaN.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    state.rpcResult = [{ deck_id: 'deck-new' } as any]

    let thrown = false
    try {
      await copyDeck('user-1', 'deck-src')
    } catch {
      thrown = true
    }
    expect(thrown).toBe(true)
  })
})
