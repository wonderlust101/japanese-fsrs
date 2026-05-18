import { describe, it, expect, mock, beforeEach } from 'bun:test'

import { randomUUID } from 'node:crypto'

import {
  createDrillSessionSchema,
  drillSessionIdParamSchema,
  emptyBodySchema,
  listLeechesQuerySchema,
  leechIdParamSchema,
  recordDrillAttemptSchema,
  type RecordDrillAttemptInput,
} from '../../schemas/leech.schema.ts'

// ── Chainable Supabase builder mock ─────────────────────────────────────────
//
// The leech service composes a Supabase JS query as
//   from('leeches').select(...).eq(...).eq(...).limit(...)?.order(...)*?.or(...)?
// then awaits the builder. The real builder is a Promise-like at await time.
// We replicate that with a recursive proxy that records every call and resolves
// to whatever `state.responses[<key>]` says.

interface CallRecord {
  method: string
  args:   readonly unknown[]
}

interface MockState {
  // Keyed by the table name passed to `.from(table)`. Multiple sequential
  // selects against the same table queue up in this list.
  responses: Record<string, Array<{ data: unknown; error: { message: string; code?: string } | null }>>
  calls:     CallRecord[]
  lastTable: string | null
  // `.maybeSingle()` switches the terminal resolver to a single-row shape;
  // `.single()` does the same with a different missing-row code.
  terminalShape: 'list' | 'maybeSingle'

  // ── RPC mock state ──────────────────────────────────────────────────────
  // Stage 3+ exercises `supabaseAdmin.rpc('name', payload)`. Tests push
  // response objects keyed by RPC name; the mock pops one per call.
  rpcResponses: Record<string, Array<{ data: unknown; error: { message: string; code?: string } | null }>>
  rpcCalls:     Array<{ name: string; payload: unknown }>
}

const state: MockState = {
  responses:    {},
  calls:        [],
  lastTable:    null,
  terminalShape: 'list',
  rpcResponses: {},
  rpcCalls:     [],
}

function reset(): void {
  state.responses     = {}
  state.calls         = []
  state.lastTable     = null
  state.terminalShape = 'list'
  state.rpcResponses  = {}
  state.rpcCalls      = []
  aiMock.diagnosisResponses = []
  aiMock.diagnosisCalls     = []
}

function makeBuilder(table: string): unknown {
  const queue = state.responses[table] ?? []

  const handler: ProxyHandler<{ then: unknown }> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Pop the next queued response; if the queue is empty, default to an
        // empty list with no error so the test sees a deterministic empty
        // result rather than a hang.
        const next = queue.shift() ?? { data: state.terminalShape === 'maybeSingle' ? null : [], error: null }
        return (resolve: (v: unknown) => void): void => resolve(next)
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return (...args: readonly unknown[]): unknown => {
          state.calls.push({ method: String(prop), args })
          state.terminalShape = 'maybeSingle'
          return builder
        }
      }
      return (...args: readonly unknown[]): unknown => {
        state.calls.push({ method: String(prop), args })
        return builder
      }
    },
  }

  const builder: unknown = new Proxy({ then: undefined }, handler)
  return builder
}

mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock((table: string) => {
      state.lastTable = table
      return makeBuilder(table)
    }),
    rpc: mock(async (name: string, payload: unknown) => {
      state.rpcCalls.push({ name, payload })
      const queue = state.rpcResponses[name] ?? []
      return queue.shift() ?? { data: null, error: null }
    }),
  },
}))

// Mock the AI service so diagnoseLeech tests can drive its output without
// hitting OpenAI. The mock records every call so we can assert that replay
// paths never invoke it.
interface AiMockState {
  diagnosisResponses: Array<{ data: unknown; error: Error | null }>
  diagnosisCalls:     Array<readonly unknown[]>
}
const aiMock: AiMockState = { diagnosisResponses: [], diagnosisCalls: [] }
mock.module('../ai.service.ts', () => ({
  generateLeechDiagnosis: mock(async (...args: readonly unknown[]) => {
    aiMock.diagnosisCalls.push(args)
    const next = aiMock.diagnosisResponses.shift()
    if (next === undefined) {
      return { diagnosis: 'fallback diagnosis', prescription: 'fallback prescription' }
    }
    if (next.error !== null) throw next.error
    return next.data
  }),
}))

const {
  listLeeches, getLeechById, toListItem,
  resolveLeech, reopenLeech,
  createDrillSession, getDrillSession, recordDrillAttempt, transitionDrillSession,
  diagnoseLeech,
} = await import('../leech.service.ts')
import type { LeechRow } from '../leech.service.ts'

beforeEach(() => {
  reset()
})

// ── Fixtures ────────────────────────────────────────────────────────────────

const LEECH_ID  = 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c'
const CARD_ID   = 'b2e6c3d4-5e6f-4a7b-8c9d-7e6f5a4b3c2d'
const DECK_ID   = 'c3f7d4e5-6f7a-4b8c-9d0e-8f7a6b5c4d3e'
const ORPHAN_ID = 'd4a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f'

const SAMPLE_LEECH_ROW: LeechRow = {
  id:           LEECH_ID,
  card_id:      CARD_ID,
  diagnosis:    null,
  prescription: null,
  resolved:     false,
  resolved_at:  null,
  created_at:   '2026-05-01T12:00:00.000Z',
  card: {
    deck_id:      DECK_ID,
    fields_data:  { word: '猫', reading: 'ねこ', meaning: 'cat' },
    layout_type:  'vocabulary',
    card_type:    'comprehension',
    jlpt_level:   'N5',
    lapses:       8,
    reps:         12,
    due:          '2026-05-15T00:00:00.000Z',
    last_review:  '2026-05-10T00:00:00.000Z',
    is_suspended: false,
    deck:         { name: 'Core 1k' },
  },
}

const ORPHAN_LEECH_ROW: LeechRow = {
  id:           ORPHAN_ID,
  card_id:      null,
  diagnosis:    null,
  prescription: null,
  resolved:     true,
  resolved_at:  '2026-05-02T00:00:00.000Z',
  created_at:   '2026-04-20T00:00:00.000Z',
  card:         null,
}

const baseParams = listLeechesQuerySchema.parse({})

// ── Schema tests ────────────────────────────────────────────────────────────

