import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { createHash } from 'node:crypto'

import { createSupabaseHarness } from '../../../tests/support'

// withIdempotency talks to three SECURITY DEFINER RPCs (claim / store / delete
// idempotency_key). The shared Supabase harness lets us drive each branch of
// the claim state machine and assert which follow-up RPC (store vs delete) the
// worker-failure paths choose — the behavior that decides whether a retry
// replays a result, replays an error, or is allowed to re-run.
const sb = createSupabaseHarness()
mock.module('../../db/supabase.ts', () => ({ supabaseAdmin: sb.supabaseAdmin }))

const { withIdempotency } = await import('../idempotency.ts')
const { AppError } = await import('../../middleware/errorHandler.ts')

beforeEach(() => { sb.reset() })

const VALID_KEY = 'a1f5b2c3-4d5e-4f6a-9b8c-7d6e5f4a3b2c'

/** Queue a claim_idempotency_key RPC result with the given state-machine row. */
function queueClaim(row: { status: string; stored_status: number | null; stored_body: unknown }): void {
  sb.state.rpcResponses['claim_idempotency_key'] = [{ data: [row], error: null }]
}

function findRpc(name: string): { name: string; payload: unknown } | undefined {
  return sb.state.rpcCalls.find((c) => c.name === name)
}

// ── Header validation (runs before any DB round-trip) ───────────────────────

describe('withIdempotency — header validation', () => {
  it('throws 400 IDEMPOTENCY_KEY_REQUIRED and never runs the worker when the header is absent', async () => {
    const worker = mock(async () => ({ status: 201, body: { id: 'x' } }))

    await expect(withIdempotency('user-1', undefined, { rating: 'good' }, worker))
      .rejects.toMatchObject({ statusCode: 400, code: 'IDEMPOTENCY_KEY_REQUIRED' })

    expect(worker).not.toHaveBeenCalled()
    expect(findRpc('claim_idempotency_key')).toBeUndefined()
  })

  it('throws 400 IDEMPOTENCY_KEY_INVALID and never runs the worker for a non-UUID key', async () => {
    const worker = mock(async () => ({ status: 201, body: { id: 'x' } }))

    await expect(withIdempotency('user-1', 'not-a-uuid', {}, worker))
      .rejects.toMatchObject({ statusCode: 400, code: 'IDEMPOTENCY_KEY_INVALID' })

    expect(worker).not.toHaveBeenCalled()
    expect(findRpc('claim_idempotency_key')).toBeUndefined()
  })
})

// ── Claim state machine ─────────────────────────────────────────────────────

describe('withIdempotency — claim outcomes', () => {
  it('hashes the JSON payload into p_request_hash and forwards the user + key to the claim RPC', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })
    const payload = { rating: 'good', cardId: 'c1' }

    await withIdempotency('user-9', VALID_KEY, payload, async () => ({ status: 200, body: {} }))

    const claim = findRpc('claim_idempotency_key')
    const args = claim?.payload as Record<string, unknown>
    expect(args['p_user_id']).toBe('user-9')
    expect(args['p_key']).toBe(VALID_KEY)
    // The hash is what the RPC compares server-side to decide replay vs conflict;
    // pin it so a regression in how the request fingerprint is built fails here.
    expect(args['p_request_hash']).toBe(createHash('sha256').update(JSON.stringify(payload)).digest('hex'))
  })

  it('runs the worker once on a fresh key and stores its {status, body} for future replays', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })
    const worker = mock(async () => ({ status: 201, body: { id: 'card-1' } }))

    const result = await withIdempotency('user-1', VALID_KEY, {}, worker)

    expect(result).toEqual({ status: 201, body: { id: 'card-1' } })
    expect(worker).toHaveBeenCalledTimes(1)

    const store = findRpc('store_idempotency_response')
    expect(store).toBeDefined()
    const args = store?.payload as Record<string, unknown>
    expect(args['p_status']).toBe(201)
    expect(args['p_body']).toEqual({ id: 'card-1' })
    expect(findRpc('delete_idempotency_key')).toBeUndefined()
  })

  it('returns the stored response on a replay without running the worker', async () => {
    queueClaim({ status: 'replay', stored_status: 200, stored_body: { id: 'card-1' } })
    const worker = mock(async () => ({ status: 201, body: { id: 'should-not-run' } }))

    const result = await withIdempotency('user-1', VALID_KEY, {}, worker)

    expect(result).toEqual({ status: 200, body: { id: 'card-1' } })
    expect(worker).not.toHaveBeenCalled()
    expect(findRpc('store_idempotency_response')).toBeUndefined()
  })

  it('defaults a replay with a null stored_status to 200', async () => {
    queueClaim({ status: 'replay', stored_status: null, stored_body: { ok: true } })

    const result = await withIdempotency('user-1', VALID_KEY, {}, async () => ({ status: 500, body: {} }))

    expect(result.status).toBe(200)
    expect(result.body).toEqual({ ok: true })
  })

  it('throws 422 IDEMPOTENCY_KEY_CONFLICT when the same key is reused with a different body', async () => {
    queueClaim({ status: 'conflict', stored_status: null, stored_body: null })
    const worker = mock(async () => ({ status: 201, body: {} }))

    await expect(withIdempotency('user-1', VALID_KEY, {}, worker))
      .rejects.toMatchObject({ statusCode: 422, code: 'IDEMPOTENCY_KEY_CONFLICT' })
    expect(worker).not.toHaveBeenCalled()
  })

  it('throws 409 IDEMPOTENCY_IN_FLIGHT while a prior call with the same key is still processing', async () => {
    queueClaim({ status: 'in_flight', stored_status: null, stored_body: null })
    const worker = mock(async () => ({ status: 201, body: {} }))

    await expect(withIdempotency('user-1', VALID_KEY, {}, worker))
      .rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_IN_FLIGHT' })
    expect(worker).not.toHaveBeenCalled()
  })

  it('throws 500 IDEMPOTENCY_CLAIM_FAILED when the claim RPC errors', async () => {
    sb.state.rpcResponses['claim_idempotency_key'] = [{ data: null, error: { message: 'boom', code: 'XX000' } }]
    const worker = mock(async () => ({ status: 201, body: {} }))

    await expect(withIdempotency('user-1', VALID_KEY, {}, worker))
      .rejects.toMatchObject({ statusCode: 500, code: 'IDEMPOTENCY_CLAIM_FAILED' })
    expect(worker).not.toHaveBeenCalled()
  })
})

