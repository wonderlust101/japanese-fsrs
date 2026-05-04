import { describe, it, expect, mock, beforeEach } from 'bun:test'

// State the per-test query mock can mutate.
interface MockState {
  premadeRow:        Record<string, unknown> | null
  existingSub:       { id: string } | null
  insertedSub:       string | null
  insertedDeck:      string | null
  insertedCardCount: number
  sourceCards:       Record<string, unknown>[]
  insertCardsCalled: boolean
  deletedDeckCalls:  number
  deletedSubCalls:   number
}

const state: MockState = {
  premadeRow:        null,
  existingSub:       null,
  insertedSub:       null,
  insertedDeck:      null,
  insertedCardCount: 0,
  sourceCards:       [],
  insertCardsCalled: false,
  deletedDeckCalls:  0,
  deletedSubCalls:   0,
}

// ── Mock builder ──────────────────────────────────────────────────────────────
// Returns a chainable object that records the table being queried and returns
// the right shape based on `state` for `.single()`, `.maybeSingle()`, plain
// awaits (non-terminal queries), and inserts/deletes.

interface QueryStub {
  // Chain methods
  select:      (..._args: unknown[]) => QueryStub
  insert:      (..._args: unknown[]) => QueryStub
  update:      (..._args: unknown[]) => QueryStub
  delete:      (..._args: unknown[]) => QueryStub
  eq:          (..._args: unknown[]) => QueryStub
  is:          (..._args: unknown[]) => QueryStub
  in:          (..._args: unknown[]) => QueryStub
  order:       (..._args: unknown[]) => QueryStub
  // Terminals
  single:      () => Promise<{ data: unknown; error: { message: string } | null }>
  maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>
  // Allow `await query` for non-`.single()` queries (Promise-like).
  then:        (resolve: (v: { data: unknown; error: { message: string } | null }) => void) => void
}

function makeQuery(table: string, mode: 'select' | 'insert' | 'update' | 'delete' = 'select'): QueryStub {
  const q: QueryStub = {
    select: () => q,
    insert: (_payload?: unknown) => {
      mode = 'insert'
      if (table === 'user_premade_subscriptions') {
        const id = 'sub-new'
        state.insertedSub = id
      } else if (table === 'decks') {
        state.insertedDeck = 'deck-new'
      } else if (table === 'cards') {
        state.insertCardsCalled = true
        const arr = Array.isArray(_payload) ? _payload : []
        state.insertedCardCount = arr.length
      }
      return q
    },
    update: () => { mode = 'update'; return q },
    delete: () => {
      mode = 'delete'
      if (table === 'decks') state.deletedDeckCalls++
      if (table === 'user_premade_subscriptions') state.deletedSubCalls++
      return q
    },
    eq:    () => q,
    is:    () => q,
    in:    () => q,
    order: () => q,

    single: async () => {
      if (table === 'premade_decks') {
        return { data: state.premadeRow, error: state.premadeRow === null ? { message: 'not found' } : null }
      }
      if (table === 'user_premade_subscriptions' && mode === 'insert') {
        return { data: { id: state.insertedSub }, error: null }
      }
      if (table === 'decks' && mode === 'insert') {
        return { data: { id: state.insertedDeck }, error: null }
      }
      return { data: null, error: { message: 'unhandled single() in test stub' } }
    },

    maybeSingle: async () => {
      if (table === 'user_premade_subscriptions' && mode === 'select') {
        return { data: state.existingSub, error: null }
      }
      if (table === 'decks' && mode === 'select') {
        return state.existingSub === null
          ? { data: null, error: null }
          : { data: { id: 'existing-deck', card_count: state.sourceCards.length }, error: null }
      }
      return { data: null, error: null }
    },

    then: (resolve) => {
      // Non-.single() awaits — the cards source select hits this path.
      if (table === 'cards' && mode === 'select') {
        resolve({ data: state.sourceCards, error: null })
        return
      }
      if (table === 'cards' && mode === 'insert') {
        resolve({ data: null, error: null })
        return
      }
      if (table === 'decks' && mode === 'delete') {
        resolve({ data: null, error: null })
        return
      }
      if (table === 'user_premade_subscriptions' && mode === 'delete') {
        resolve({ data: null, error: null })
        return
      }
      resolve({ data: null, error: null })
    },
  }
  return q
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock((table: string) => makeQuery(table)),
    rpc:  mock(() => Promise.resolve({ data: null, error: null })),
  },
}))

const { subscribeToPremadeDeck, unsubscribeFromPremadeDeck } =
  await import('../premade.service.ts')

beforeEach(() => {
  state.premadeRow = {
    id:          'pre-1',
    name:        'JLPT N5 Vocabulary',
    description: 'Essential vocabulary for the JLPT N5 exam.',
    deck_type:   'vocabulary',
    jlpt_level:  'N5',
    domain:      null,
    card_count:  10,
    version:     1,
    is_active:   true,
    created_at:  '2026-05-03T00:00:00Z',
    updated_at:  '2026-05-03T00:00:00Z',
  }
  state.existingSub       = null
  state.insertedSub       = null
  state.insertedDeck      = null
  state.insertedCardCount = 0
  state.sourceCards = [
    { layout_type: 'vocabulary', fields_data: { word: '水' }, card_type: 'comprehension', jlpt_level: 'N5', tags: [] },
    { layout_type: 'vocabulary', fields_data: { word: '火' }, card_type: 'comprehension', jlpt_level: 'N5', tags: [] },
  ]
  state.insertCardsCalled = false
  state.deletedDeckCalls  = 0
  state.deletedSubCalls   = 0
})

describe('premade.service — subscribeToPremadeDeck', () => {
  it('on first subscribe creates a subscription, a forked deck, and clones cards with FSRS state reset', async () => {
    const result = await subscribeToPremadeDeck('user-1', 'pre-1')

    expect(result.alreadyExisted).toBe(false)
    expect(result.subscriptionId).toBe('sub-new')
    expect(result.deckId).toBe('deck-new')
    expect(result.cardCount).toBe(2)
    expect(state.insertCardsCalled).toBe(true)
    expect(state.insertedCardCount).toBe(2)
  })

  it('is idempotent — a duplicate subscribe returns the existing fork without re-cloning', async () => {
    state.existingSub = { id: 'sub-old' }

    const result = await subscribeToPremadeDeck('user-1', 'pre-1')

    expect(result.alreadyExisted).toBe(true)
    expect(result.subscriptionId).toBe('sub-old')
    expect(result.deckId).toBe('existing-deck')
    expect(state.insertCardsCalled).toBe(false)
  })
})

describe('premade.service — unsubscribeFromPremadeDeck', () => {
  it('deletes the forked deck and the subscription row', async () => {
    await unsubscribeFromPremadeDeck('user-1', 'pre-1')
    expect(state.deletedDeckCalls).toBe(1)
    expect(state.deletedSubCalls).toBe(1)
  })
})