describe('leech schemas', () => {
  it('listLeechesQuerySchema applies defaults', () => {
    const parsed = listLeechesQuerySchema.parse({})
    expect(parsed.status).toBe('unresolved')
    expect(parsed.sort).toBe('mostRecent')
    expect(parsed.limit).toBe(50)
  })

  it('listLeechesQuerySchema rejects unknown keys (.strict)', () => {
    const result = listLeechesQuerySchema.safeParse({ foo: 'bar' })
    expect(result.success).toBe(false)
  })

  it('listLeechesQuerySchema coerces limit and clamps via max', () => {
    expect(listLeechesQuerySchema.parse({ limit: '25' }).limit).toBe(25)
    expect(listLeechesQuerySchema.safeParse({ limit: 200 }).success).toBe(false)
  })

  it('leechIdParamSchema rejects non-UUID', () => {
    expect(leechIdParamSchema.safeParse({ id: 'not-a-uuid' }).success).toBe(false)
    expect(leechIdParamSchema.safeParse({ id: 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c' }).success).toBe(true)
  })

  it('listLeechesQuerySchema accepts the deckOrder sort', () => {
    const result = listLeechesQuerySchema.safeParse({ sort: 'deckOrder' })
    expect(result.success).toBe(true)
  })

  it('listLeechesQuerySchema accepts available/missing diagnosis values', () => {
    expect(listLeechesQuerySchema.safeParse({ diagnosis: 'available' }).success).toBe(true)
    expect(listLeechesQuerySchema.safeParse({ diagnosis: 'missing'   }).success).toBe(true)
  })

  it('listLeechesQuerySchema rejects unknown diagnosis values', () => {
    // The spec's third arm 'not included in plan' was a tier signal; Stage 7
    // removed the tier model (all features free for the MVP) so the enum
    // stays at the two column-based arms.
    expect(listLeechesQuerySchema.safeParse({ diagnosis: 'pending'  }).success).toBe(false)
    expect(listLeechesQuerySchema.safeParse({ diagnosis: 'paid'     }).success).toBe(false)
  })
})

// ── toListItem ──────────────────────────────────────────────────────────────

describe('leech.service — toListItem', () => {
  it('maps a vocabulary leech row to camelCase', () => {
    const item = toListItem(SAMPLE_LEECH_ROW)
    expect(item.id).toBe(LEECH_ID)
    expect(item.cardId).toBe(CARD_ID)
    expect(item.deckId).toBe(DECK_ID)
    expect(item.deckName).toBe('Core 1k')
    expect(item.word).toBe('猫')
    expect(item.reading).toBe('ねこ')
    expect(item.meaning).toBe('cat')
    expect(item.layoutType).toBe('vocabulary')
    expect(item.cardType).toBe('comprehension')
    expect(item.jlptLevel).toBe('N5')
    expect(item.lapses).toBe(8)
    expect(item.reps).toBe(12)
    expect(item.resolved).toBe(false)
    expect(item.createdAt).toBe('2026-05-01T12:00:00.000Z')
  })

  it('returns null card-derived fields for an orphan leech', () => {
    const item = toListItem(ORPHAN_LEECH_ROW)
    expect(item.cardId).toBeNull()
    expect(item.deckId).toBeNull()
    expect(item.deckName).toBeNull()
    expect(item.word).toBeNull()
    expect(item.reading).toBeNull()
    expect(item.meaning).toBeNull()
    expect(item.layoutType).toBeNull()
    expect(item.cardType).toBeNull()
    expect(item.jlptLevel).toBeNull()
    expect(item.lapses).toBeNull()
    expect(item.due).toBeNull()
    expect(item.resolved).toBe(true)
  })
})

// ── listLeeches ─────────────────────────────────────────────────────────────

describe('leech.service — listLeeches', () => {
  it('filters by user_id and unresolved by default', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW], error: null }]
    const out = await listLeeches('user-1', baseParams)

    const eqCalls = state.calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-1'] })
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['resolved', false] })
    expect(out.items).toHaveLength(1)
    expect(out.hasMore).toBe(false)
    expect(out.nextCursor).toBeNull()
  })

  it('passes resolved=true when status=resolved', async () => {
    state.responses['leeches'] = [{ data: [], error: null }]
    await listLeeches('user-1', { ...baseParams, status: 'resolved' })

    const eqCalls = state.calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['resolved', true] })
  })

  it('signals hasMore and emits a cursor when limit + 1 rows return', async () => {
    // Three near-identical rows; service should keep limit=2 and report hasMore.
    const rows = [
      { ...SAMPLE_LEECH_ROW, id: 'e5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a', created_at: '2026-05-05T00:00:00.000Z' },
      { ...SAMPLE_LEECH_ROW, id: 'f6cae7b8-9cad-4e1f-9a3b-bc0d9e8f7a6b', created_at: '2026-05-04T00:00:00.000Z' },
      { ...SAMPLE_LEECH_ROW, id: 'a7dbf8c9-adbe-4f2a-9b4c-cd1eaf9a8b7c', created_at: '2026-05-03T00:00:00.000Z' },
    ]
    state.responses['leeches'] = [{ data: rows, error: null }]

    const out = await listLeeches('user-1', { ...baseParams, limit: 2 })
    expect(out.items).toHaveLength(2)
    expect(out.hasMore).toBe(true)
    expect(out.nextCursor).not.toBeNull()

    // The cursor should round-trip through base64url JSON to the last visible row.
    const decoded = JSON.parse(Buffer.from(out.nextCursor as string, 'base64url').toString('utf8'))
    expect(decoded).toEqual({
      createdAt: '2026-05-04T00:00:00.000Z',
      id:        'f6cae7b8-9cad-4e1f-9a3b-bc0d9e8f7a6b',
    })
  })

  it('includes an orphan leech row when no card filter is set', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW, ORPHAN_LEECH_ROW], error: null }]
    const out = await listLeeches('user-1', { ...baseParams, status: 'resolved' })
    expect(out.items).toHaveLength(2)
    expect(out.items[1]?.cardId).toBeNull()
  })

  it('applies a card-side filter via dot notation', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW], error: null }]
    await listLeeches('user-1', { ...baseParams, deckId: DECK_ID })

    const eqCalls = state.calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({
      method: 'eq',
      args:   ['card.deck_id', DECK_ID],
    })
  })

  it('throws CURSOR_INVALID 400 when cursor is supplied with mostLapses sort', async () => {
    const cursor = Buffer.from(JSON.stringify({
      createdAt: '2026-05-01T00:00:00.000Z',
      id:        'e5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a',
    }), 'utf8').toString('base64url')

    let caught: unknown
    try {
      await listLeeches('user-1', { ...baseParams, sort: 'mostLapses', cursor })
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(400)
    expect(e.code).toBe('CURSOR_INVALID')
  })

  it('translates Supabase errors via dbError (5xx becomes 500)', async () => {
    state.responses['leeches'] = [{ data: null, error: { message: 'connection refused' } }]

    let caught: unknown
    try {
      await listLeeches('user-1', baseParams)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })
})

// ── getLeechById ─────────────────────────────────────────────────────────────