// ── Worker-failure replay policy ────────────────────────────────────────────

describe('withIdempotency — worker failure policy', () => {
  it('stores the error response (so retries replay it) when the worker throws a 4xx AppError', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })

    await expect(
      withIdempotency('user-1', VALID_KEY, {}, async () => {
        throw new AppError(422, 'Card is in an archived deck', { code: 'DECK_ARCHIVED' })
      }),
    ).rejects.toMatchObject({ statusCode: 422, code: 'DECK_ARCHIVED' })

    // 4xx is deterministic for the same input ⇒ stored and replayed, not released.
    const store = findRpc('store_idempotency_response')
    expect(store).toBeDefined()
    const args = store?.payload as Record<string, unknown>
    expect(args['p_status']).toBe(422)
    expect(args['p_body']).toEqual({ error: 'Card is in an archived deck' })
    expect(findRpc('delete_idempotency_key')).toBeUndefined()
  })

  it('releases the placeholder (so retries can re-run) when the worker throws a 5xx AppError', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })

    await expect(
      withIdempotency('user-1', VALID_KEY, {}, async () => {
        throw new AppError(503, 'Upstream temporarily unavailable', { code: 'UPSTREAM_DOWN' })
      }),
    ).rejects.toMatchObject({ statusCode: 503 })

    // 5xx is transient ⇒ delete the placeholder so a retry isn't blocked for 24h.
    expect(findRpc('delete_idempotency_key')).toBeDefined()
    expect(findRpc('store_idempotency_response')).toBeUndefined()
  })

  it('releases the placeholder when the worker throws a non-AppError', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })

    await expect(
      withIdempotency('user-1', VALID_KEY, {}, async () => {
        throw new Error('unexpected boom')
      }),
    ).rejects.toThrow('unexpected boom')

    expect(findRpc('delete_idempotency_key')).toBeDefined()
    expect(findRpc('store_idempotency_response')).toBeUndefined()
  })

  it('still propagates the original 4xx when persisting the error response itself fails', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })
    sb.state.rpcResponses['store_idempotency_response'] = [{ data: null, error: { message: 'store failed' } }]

    // The store is best-effort: its failure is logged, never masks the worker's
    // original 4xx.
    await expect(
      withIdempotency('user-1', VALID_KEY, {}, async () => {
        throw new AppError(422, 'conflict', { code: 'X' })
      }),
    ).rejects.toMatchObject({ statusCode: 422 })
  })

  it('still propagates the original 5xx when releasing the placeholder itself fails', async () => {
    queueClaim({ status: 'fresh', stored_status: null, stored_body: null })
    sb.state.rpcResponses['delete_idempotency_key'] = [{ data: null, error: { message: 'delete failed' } }]

    await expect(
      withIdempotency('user-1', VALID_KEY, {}, async () => {
        throw new AppError(503, 'upstream down', { code: 'Y' })
      }),
    ).rejects.toMatchObject({ statusCode: 503 })
  })
})
