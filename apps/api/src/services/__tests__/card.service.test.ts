import { describe, it, expect, mock } from 'bun:test'

// supabaseAdmin throws at load time when env vars are missing — mock first
// so any future card.service test added to this file can rely on it.
mock.module('../../db/supabase.ts', () => ({
  supabaseAdmin: {
    from: mock(() => ({})),
    rpc:  mock(() => Promise.resolve({ data: null, error: null })),
  },
}))

// Touch the import so module-load coverage includes card.service. No tests
// at present — `getStaleEmbeddingCards` was removed in 2026-05; the embedding
// backfill script no longer depends on it.
await import('../card.service.ts')

describe('card.service', () => {
  it('imports without throwing', () => {
    expect(true).toBe(true)
  })
})