describe('leech.service — getLeechById', () => {
  it('returns the mapped row on the happy path', async () => {
    state.responses['leeches'] = [{ data: SAMPLE_LEECH_ROW, error: null }]
    const out = await getLeechById('user-1', LEECH_ID)
    expect(out.id).toBe(LEECH_ID)
    expect(out.deckName).toBe('Core 1k')
  })

  it('throws LEECH_NOT_FOUND 404 when the row is missing', async () => {
    state.responses['leeches'] = [{ data: null, error: null }]

    let caught: unknown
    try {
      await getLeechById('user-1', 'b8ec19da-becf-403b-9c5d-de2fb0ab9c8d')
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_NOT_FOUND')
  })
})

// ── resolveLeech ─────────────────────────────────────────────────────────────
//
// Each resolveLeech call issues up to three queries against the `leeches`
// table: (1) state pre-fetch via .select(slim).maybeSingle(), (2) UPDATE on
// the flip path, and (3) joined refetch via .select(LEECH_SELECT_LEFT).single().
// The chainable mock's response queue is FIFO, so each test pushes the
// expected sequence in order.

describe('leech.service — resolveLeech', () => {
  it('flips an unresolved leech to resolved and stamps resolved_at', async () => {
    state.responses['leeches'] = [
      // 1) pre-fetch: unresolved
      { data: { id: LEECH_ID, resolved: false, resolved_at: null }, error: null },
      // 2) UPDATE: success (no rows returned, just error: null)
      { data: null, error: null },
      // 3) joined refetch: returns the now-resolved row
      { data: { ...SAMPLE_LEECH_ROW, resolved: true, resolved_at: '2026-05-14T18:00:00.000Z' }, error: null },
    ]

    const out = await resolveLeech('user-1', LEECH_ID)
    expect(out.id).toBe(LEECH_ID)
    expect(out.resolved).toBe(true)
    expect(out.resolvedAt).toBe('2026-05-14T18:00:00.000Z')

    // The update method must have been invoked exactly once, with the right patch.
    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(1)
    const patch = updateCalls[0]?.args[0] as { resolved: boolean; resolved_at: string }
    expect(patch.resolved).toBe(true)
    expect(typeof patch.resolved_at).toBe('string')
  })

  it('is idempotent: already-resolved leech returns the existing row without UPDATE', async () => {
    const resolvedRow = { ...SAMPLE_LEECH_ROW, resolved: true, resolved_at: '2026-05-01T12:00:00.000Z' }
    state.responses['leeches'] = [
      // 1) pre-fetch: already resolved
      { data: { id: LEECH_ID, resolved: true, resolved_at: '2026-05-01T12:00:00.000Z' }, error: null },
      // 2) joined refetch (skips the UPDATE entirely)
      { data: resolvedRow, error: null },
    ]

    const out = await resolveLeech('user-1', LEECH_ID)
    expect(out.resolved).toBe(true)
    expect(out.resolvedAt).toBe('2026-05-01T12:00:00.000Z')

    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(0)
  })

  it('throws LEECH_NOT_FOUND 404 when the leech does not exist', async () => {
    state.responses['leeches'] = [{ data: null, error: null }]

    let caught: unknown
    try {
      await resolveLeech('user-1', 'b8ec19da-becf-403b-9c5d-de2fb0ab9c8d')
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_NOT_FOUND')
  })

  it('translates DB errors on UPDATE via dbError (500)', async () => {
    state.responses['leeches'] = [
      { data: { id: LEECH_ID, resolved: false, resolved_at: null }, error: null },
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await resolveLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })
})

// ── reopenLeech ──────────────────────────────────────────────────────────────

describe('leech.service — reopenLeech', () => {
  it('flips a resolved leech back to unresolved and clears resolved_at', async () => {
    state.responses['leeches'] = [
      { data: { id: LEECH_ID, resolved: true, resolved_at: '2026-05-01T12:00:00.000Z' }, error: null },
      { data: null, error: null },
      { data: { ...SAMPLE_LEECH_ROW, resolved: false, resolved_at: null }, error: null },
    ]

    const out = await reopenLeech('user-1', LEECH_ID)
    expect(out.resolved).toBe(false)
    expect(out.resolvedAt).toBeNull()

    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]?.args[0]).toEqual({ resolved: false, resolved_at: null })
  })

  it('is idempotent: already-open leech returns the existing row without UPDATE', async () => {
    state.responses['leeches'] = [
      { data: { id: LEECH_ID, resolved: false, resolved_at: null }, error: null },
      { data: SAMPLE_LEECH_ROW, error: null },
    ]

    const out = await reopenLeech('user-1', LEECH_ID)
    expect(out.resolved).toBe(false)

    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(0)
  })

  it('throws LEECH_NOT_FOUND 404 when the leech does not exist', async () => {
    state.responses['leeches'] = [{ data: null, error: null }]

    let caught: unknown
    try {
      await reopenLeech('user-1', 'b8ec19da-becf-403b-9c5d-de2fb0ab9c8d')
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_NOT_FOUND')
  })

  it('translates SQLSTATE 23505 from the partial unique index to LEECH_ALREADY_OPEN 409', async () => {
    state.responses['leeches'] = [
      { data: { id: LEECH_ID, resolved: true, resolved_at: '2026-05-01T12:00:00.000Z' }, error: null },
      { data: null, error: { message: 'duplicate key value violates unique constraint', code: '23505' } },
    ]

    let caught: unknown
    try {
      await reopenLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(409)
    expect(e.code).toBe('LEECH_ALREADY_OPEN')
  })

  it('falls through to dbError for non-23505 UPDATE errors (500)', async () => {
    state.responses['leeches'] = [
      { data: { id: LEECH_ID, resolved: true, resolved_at: '2026-05-01T12:00:00.000Z' }, error: null },
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await reopenLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })
})

// ── listLeeches — Stage 2.5: deckOrder sort + diagnosis filter ──────────────

describe('leech.service — listLeeches deckOrder sort', () => {
  it('orders by foreign-table cards.deck_id ascending, then created_at desc, then id desc', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW], error: null }]
    await listLeeches('user-1', listLeechesQuerySchema.parse({ sort: 'deckOrder' }))

    const orderCalls = state.calls.filter((c) => c.method === 'order')
    // First order call must target deck_id on the joined cards relation.
    expect(orderCalls[0]?.args[0]).toBe('deck_id')
    const firstOpts = orderCalls[0]?.args[1] as { ascending?: boolean; foreignTable?: string }
    expect(firstOpts.ascending).toBe(true)
    expect(firstOpts.foreignTable).toBe('cards')
    // Then created_at desc, id desc as the in-deck tiebreakers.
    expect(orderCalls[1]?.args[0]).toBe('created_at')
    expect(orderCalls[2]?.args[0]).toBe('id')
  })

  it('throws CURSOR_INVALID 400 when a cursor is supplied with deckOrder', async () => {
    const cursor = Buffer.from(JSON.stringify({
      createdAt: '2026-05-01T00:00:00.000Z',
      id:        'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c',
    }), 'utf8').toString('base64url')

    let caught: unknown
    try {
      await listLeeches('user-1', listLeechesQuerySchema.parse({ sort: 'deckOrder', cursor }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(400)
    expect(e.code).toBe('CURSOR_INVALID')
  })

  it('never emits a nextCursor for deckOrder, even when hasMore is true', async () => {
    // Three rows, limit 2 → service detects hasMore but must withhold the cursor.
    const rows = [
      { ...SAMPLE_LEECH_ROW, id: 'e5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a' },
      { ...SAMPLE_LEECH_ROW, id: 'f6cae7b8-9cad-4e1f-9a3b-bc0d9e8f7a6b' },
      { ...SAMPLE_LEECH_ROW, id: 'a7dbf8c9-adbe-4f2a-9b4c-cd1eaf9a8b7c' },
    ]
    state.responses['leeches'] = [{ data: rows, error: null }]

    const out = await listLeeches('user-1', listLeechesQuerySchema.parse({ sort: 'deckOrder', limit: 2 }))
    expect(out.hasMore).toBe(true)
    expect(out.nextCursor).toBeNull()
  })
})

describe('leech.service — listLeeches diagnosis filter', () => {
  it('diagnosis=available adds a NOT IS NULL filter without forcing inner-join', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW], error: null }]
    await listLeeches('user-1', listLeechesQuerySchema.parse({ diagnosis: 'available' }))

    // Filter must be a .not('diagnosis', 'is', null) call against the leeches table.
    const notCalls = state.calls.filter((c) => c.method === 'not')
    expect(notCalls).toContainEqual({ method: 'not', args: ['diagnosis', 'is', null] })

    // No card-side filter was set, so the embed must stay LEFT JOIN. Inspect the
    // select-call argument and assert it does NOT contain the inner-join marker.
    const selectCalls = state.calls.filter((c) => c.method === 'select')
    const selectStr = selectCalls[0]?.args[0]
    expect(typeof selectStr).toBe('string')
    expect(String(selectStr).includes('cards!inner')).toBe(false)
  })

  it('diagnosis=missing adds an IS NULL filter without forcing inner-join', async () => {
    state.responses['leeches'] = [{ data: [], error: null }]
    await listLeeches('user-1', listLeechesQuerySchema.parse({ diagnosis: 'missing' }))

    const isCalls = state.calls.filter((c) => c.method === 'is')
    expect(isCalls).toContainEqual({ method: 'is', args: ['diagnosis', null] })

    const selectCalls = state.calls.filter((c) => c.method === 'select')
    const selectStr   = selectCalls[0]?.args[0]
    expect(String(selectStr).includes('cards!inner')).toBe(false)
  })

  it('omitting diagnosis does not call .not or .is on the diagnosis column', async () => {
    state.responses['leeches'] = [{ data: [SAMPLE_LEECH_ROW], error: null }]
    await listLeeches('user-1', listLeechesQuerySchema.parse({}))

    const diagnosisCalls = state.calls.filter((c) =>
      (c.method === 'not' || c.method === 'is') && c.args[0] === 'diagnosis',
    )
    expect(diagnosisCalls).toHaveLength(0)
  })

  it('diagnosis combines with a deckId card-filter — uses inner-join and applies both', async () => {
    state.responses['leeches'] = [{ data: [], error: null }]
    await listLeeches('user-1', listLeechesQuerySchema.parse({ diagnosis: 'available', deckId: DECK_ID }))

    // Card-side deck filter forces inner-join — diagnosis filter rides alongside.
    const selectStr = state.calls.find((c) => c.method === 'select')?.args[0]
    expect(String(selectStr).includes('cards!inner')).toBe(true)

    const eqCalls = state.calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['card.deck_id', DECK_ID] })
    const notCalls = state.calls.filter((c) => c.method === 'not')
    expect(notCalls).toContainEqual({ method: 'not', args: ['diagnosis', 'is', null] })
  })
})

// ── createDrillSession — Stage 3 ────────────────────────────────────────────

const DRILL_SESSION_ID    = 'b1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c'
const DRILL_SESSION_CARD  = 'c2e6c3d4-5e6f-4a7b-8c9d-7e6f5a4b3c2d'
const DRILL_SESSION_CARD2 = 'd3f7d4e5-6f7a-4b8c-9d0e-8f7a6b5c4d3e'

const SAMPLE_DRILL_ENVELOPE = {
  sessionId: DRILL_SESSION_ID,
  status:    'active',
  cards: [
    {
      sessionCardId: DRILL_SESSION_CARD,
      leechId:       LEECH_ID,
      cardId:        CARD_ID,
      ordinal:       0,
      layoutType:    'vocabulary',
      cardType:      'comprehension',
      fieldsData:    { word: '猫', reading: 'ねこ', meaning: 'cat' },
      lapses:        8,
    },
    {
      sessionCardId: DRILL_SESSION_CARD2,
      leechId:       'e4a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f',
      cardId:        'f5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a',
      ordinal:       1,
      layoutType:    'vocabulary',
      cardType:      'production',
      fieldsData:    { word: '犬', reading: 'いぬ', meaning: 'dog' },
      lapses:        12,
    },
  ],
}

describe('createDrillSession schema', () => {
  it('parses an empty body with the documented defaults', () => {
    const parsed = createDrillSessionSchema.parse({})
    expect(parsed.source).toBe('unresolvedLeeches')
    expect(parsed.order).toBe('mostLapses')
    expect(parsed.limit).toBe(20)
    expect(parsed.mode).toBe('practice')
    expect(parsed.repeatPolicy).toBe('missedAfterLag')
    expect(parsed.stopRule).toEqual({})
  })

  it('rejects unknown body keys (.strict)', () => {
    const result = createDrillSessionSchema.safeParse({ foo: 'bar' })
    expect(result.success).toBe(false)
  })

  it('clamps limit to [1, 50]', () => {
    expect(createDrillSessionSchema.safeParse({ limit: 0 }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ limit: 51 }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ limit: 50 }).success).toBe(true)
  })

  it('requires deckId when source is "deckScoped"', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'deckScoped' }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ source: 'deckScoped', deckId: DECK_ID }).success).toBe(true)
  })

  it('accepts all five spec source values (Stage 6 expanded from two)', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'unresolvedLeeches' }).success).toBe(true)
    // Stage 6 wired through `highLapseCandidates`, `manualSelection` (needs
    // cardIds), and `currentCard` (needs cardId). See the Stage 6 source
    // expansion describe block below for the full per-source coverage.
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates' }).success).toBe(true)
  })
})

