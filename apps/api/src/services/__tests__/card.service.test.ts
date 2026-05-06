import { describe, it, expect, mock, beforeEach } from 'bun:test'

// Mock state shared across tests. rpcResponses[fn] is the value the mock
// supabaseAdmin.rpc will resolve to on the next call to that function name.
const state = {
  rpcResponses: {} as Record<string, { data: unknown; error: unknown }>,
  rpcCalls:     [] as Array<{ fn: string; params: unknown }>,
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock(() => ({})),
    rpc:  mock((fn: string, params: unknown) => {
      state.rpcCalls.push({ fn, params })
      const r = state.rpcResponses[fn] ?? { data: null, error: null }
      // Mimic the supabase-js PostgrestFilterBuilder shape: thenable AND
      // chainable with `.limit(...)`. Each chained method returns the same
      // object so the eventual `await` lands on the same `r`.
      const builder: { limit: (n: number) => typeof builder; then: (resolve: (v: typeof r) => void) => void } = {
        limit: () => builder,
        then:  (resolve) => resolve(r),
      }
      return builder
    }),
  },
}))

const { getStaleEmbeddingCards } = await import('../card.service.ts')

describe('card.service — getStaleEmbeddingCards', () => {
  beforeEach(() => {
    state.rpcResponses = {}
    state.rpcCalls     = []
  })

  it('calls the get_stale_embedding_cards RPC with p_user_id', async () => {
    state.rpcResponses['get_stale_embedding_cards'] = { data: [], error: null }

    await getStaleEmbeddingCards('user-1')

    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]
    if (call === undefined) throw new Error('rpc was not called')
    expect(call.fn).toBe('get_stale_embedding_cards')
    expect(call.params).toEqual({ p_user_id: 'user-1' })
  })

  it('maps DB rows through toCardRow and returns CardRow[]', async () => {
    const dbRow = {
      id:             'card-1',
      user_id:        'user-1',
      deck_id:        'deck-1',
      layout_type:    'vocabulary',
      fields_data:    { word: '猫', reading: 'ねこ', meaning: 'cat' },
      card_type:      'comprehension',
      parent_card_id: null,
      tags:           [],
      jlpt_level:     'N5',
      state:          0,
      is_suspended:   false,
      due:            '2026-05-04T12:00:00Z',
      stability:      0,
      difficulty:     0,
      elapsed_days:   0,
      scheduled_days: 0,
      reps:           0,
      lapses:         0,
      last_review:    null,
      created_at:     '2026-05-01T10:00:00Z',
      updated_at:     '2026-05-04T12:00:00Z',
    }
    state.rpcResponses['get_stale_embedding_cards'] = { data: [dbRow], error: null }

    const result = await getStaleEmbeddingCards('user-1')

    expect(result).toHaveLength(1)
    const card = result[0]
    if (card === undefined) throw new Error('expected one card in result')
    // toCardRow translates snake_case → camelCase
    expect(card.id).toBe('card-1')
    expect(card.fieldsData).toEqual({ word: '猫', reading: 'ねこ', meaning: 'cat' })
    expect(card.jlptLevel).toBe('N5')
    expect(card.isSuspended).toBe(false)
  })

  it('returns an empty array when the RPC returns null data', async () => {
    state.rpcResponses['get_stale_embedding_cards'] = { data: null, error: null }
    const result = await getStaleEmbeddingCards('user-1')
    expect(result).toEqual([])
  })

  it('throws AppError(500) when the RPC returns an error', async () => {
    state.rpcResponses['get_stale_embedding_cards'] = {
      data:  null,
      error: { message: 'database is on fire', code: 'P0001' },
    }

    try {
      await getStaleEmbeddingCards('user-1')
      expect.unreachable('Should throw on RPC error')
    } catch (err) {
      // dbError() wraps Postgres errors as AppError(500, "Failed to ...")
      expect((err as { statusCode: number }).statusCode).toBe(500)
      expect((err as Error).message).toContain('fetch stale embedding cards')
    }
  })
})
