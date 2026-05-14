import { describe, it, expect, mock, beforeEach } from 'bun:test'

import {
  listLeechesQuerySchema,
  leechIdParamSchema,
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
}

const state: MockState = {
  responses:    {},
  calls:        [],
  lastTable:    null,
  terminalShape: 'list',
}

function reset(): void {
  state.responses    = {}
  state.calls        = []
  state.lastTable    = null
  state.terminalShape = 'list'
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
    rpc: mock(async () => ({ data: null, error: null })),
  },
}))

const { listLeeches, getLeechById, toListItem, resolveLeech, reopenLeech } = await import('../leech.service.ts')
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