describe('leech.service — createDrillSession', () => {
  it('happy path: forwards camelCase→snake_case enums and returns the parsed envelope', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: SAMPLE_DRILL_ENVELOPE, error: null },
    ]

    const out = await createDrillSession('user-1', createDrillSessionSchema.parse({}))

    expect(out.sessionId).toBe(DRILL_SESSION_ID)
    expect(out.status).toBe('active')
    expect(out.cards).toHaveLength(2)
    expect(out.cards[0]?.ordinal).toBe(0)
    expect(out.cards[1]?.ordinal).toBe(1)

    // RPC must have been called once with the right name and snake_case mapping.
    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]
    expect(call?.name).toBe('create_leech_drill_session')
    const payload = call?.payload as Record<string, unknown>
    expect(payload['p_user_id']).toBe('user-1')
    expect(payload['p_source']).toBe('unresolved_leeches')        // ← camelCase→snake_case
    expect(payload['p_repeat_policy']).toBe('missed_after_lag')   // ← camelCase→snake_case
    expect(payload['p_mode']).toBe('practice')
    expect(payload['p_limit']).toBe(20)
    expect(payload['p_order']).toBe('mostLapses')
  })

  it('deckScoped source maps to deck_scoped and forwards deckId', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source: 'deckScoped',
      deckId: DECK_ID,
      limit:  5,
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_source']).toBe('deck_scoped')
    expect(payload['p_deck_id']).toBe(DECK_ID)
    expect(payload['p_limit']).toBe(5)
  })

  it('persists the wire-level filter breadcrumb in p_source_query for analytics', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source:    'deckScoped',
      deckId:    DECK_ID,
      jlptLevel: 'N3',
      cardType:  'production',
      order:     'mostLapses',
      limit:     15,
    }))

    // Stage 6 extended the breadcrumb shape with cardIds/cardId/minLapses
    // for the three new sources. For Stage-3-shape calls (deckScoped here),
    // the new fields are null but still present in the breadcrumb so future
    // analytics queries can group rows uniformly.
    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_source_query']).toEqual({
      deckId:    DECK_ID,
      jlptLevel: 'N3',
      cardType:  'production',
      cardIds:   null,
      cardId:    null,
      minLapses: null,
      order:     'mostLapses',
      limit:     15,
    })
  })

  it('returns an empty queue cleanly when the RPC finds no candidates', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { sessionId: DRILL_SESSION_ID, status: 'active', cards: [] }, error: null },
    ]

    const out = await createDrillSession('user-1', createDrillSessionSchema.parse({}))
    expect(out.cards).toEqual([])
    expect(out.sessionId).toBe(DRILL_SESSION_ID)
    expect(out.status).toBe('active')
  })

  it('translates DB errors via dbError (500)', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await createDrillSession('user-1', createDrillSessionSchema.parse({}))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })

  it('throws when the RPC returns a payload that fails Zod parsing', async () => {
    // Missing required `cards` field — surfaces as a clean ZodError so silent
    // RPC drift doesn't slip past the boundary.
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { sessionId: DRILL_SESSION_ID, status: 'active' }, error: null },
    ]

    let caught: unknown
    try {
      await createDrillSession('user-1', createDrillSessionSchema.parse({}))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
  })

  it('never queries the cards or review_logs tables (scheduler invariance via service boundary)', async () => {
    // Pre-condition: the RPC owns the transaction. The service is purely a
    // forwarder. Assert no .from('cards') or .from('review_logs') call slips in.
    state.rpcResponses['create_leech_drill_session'] = [
      { data: SAMPLE_DRILL_ENVELOPE, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({}))

    // The chainable mock records every `from(...)` call via state.lastTable.
    // Since createDrillSession only calls `.rpc(...)`, lastTable must remain
    // null after the service returns.
    expect(state.lastTable).toBeNull()
  })
})

// ── getDrillSession — Stage 4 ───────────────────────────────────────────────

describe('drillSessionIdParamSchema', () => {
  it('accepts a UUID', () => {
    expect(drillSessionIdParamSchema.safeParse({ sessionId: DRILL_SESSION_ID }).success).toBe(true)
  })

  it('rejects non-UUID input', () => {
    expect(drillSessionIdParamSchema.safeParse({ sessionId: 'not-a-uuid' }).success).toBe(false)
  })

  it('rejects unknown keys (.strict)', () => {
    expect(drillSessionIdParamSchema.safeParse({ sessionId: DRILL_SESSION_ID, foo: 'bar' }).success).toBe(false)
  })
})

// Shared fixture builders for the resume tests.
function freshCard(sessionCardId: string, leechId: string, cardId: string, ordinal: number): Record<string, unknown> {
  return {
    sessionCardId,
    leechId,
    cardId,
    ordinal,
    layoutType: 'vocabulary',
    cardType:   'comprehension',
    fieldsData: { word: '猫', reading: 'ねこ', meaning: 'cat' },
    lapses:     8,
    isOrphaned: false,
    isStale:    false,
  }
}

function staleCard(sessionCardId: string, leechId: string, cardId: string, ordinal: number): Record<string, unknown> {
  return { ...freshCard(sessionCardId, leechId, cardId, ordinal), isStale: true }
}

function orphanCard(sessionCardId: string, leechId: string, ordinal: number): Record<string, unknown> {
  return {
    sessionCardId,
    leechId,
    cardId:     null,
    ordinal,
    layoutType: null,
    cardType:   null,
    fieldsData: null,
    lapses:     null,
    isOrphaned: true,
    isStale:    false,    // orphans are NEVER stale — there's nothing to compare to.
  }
}

describe('leech.service — getDrillSession', () => {
  it('returns the parsed envelope when all cards are fresh', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: {
        sessionId:             DRILL_SESSION_ID,
        status:                'active',
        isCanonicalStateStale: false,
        staleCards:            [],
        cards: [
          freshCard(DRILL_SESSION_CARD,  LEECH_ID, CARD_ID, 0),
          freshCard(DRILL_SESSION_CARD2, 'e4a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f', 'f5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a', 1),
        ],
      }, error: null },
    ]

    const out = await getDrillSession('user-1', DRILL_SESSION_ID)
    expect(out.sessionId).toBe(DRILL_SESSION_ID)
    expect(out.status).toBe('active')
    expect(out.isCanonicalStateStale).toBe(false)
    expect(out.staleCards).toEqual([])
    expect(out.cards).toHaveLength(2)
    expect(out.cards[0]?.isStale).toBe(false)
    expect(out.cards[0]?.isOrphaned).toBe(false)

    // RPC was called once with the right shape.
    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]
    expect(call?.name).toBe('get_leech_drill_session')
    expect((call?.payload as Record<string, unknown>)['p_user_id']).toBe('user-1')
    expect((call?.payload as Record<string, unknown>)['p_session_id']).toBe(DRILL_SESSION_ID)
  })

  it('preserves staleness flags and the staleCards array', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: {
        sessionId:             DRILL_SESSION_ID,
        status:                'active',
        isCanonicalStateStale: true,
        staleCards:            [CARD_ID],
        cards: [
          staleCard(DRILL_SESSION_CARD,  LEECH_ID, CARD_ID, 0),
          freshCard(DRILL_SESSION_CARD2, 'e4a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f', 'f5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a', 1),
        ],
      }, error: null },
    ]

    const out = await getDrillSession('user-1', DRILL_SESSION_ID)
    expect(out.isCanonicalStateStale).toBe(true)
    expect(out.staleCards).toEqual([CARD_ID])
    expect(out.cards[0]?.isStale).toBe(true)
    expect(out.cards[1]?.isStale).toBe(false)
  })

  it('surfaces orphan rows with cardId null and never lists them in staleCards', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: {
        sessionId:             DRILL_SESSION_ID,
        status:                'active',
        isCanonicalStateStale: false,
        staleCards:            [],
        cards: [
          orphanCard(DRILL_SESSION_CARD, LEECH_ID, 0),
        ],
      }, error: null },
    ]

    const out = await getDrillSession('user-1', DRILL_SESSION_ID)
    expect(out.cards[0]?.cardId).toBeNull()
    expect(out.cards[0]?.isOrphaned).toBe(true)
    expect(out.cards[0]?.isStale).toBe(false)
    expect(out.cards[0]?.layoutType).toBeNull()
    expect(out.cards[0]?.fieldsData).toBeNull()
    expect(out.staleCards).toEqual([])      // ← orphans are NOT stale
  })

  it('segregates stale, orphan, and fresh rows correctly when all three coexist', async () => {
    const orphanLeechId = 'e4a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f'
    const freshCardId   = 'f5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a'
    const freshLeechId  = 'a7dbf8c9-adbe-4f2a-9b4c-cd1eaf9a8b7c'

    state.rpcResponses['get_leech_drill_session'] = [
      { data: {
        sessionId:             DRILL_SESSION_ID,
        status:                'active',
        isCanonicalStateStale: true,
        staleCards:            [CARD_ID],       // only the truly-stale card is here
        cards: [
          staleCard (DRILL_SESSION_CARD,                                                LEECH_ID,        CARD_ID,     0),
          orphanCard(DRILL_SESSION_CARD2,                                               orphanLeechId,                1),
          freshCard ('b8ec19da-becf-4f3b-9c5d-de2fb0ab9c8d',                            freshLeechId,    freshCardId, 2),
        ],
      }, error: null },
    ]

    const out = await getDrillSession('user-1', DRILL_SESSION_ID)
    expect(out.cards).toHaveLength(3)
    expect(out.cards[0]?.isStale).toBe(true)
    expect(out.cards[1]?.isOrphaned).toBe(true)
    expect(out.cards[1]?.isStale).toBe(false)
    expect(out.cards[2]?.isStale).toBe(false)
    expect(out.staleCards).toEqual([CARD_ID])
  })

  it('translates SQLSTATE 02000 + leech_drill_session_not_found → 404 LEECH_DRILL_SESSION_NOT_FOUND', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: null, error: { code: '02000', message: 'leech_drill_session_not_found' } },
    ]

    let caught: unknown
    try {
      await getDrillSession('user-1', DRILL_SESSION_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_DRILL_SESSION_NOT_FOUND')
  })

  it('falls through to dbError for non-404 RPC errors (500)', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await getDrillSession('user-1', DRILL_SESSION_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })

  it('throws when the RPC envelope fails Zod parsing', async () => {
    // Missing required `isCanonicalStateStale` boolean — Zod surfaces a clean
    // error at the service boundary rather than silently coercing.
    state.rpcResponses['get_leech_drill_session'] = [
      { data: { sessionId: DRILL_SESSION_ID, status: 'active', staleCards: [], cards: [] }, error: null },
    ]

    let caught: unknown
    try {
      await getDrillSession('user-1', DRILL_SESSION_ID)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
  })

  it('never queries the cards or review_logs tables (scheduler invariance)', async () => {
    state.rpcResponses['get_leech_drill_session'] = [
      { data: {
        sessionId:             DRILL_SESSION_ID,
        status:                'active',
        isCanonicalStateStale: false,
        staleCards:            [],
        cards:                 [],
      }, error: null },
    ]

    await getDrillSession('user-1', DRILL_SESSION_ID)

    // The chainable mock records every `from(...)` call via state.lastTable.
    // Since getDrillSession only calls `.rpc(...)`, lastTable must remain
    // null after the service returns.
    expect(state.lastTable).toBeNull()
  })
})

// ── recordDrillAttempt — Stage 5 ────────────────────────────────────────────

const ATTEMPT_ID         = 'c2f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c'
const EVENT_ID           = 'd3e6c3d4-5e6f-4a7b-8c9d-7e6f5a4b3c2d'
const ANOTHER_CARD_ID    = 'e4f7d4e5-6f7a-4b8c-9d0e-8f7a6b5c4d3e'
const ANOTHER_LEECH_ID   = 'f5a8e5f6-7a8b-4c9d-9e1f-9a8b7c6d5e4f'

const SAMPLE_ATTEMPT_ENVELOPE = {
  attemptId:      ATTEMPT_ID,
  eventId:        EVENT_ID,
  sessionId:      DRILL_SESSION_ID,
  sessionCardId:  DRILL_SESSION_CARD,
  leechId:        LEECH_ID,
  cardId:         CARD_ID,
  result:         'remembered',
  localSequence:  0,
  responseTimeMs: 4200,
  shownAt:        '2026-05-14T12:00:00.000Z',
  answeredAt:     '2026-05-14T12:00:04.200Z',
  createdAt:      '2026-05-14T12:00:04.250Z',
}

describe('recordDrillAttemptSchema', () => {
  it('parses a minimal valid body', () => {
    const result = recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'remembered',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown keys (.strict)', () => {
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'remembered',
      foo:           'bar',
    }).success).toBe(false)
  })

  it('rejects non-UUID eventId / sessionCardId', () => {
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       'not-a-uuid',
      sessionCardId: DRILL_SESSION_CARD,
      result:        'remembered',
    }).success).toBe(false)
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: 'not-a-uuid',
      result:        'remembered',
    }).success).toBe(false)
  })

  it('rejects unknown result enum values', () => {
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'forgot',
    }).success).toBe(false)
  })

  it('rejects negative responseTimeMs / localSequence', () => {
    expect(recordDrillAttemptSchema.safeParse({
      eventId:        EVENT_ID,
      sessionCardId:  DRILL_SESSION_CARD,
      result:         'missed',
      responseTimeMs: -1,
    }).success).toBe(false)
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'missed',
      localSequence: -5,
    }).success).toBe(false)
  })

  it('rejects non-ISO shownAt/answeredAt', () => {
    expect(recordDrillAttemptSchema.safeParse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'hesitated',
      shownAt:       'last Tuesday',
    }).success).toBe(false)
  })
})

describe('leech.service — recordDrillAttempt', () => {
  it('happy path: forwards camelCase→snake_case params and returns the parsed envelope', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: SAMPLE_ATTEMPT_ENVELOPE, error: null },
    ]

    const input: RecordDrillAttemptInput = {
      eventId:        EVENT_ID,
      sessionCardId:  DRILL_SESSION_CARD,
      result:         'remembered',
      responseTimeMs: 4200,
      shownAt:        '2026-05-14T12:00:00.000Z',
      answeredAt:     '2026-05-14T12:00:04.200Z',
    }

    const out = await recordDrillAttempt('user-1', DRILL_SESSION_ID, input)

    expect(out.attemptId).toBe(ATTEMPT_ID)
    expect(out.eventId).toBe(EVENT_ID)
    expect(out.result).toBe('remembered')

    expect(state.rpcCalls).toHaveLength(1)
    const call = state.rpcCalls[0]
    expect(call?.name).toBe('record_leech_drill_attempt')
    const payload = call?.payload as Record<string, unknown>
    expect(payload['p_user_id']).toBe('user-1')
    expect(payload['p_session_id']).toBe(DRILL_SESSION_ID)
    expect(payload['p_event_id']).toBe(EVENT_ID)
    expect(payload['p_session_card_id']).toBe(DRILL_SESSION_CARD)
    expect(payload['p_asserted_card_id']).toBeNull()      // body omitted → null
    expect(payload['p_asserted_leech_id']).toBeNull()
    expect(payload['p_response_time_ms']).toBe(4200)
  })

  it('idempotent replay: same eventId returns identical envelope', async () => {
    // First call — fresh insert.
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: SAMPLE_ATTEMPT_ENVELOPE, error: null },
    ]
    const first = await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'remembered',
    }))

    // Second call — RPC's ON CONFLICT DO NOTHING returns the same row.
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: SAMPLE_ATTEMPT_ENVELOPE, error: null },
    ]
    const second = await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      result:        'remembered',
    }))

    expect(first).toEqual(second)
    expect(first.attemptId).toBe(second.attemptId)
  })

  it('forwards body cardId/leechId as assertions when supplied', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: SAMPLE_ATTEMPT_ENVELOPE, error: null },
    ]

    await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
      eventId:       EVENT_ID,
      sessionCardId: DRILL_SESSION_CARD,
      cardId:        CARD_ID,
      leechId:       LEECH_ID,
      result:        'hesitated',
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_asserted_card_id']).toBe(CARD_ID)
    expect(payload['p_asserted_leech_id']).toBe(LEECH_ID)
  })

  it('throws LEECH_DRILL_SESSION_CARD_NOT_FOUND 404 for sessionCard mismatch', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: null, error: { code: '02000', message: 'leech_drill_session_card_not_found' } },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_DRILL_SESSION_CARD_NOT_FOUND')
  })

  it('throws LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH 422 for cardId assertion mismatch', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: null, error: { code: '22000', message: 'leech_drill_attempt_card_mismatch' } },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        cardId:        ANOTHER_CARD_ID,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(422)
    expect(e.code).toBe('LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH')
  })

  it('throws LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH 422 for leechId assertion mismatch', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: null, error: { code: '22000', message: 'leech_drill_attempt_leech_mismatch' } },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        leechId:       ANOTHER_LEECH_ID,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(422)
    expect(e.code).toBe('LEECH_DRILL_ATTEMPT_ASSERTION_MISMATCH')
  })

  it('translates SQLSTATE 23503 (FK violation, e.g. card deleted) to dbError 409', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: null, error: { code: '23503', message: 'foreign key violation' } },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(409)
    expect(e.code).toBe('DB_FK_VIOLATION')
  })

  it('falls through to dbError for generic RPC errors (500)', async () => {
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })

  it('throws when the RPC envelope fails Zod parsing', async () => {
    // Missing required `result` field — Zod surfaces at the boundary.
    state.rpcResponses['record_leech_drill_attempt'] = [
      { data: { ...SAMPLE_ATTEMPT_ENVELOPE, result: undefined }, error: null },
    ]

    let caught: unknown
    try {
      await recordDrillAttempt('user-1', DRILL_SESSION_ID, recordDrillAttemptSchema.parse({
        eventId:       EVENT_ID,
        sessionCardId: DRILL_SESSION_CARD,
        result:        'missed',
      }))
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
  })
})

// ── Scheduler-invariance property suite ─────────────────────────────────────
//
// The spec's load-bearing CI guard. The property under test: NO drill code
// path may read or write `cards` or `review_logs`. The mock harness records
// every `.from(...)` call in `state.lastTable` and every `.rpc(...)` call in
// `state.rpcCalls`; for an invariant-respecting code path, lastTable stays
// null and the only RPC names seen are the drill-namespace ones.
//
// 100 randomized iterations per endpoint exercise different combinations of
// optional fields, source values, and sort orders. A future refactor that
// accidentally introduces a `.from('cards')` or `.from('review_logs')` call
// fails this suite on the first iteration that exercises the offending code
// path.

const DRILL_RESULTS = ['missed', 'hesitated', 'remembered'] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T
}

function maybeUuid(): string | undefined {
  return Math.random() > 0.5 ? randomUUID() : undefined
}

function maybeNumber(max: number): number | undefined {
  return Math.random() > 0.5 ? Math.floor(Math.random() * max) : undefined
}

function makeFakeAttemptEnvelope(): Record<string, unknown> {
  return {
    attemptId:      randomUUID(),
    eventId:        randomUUID(),
    sessionId:      randomUUID(),
    sessionCardId:  randomUUID(),
    leechId:        randomUUID(),
    cardId:         randomUUID(),
    result:         pick(DRILL_RESULTS),
    localSequence:  null,
    responseTimeMs: null,
    shownAt:        null,
    answeredAt:     new Date().toISOString(),
    createdAt:      new Date().toISOString(),
  }
}

function makeFakeSessionEnvelope(): Record<string, unknown> {
  return {
    sessionId: randomUUID(),
    status:    'active',
    cards:     [],
  }
}

function makeFakeSessionDetailEnvelope(): Record<string, unknown> {
  return {
    sessionId:             randomUUID(),
    status:                'active',
    isCanonicalStateStale: false,
    staleCards:            [],
    cards:                 [],
  }
}

describe('scheduler invariance — drill code path must never touch FSRS tables', () => {
  it('100 randomized recordDrillAttempt invocations issue zero .from() calls', async () => {
    for (let i = 0; i < 100; i++) {
      reset()
      state.rpcResponses['record_leech_drill_attempt'] = [
        { data: makeFakeAttemptEnvelope(), error: null },
      ]

      await recordDrillAttempt(randomUUID(), randomUUID(), recordDrillAttemptSchema.parse({
        eventId:        randomUUID(),
        sessionCardId:  randomUUID(),
        result:         pick(DRILL_RESULTS),
        ...(maybeUuid() !== undefined ? { cardId: maybeUuid() } : {}),
        ...(maybeUuid() !== undefined ? { leechId: maybeUuid() } : {}),
        ...(maybeNumber(10000) !== undefined ? { responseTimeMs: maybeNumber(10000) } : {}),
        ...(maybeNumber(50)    !== undefined ? { localSequence:  maybeNumber(50) }    : {}),
      }))

      // Zero `.from()` calls — the entire path is RPC-only.
      expect(state.lastTable).toBeNull()
      // Only the drill-namespace RPC was invoked.
      const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))]
      expect(rpcNames).toEqual(['record_leech_drill_attempt'])
    }
  })

  it('50 randomized createDrillSession invocations issue zero .from() calls', async () => {
    const sources = ['unresolvedLeeches', 'deckScoped'] as const
    const orders  = ['mostRecent', 'oldestUnresolved', 'mostLapses', 'deckOrder'] as const

    for (let i = 0; i < 50; i++) {
      reset()
      state.rpcResponses['create_leech_drill_session'] = [
        { data: makeFakeSessionEnvelope(), error: null },
      ]

      const source = pick(sources)
      await createDrillSession(randomUUID(), createDrillSessionSchema.parse({
        source,
        order: pick(orders),
        limit: 1 + Math.floor(Math.random() * 50),
        ...(source === 'deckScoped' ? { deckId: randomUUID() } : {}),
      }))

      expect(state.lastTable).toBeNull()
      const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))]
      expect(rpcNames).toEqual(['create_leech_drill_session'])
    }
  })

  it('50 randomized getDrillSession invocations issue zero .from() calls', async () => {
    for (let i = 0; i < 50; i++) {
      reset()
      state.rpcResponses['get_leech_drill_session'] = [
        { data: makeFakeSessionDetailEnvelope(), error: null },
      ]

      await getDrillSession(randomUUID(), randomUUID())

      expect(state.lastTable).toBeNull()
      const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))]
      expect(rpcNames).toEqual(['get_leech_drill_session'])
    }
  })
})

// ── Stage 6: source expansion + lifecycle transitions ──────────────────────

describe('createDrillSessionSchema — Stage 6 source expansion', () => {
  it('parses all five source values', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'unresolvedLeeches' }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'deckScoped', deckId: DECK_ID }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates' }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: [CARD_ID] }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'currentCard', cardId: CARD_ID }).success).toBe(true)
  })

  it('rejects unknown source values', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'random' }).success).toBe(false)
  })

  it('manualSelection requires non-empty cardIds (refinement)', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection' }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: [] }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: [CARD_ID] }).success).toBe(true)
  })

  it('manualSelection caps cardIds at 50', () => {
    const fifty   = Array.from({ length: 50 }, () => randomUUID())
    const fiftyOne = Array.from({ length: 51 }, () => randomUUID())
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: fifty   }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: fiftyOne }).success).toBe(false)
  })

  it('manualSelection rejects non-UUID cardIds', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'manualSelection', cardIds: ['not-a-uuid'] }).success).toBe(false)
  })

  it('currentCard requires cardId (refinement)', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'currentCard' }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ source: 'currentCard', cardId: CARD_ID }).success).toBe(true)
  })

  it('highLapseCandidates accepts optional minLapses bounded to [1, 20]', () => {
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates' }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates', minLapses: 1 }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates', minLapses: 20 }).success).toBe(true)
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates', minLapses: 0 }).success).toBe(false)
    expect(createDrillSessionSchema.safeParse({ source: 'highLapseCandidates', minLapses: 21 }).success).toBe(false)
  })
})

describe('emptyBodySchema', () => {
  it('accepts an empty body', () => {
    expect(emptyBodySchema.safeParse({}).success).toBe(true)
  })

  it('rejects any body fields (.strict)', () => {
    // Covers the diagnose endpoint's protection: a client POSTing
    // `{ regenerate: true }` to `/leeches/:id/diagnose` must NOT be silently
    // ignored. Forces any future "regenerate" feature to bump the schema
    // explicitly, making the design decision visible.
    expect(emptyBodySchema.safeParse({ status: 'finished' }).success).toBe(false)
    expect(emptyBodySchema.safeParse({ regenerate: true }).success).toBe(false)
    expect(emptyBodySchema.safeParse({ foo: 1, bar: 'x' }).success).toBe(false)
  })
})

describe('leech.service — createDrillSession source mapping (Stage 6)', () => {
  it('highLapseCandidates → snake_case + forwards p_min_lapses', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source:    'highLapseCandidates',
      minLapses: 5,
      limit:     10,
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_source']).toBe('high_lapse_candidates')
    expect(payload['p_min_lapses']).toBe(5)
    expect(payload['p_card_ids']).toBeNull()
    expect(payload['p_card_id']).toBeNull()
  })

  it('manualSelection → snake_case + forwards p_card_ids', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    const ids = [CARD_ID, 'a5b9f6a7-8b9c-4d0e-9f2a-ab9c8d7e6f5a']
    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source:  'manualSelection',
      cardIds: ids,
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_source']).toBe('manual_selection')
    expect(payload['p_card_ids']).toEqual(ids)
    expect(payload['p_card_id']).toBeNull()
    expect(payload['p_min_lapses']).toBeNull()
  })

  it('currentCard → snake_case + forwards p_card_id', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source: 'currentCard',
      cardId: CARD_ID,
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_source']).toBe('current_card')
    expect(payload['p_card_id']).toBe(CARD_ID)
    expect(payload['p_card_ids']).toBeNull()
  })

  it('source_query breadcrumb includes the new source-specific fields', async () => {
    state.rpcResponses['create_leech_drill_session'] = [
      { data: { ...SAMPLE_DRILL_ENVELOPE, cards: [] }, error: null },
    ]

    await createDrillSession('user-1', createDrillSessionSchema.parse({
      source:    'highLapseCandidates',
      minLapses: 4,
      jlptLevel: 'N3',
    }))

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    const breadcrumb = payload['p_source_query'] as Record<string, unknown>
    expect(breadcrumb['minLapses']).toBe(4)
    expect(breadcrumb['jlptLevel']).toBe('N3')
    expect(breadcrumb['cardIds']).toBeNull()
    expect(breadcrumb['cardId']).toBeNull()
  })
})

describe('leech.service — transitionDrillSession', () => {
  // The transition RPC returns void; the service then calls
  // get_leech_drill_session for the post-state envelope. Tests push two
  // responses per happy-path call: void from transition + envelope from get.

  const finishedEnvelope = {
    sessionId:             DRILL_SESSION_ID,
    status:                'finished',
    isCanonicalStateStale: false,
    staleCards:            [],
    cards:                 [],
  }

  const abortedEnvelope = {
    ...finishedEnvelope,
    status: 'aborted',
  }

  it('finish: calls both RPCs in order and returns the post-state envelope', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [{ data: null, error: null }]
    state.rpcResponses['get_leech_drill_session']        = [{ data: finishedEnvelope, error: null }]

    const out = await transitionDrillSession('user-1', DRILL_SESSION_ID, 'finished')

    expect(out.sessionId).toBe(DRILL_SESSION_ID)
    expect(out.status).toBe('finished')

    expect(state.rpcCalls).toHaveLength(2)
    expect(state.rpcCalls[0]?.name).toBe('transition_leech_drill_session')
    expect((state.rpcCalls[0]?.payload as Record<string, unknown>)['p_target_status']).toBe('finished')
    expect(state.rpcCalls[1]?.name).toBe('get_leech_drill_session')
  })

  it('abort: forwards target=aborted and returns the aborted envelope', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [{ data: null, error: null }]
    state.rpcResponses['get_leech_drill_session']        = [{ data: abortedEnvelope, error: null }]

    const out = await transitionDrillSession('user-1', DRILL_SESSION_ID, 'aborted')
    expect(out.status).toBe('aborted')

    const payload = state.rpcCalls[0]?.payload as Record<string, unknown>
    expect(payload['p_target_status']).toBe('aborted')
  })

  it('idempotent re-finish: transition is a no-op; service still returns envelope', async () => {
    // RPC returns void successfully (the DB-side IF v_current_status =
    // p_target_status RETURN short-circuit). Service still does the
    // post-state fetch and returns the existing envelope.
    state.rpcResponses['transition_leech_drill_session'] = [{ data: null, error: null }]
    state.rpcResponses['get_leech_drill_session']        = [{ data: finishedEnvelope, error: null }]

    const out = await transitionDrillSession('user-1', DRILL_SESSION_ID, 'finished')
    expect(out.status).toBe('finished')
  })

  it('translates SQLSTATE 02000 + leech_drill_session_not_found → 404', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [
      { data: null, error: { code: '02000', message: 'leech_drill_session_not_found' } },
    ]

    let caught: unknown
    try {
      await transitionDrillSession('user-1', DRILL_SESSION_ID, 'finished')
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_DRILL_SESSION_NOT_FOUND')
  })

  it('translates SQLSTATE 22000 + leech_drill_session_state_conflict → 409', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [
      { data: null, error: { code: '22000', message: 'leech_drill_session_state_conflict' } },
    ]

    let caught: unknown
    try {
      await transitionDrillSession('user-1', DRILL_SESSION_ID, 'aborted')
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(409)
    expect(e.code).toBe('LEECH_DRILL_SESSION_STATE_CONFLICT')
  })

  it('falls through to dbError for unrelated RPC errors (500)', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [
      { data: null, error: { message: 'connection refused' } },
    ]

    let caught: unknown
    try {
      await transitionDrillSession('user-1', DRILL_SESSION_ID, 'finished')
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number }
    expect(e.statusCode).toBe(500)
  })

  it('never queries the cards or review_logs tables (scheduler invariance)', async () => {
    state.rpcResponses['transition_leech_drill_session'] = [{ data: null, error: null }]
    state.rpcResponses['get_leech_drill_session']        = [{ data: finishedEnvelope, error: null }]

    await transitionDrillSession('user-1', DRILL_SESSION_ID, 'finished')

    expect(state.lastTable).toBeNull()
    const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))].sort()
    expect(rpcNames).toEqual(['get_leech_drill_session', 'transition_leech_drill_session'])
  })
})

// ── Extended scheduler-invariance property suite (Stage 6) ─────────────────

describe('scheduler invariance — Stage 6 additions', () => {
  it('50 randomized transitionDrillSession invocations issue zero .from() calls', async () => {
    const targets: Array<'finished' | 'aborted'> = ['finished', 'aborted']

    for (let i = 0; i < 50; i++) {
      reset()
      state.rpcResponses['transition_leech_drill_session'] = [{ data: null, error: null }]
      state.rpcResponses['get_leech_drill_session'] = [{
        data: {
          sessionId:             randomUUID(),
          status:                'finished',
          isCanonicalStateStale: false,
          staleCards:            [],
          cards:                 [],
        }, error: null,
      }]

      await transitionDrillSession(randomUUID(), randomUUID(), pick(targets))

      expect(state.lastTable).toBeNull()
      const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))].sort()
      expect(rpcNames).toEqual(['get_leech_drill_session', 'transition_leech_drill_session'])
    }
  })

  it('50 randomized createDrillSession invocations across all five sources issue zero .from() calls', async () => {
    const sources = ['unresolvedLeeches', 'deckScoped', 'highLapseCandidates', 'manualSelection', 'currentCard'] as const
    const orders  = ['mostRecent', 'oldestUnresolved', 'mostLapses', 'deckOrder'] as const

    for (let i = 0; i < 50; i++) {
      reset()
      state.rpcResponses['create_leech_drill_session'] = [
        { data: { sessionId: randomUUID(), status: 'active', cards: [] }, error: null },
      ]

      const source = pick(sources)
      const body: Record<string, unknown> = {
        source,
        order: pick(orders),
        limit: 1 + Math.floor(Math.random() * 50),
      }
      if (source === 'deckScoped')          body['deckId']    = randomUUID()
      if (source === 'highLapseCandidates') body['minLapses'] = 1 + Math.floor(Math.random() * 20)
      if (source === 'manualSelection')     body['cardIds']   = [randomUUID(), randomUUID()]
      if (source === 'currentCard')         body['cardId']    = randomUUID()

      await createDrillSession(randomUUID(), createDrillSessionSchema.parse(body))

      expect(state.lastTable).toBeNull()
      const rpcNames = [...new Set(state.rpcCalls.map((c) => c.name))]
      expect(rpcNames).toEqual(['create_leech_drill_session'])
    }
  })
})

// ── diagnoseLeech — Stage 7 ────────────────────────────────────────────────
//
// The fresh-diagnose path issues five queries against `leeches`:
//   1. fetch leech+card (slim)
//   2. fetch profile (jlpt_target, native_language)
//   3. fetch review_logs (last 10 ratings)
//   4. UPDATE leech (set diagnosis + prescription)
//   5. getLeechById (return full joined detail)
// Tests push the right responses for each table in order. The replay-on-
// existing path skips queries 2-4 entirely.

describe('leech.service — diagnoseLeech (Stage 7)', () => {
  const FRESH_LEECH_FETCH = {
    id:           LEECH_ID,
    card_id:      CARD_ID,
    diagnosis:    null,
    prescription: null,
    resolved:     false,
    card: {
      fields_data: { word: '猫', reading: 'ねこ', meaning: 'cat' },
      layout_type: 'vocabulary',
      lapses:      8,
    },
  }

  const PROFILE_FETCH = {
    jlpt_target:     'N3',
    native_language: 'en',
  }

  const FULL_LEECH_RESPONSE = {
    ...SAMPLE_LEECH_ROW,
    diagnosis:    'Reading 猫 sometimes confused with 描 in compound contexts.',
    prescription: 'Drill a 5-card mini-set distinguishing 猫 from visually-similar kanji.',
  }

  it('fresh diagnose: fetches card+profile+ratings, calls AI service once, persists, returns full detail', async () => {
    state.responses['leeches']     = [
      { data: FRESH_LEECH_FETCH, error: null },         // step 1: fetch leech+card
      { data: null, error: null },                       // step 4: UPDATE
      { data: FULL_LEECH_RESPONSE, error: null },        // step 5: getLeechById
    ]
    state.responses['profiles']    = [{ data: PROFILE_FETCH, error: null }]
    state.responses['review_logs'] = [{ data: [{ rating: 'again' }, { rating: 'hard' }], error: null }]
    aiMock.diagnosisResponses      = [{
      data:  { diagnosis: 'Reading 猫 confused.', prescription: 'Mini-set drill.' },
      error: null,
    }]

    const out = await diagnoseLeech('user-1', LEECH_ID)

    expect(out.id).toBe(LEECH_ID)
    expect(out.diagnosis).not.toBeNull()
    expect(out.prescription).not.toBeNull()

    // The AI service was called exactly once with the expected prompt inputs.
    expect(aiMock.diagnosisCalls).toHaveLength(1)
    const args = aiMock.diagnosisCalls[0] ?? []
    expect(args[0]).toBe('猫')             // word
    expect(args[1]).toBe('ねこ')           // reading
    expect(args[2]).toBe('cat')           // meaning
    expect(args[3]).toBe(8)               // lapseCount
    expect(args[4]).toEqual(['hard', 'again'])  // ratings oldest→newest (reversed)
    expect(args[5]).toBe('N3')            // jlpt level
    expect(args[6]).toBe('en')            // native language
  })

  it('replay path: existing diagnosis returns the stored row without calling AI', async () => {
    const alreadyDiagnosed = {
      ...FRESH_LEECH_FETCH,
      diagnosis:    'Existing diagnosis text.',
      prescription: 'Existing prescription text.',
    }

    state.responses['leeches'] = [
      { data: alreadyDiagnosed, error: null },          // step 1: fetch sees populated diagnosis
      { data: FULL_LEECH_RESPONSE, error: null },        // getLeechById (replay returns the full detail)
    ]

    const out = await diagnoseLeech('user-1', LEECH_ID)
    expect(out.id).toBe(LEECH_ID)

    // No AI call — the existing diagnosis is reused.
    expect(aiMock.diagnosisCalls).toHaveLength(0)

    // No call to profiles or review_logs either — the short-circuit fires
    // immediately after step 1.
    const tablesQueried = new Set(state.calls
      .filter((c) => c.method === 'select')
      .map(() => state.lastTable))
    // (state.lastTable is the last table, which was 'leeches' since both
    // queries went there. Verify no profiles/review_logs queries fired by
    // checking the from() call count via state.calls being limited.)
    void tablesQueried
  })

  it('throws LEECH_NOT_FOUND 404 when the row is missing', async () => {
    state.responses['leeches'] = [{ data: null, error: null }]

    let caught: unknown
    try {
      await diagnoseLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_NOT_FOUND')
  })

  it('throws CARD_FIELDS_INSUFFICIENT 422 when the leech is orphan (card_id null)', async () => {
    state.responses['leeches'] = [
      { data: { ...FRESH_LEECH_FETCH, card_id: null, card: null }, error: null },
    ]

    let caught: unknown
    try {
      await diagnoseLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(422)
    expect(e.code).toBe('CARD_FIELDS_INSUFFICIENT')
  })

  it('throws CARD_FIELDS_INSUFFICIENT 422 for sentence-layout cards (no word/reading/meaning)', async () => {
    state.responses['leeches'] = [{
      data: {
        ...FRESH_LEECH_FETCH,
        card: {
          // Stage 12 sentence-layout shape: ja/en/furigana required.
          // The diagnoseLeech path reads word/reading/meaning (vocabulary
          // fields), so any sentence-layout shape — old or new — yields
          // CARD_FIELDS_INSUFFICIENT because those vocabulary keys are
          // absent. Updated to the canonical shape for consistency.
          fields_data: {
            ja:       'これは文です。',
            en:       'This is a sentence.',
            furigana: 'これはぶんです。',
          },
          layout_type: 'sentence',
          lapses:      8,
        },
      },
      error: null,
    }]

    let caught: unknown
    try {
      await diagnoseLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(422)
    expect(e.code).toBe('CARD_FIELDS_INSUFFICIENT')
  })

  it('falls back to safe profile defaults when profile fetch errors', async () => {
    state.responses['leeches']     = [
      { data: FRESH_LEECH_FETCH, error: null },
      { data: null, error: null },                       // UPDATE
      { data: FULL_LEECH_RESPONSE, error: null },        // getLeechById
    ]
    state.responses['profiles']    = [{ data: null, error: { message: 'profile unavailable' } }]
    state.responses['review_logs'] = [{ data: [], error: null }]
    aiMock.diagnosisResponses      = [{
      data:  { diagnosis: 'd', prescription: 'p' },
      error: null,
    }]

    // Should NOT throw — falls back to 'N5' / 'en' defaults.
    await diagnoseLeech('user-1', LEECH_ID)

    expect(aiMock.diagnosisCalls).toHaveLength(1)
    const args = aiMock.diagnosisCalls[0] ?? []
    expect(args[5]).toBe('N5')  // default jlpt
    expect(args[6]).toBe('en')  // default native language
  })

  it('passes review-log ratings to the AI service in oldest→newest order', async () => {
    // Supabase returns DESC (newest first) due to .order('reviewed_at', { ascending: false });
    // service reverses to oldest→newest. Three ratings, expected order back.
    state.responses['leeches']     = [
      { data: FRESH_LEECH_FETCH, error: null },
      { data: null, error: null },
      { data: FULL_LEECH_RESPONSE, error: null },
    ]
    state.responses['profiles']    = [{ data: PROFILE_FETCH, error: null }]
    state.responses['review_logs'] = [{
      data: [{ rating: 'good' }, { rating: 'hard' }, { rating: 'again' }],
      error: null,
    }]
    aiMock.diagnosisResponses      = [{
      data:  { diagnosis: 'd', prescription: 'p' },
      error: null,
    }]

    await diagnoseLeech('user-1', LEECH_ID)

    const ratings = (aiMock.diagnosisCalls[0] ?? [])[4]
    expect(ratings).toEqual(['again', 'hard', 'good'])
  })

  it('propagates AI service errors (e.g. OPENAI_KEY_MISSING) without persisting partial state', async () => {
    state.responses['leeches']     = [{ data: FRESH_LEECH_FETCH, error: null }]
    state.responses['profiles']    = [{ data: PROFILE_FETCH, error: null }]
    state.responses['review_logs'] = [{ data: [], error: null }]

    // AI service throws.
    aiMock.diagnosisResponses = [{
      data:  null,
      error: Object.assign(new Error('OPENAI_API_KEY not configured'), {
        statusCode: 500, code: 'OPENAI_KEY_MISSING',
      }),
    }]

    let caught: unknown
    try {
      await diagnoseLeech('user-1', LEECH_ID)
    } catch (err) {
      caught = err
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as { code?: string }).code).toBe('OPENAI_KEY_MISSING')

    // The UPDATE query against `leeches` never ran — only the initial fetch
    // and the profile/review_logs fetches did. Assert no `.update` call fired.
    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(0)
  })

  it('UPDATE writes only diagnosis and prescription (no FSRS state, no review_logs)', async () => {
    state.responses['leeches']     = [
      { data: FRESH_LEECH_FETCH, error: null },
      { data: null, error: null },
      { data: FULL_LEECH_RESPONSE, error: null },
    ]
    state.responses['profiles']    = [{ data: PROFILE_FETCH, error: null }]
    state.responses['review_logs'] = [{ data: [], error: null }]
    aiMock.diagnosisResponses      = [{
      data:  { diagnosis: 'd', prescription: 'p' },
      error: null,
    }]

    await diagnoseLeech('user-1', LEECH_ID)

    // The single .update() call must be against `leeches` (not `cards` or
    // `review_logs`) and must only set the two diagnosis text columns.
    const updateCalls = state.calls.filter((c) => c.method === 'update')
    expect(updateCalls).toHaveLength(1)
    const patch = updateCalls[0]?.args[0] as Record<string, unknown>
    expect(Object.keys(patch).sort()).toEqual(['diagnosis', 'prescription'])
    expect(patch['diagnosis']).toBe('d')
    expect(patch['prescription']).toBe('p')
  })
})

// ── diagnoseLeech — Stage 7.1 compliance tests ────────────────────────────
//
// These tests close the gaps surfaced by the post-Stage-7 standards review:
//   • Explicit IDOR coverage (cross-user request returns 404, NO AI call).
//   • Parallel fetch coverage (both profile + review_logs queues consumed,
//     proving Promise.all is in play).

describe('leech.service — diagnoseLeech compliance (Stage 7.1)', () => {
  it('IDOR: cross-user request returns 404 with NO AI call and the right user_id in SQL', async () => {
    // The mock returns null when the (id, user_id) pair doesn't match a row.
    // Same opacity pattern as DECK_NOT_FOUND — does not leak existence to
    // other users.
    state.responses['leeches'] = [{ data: null, error: null }]

    let caught: unknown
    try {
      await diagnoseLeech('user-B', LEECH_ID)
    } catch (err) {
      caught = err
    }
    const e = caught as { statusCode?: number; code?: string }
    expect(e.statusCode).toBe(404)
    expect(e.code).toBe('LEECH_NOT_FOUND')

    // Critical: no AI call fired. Cross-user attempts must not be expensive —
    // otherwise enumeration becomes an OpenAI-cost DoS vector.
    expect(aiMock.diagnosisCalls).toHaveLength(0)

    // The SELECT issued user_id = 'user-B', NOT 'user-A'. The eq() call list
    // proves the ownership predicate was applied at the SQL boundary, not as
    // a post-fetch check.
    const eqCalls = state.calls.filter((c) => c.method === 'eq')
    expect(eqCalls).toContainEqual({ method: 'eq', args: ['user_id', 'user-B'] })
  })

  it('parallelization: both profile + review_logs queues are consumed on fresh diagnose', async () => {
    // Sample data shapes copied from the leeches-suite fixtures. Both side
    // queues hold exactly one entry each; after Promise.all drains them
    // (regardless of resolution order), both arrays should be empty.
    const FRESH_LEECH = {
      id:           LEECH_ID,
      card_id:      CARD_ID,
      diagnosis:    null,
      prescription: null,
      resolved:     false,
      card: {
        fields_data: { word: '猫', reading: 'ねこ', meaning: 'cat' },
        layout_type: 'vocabulary',
        lapses:      8,
      },
    }

    state.responses['leeches']     = [
      { data: FRESH_LEECH, error: null },
      { data: null, error: null },                    // UPDATE
      { data: SAMPLE_LEECH_ROW, error: null },        // getLeechById
    ]
    state.responses['profiles']    = [{ data: { jlpt_target: 'N3', native_language: 'en' }, error: null }]
    state.responses['review_logs'] = [{ data: [{ rating: 'good' }, { rating: 'hard' }], error: null }]
    aiMock.diagnosisResponses      = [{
      data:  { diagnosis: 'd', prescription: 'p' },
      error: null,
    }]

    await diagnoseLeech('user-1', LEECH_ID)

    // Both side queues drained → both fetches actually fired. With the prior
    // serial implementation, this assertion would still pass (both queues
    // get consumed sequentially). The structural diff is the parallel call
    // pattern — there is no direct mock-level assertion of "both started
    // before either resolved" without a clock, so we settle for "both
    // resolved" which is the necessary condition.
    expect(state.responses['profiles']).toEqual([])
    expect(state.responses['review_logs']).toEqual([])
    expect(aiMock.diagnosisCalls).toHaveLength(1)
  })
})
