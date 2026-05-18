import { describe, it, expect } from 'bun:test'

// Pure-helper coverage for tomo-note.service. Backend Completion Plan
// Stage 6. The async getTomoNote path is exercised by the integration test
// (apps/api/tests/integration/tomo.routes.test.ts) — those tests need real
// Supabase + Redis, which the unit harness does not provide. Here we cover
// the two pure helpers that determine the cache-key day boundary and the
// deterministic idiom selection.

// No db/redis touched by these helpers — they're pure. We pre-set the
// envs the api code expects at module load (mirroring tests/setup.ts) so
// the supabase.ts module-load doesn't throw if the helper file's import
// chain reaches it.
process.env['OPENAI_API_KEY']            ??= 'sk-test-dummy'
process.env['UPSTASH_REDIS_REST_URL']    ??= 'https://test-redis'
process.env['UPSTASH_REDIS_REST_TOKEN']  ??= 'test-token'
process.env['SUPABASE_URL']              ??= 'https://test-supabase'
process.env['SUPABASE_SERVICE_ROLE_KEY'] ??= 'test-service-role-key'

const { todayDateKey, yesterdayDateKey, pickIdiomBody } =
  await import('../tomo-note.service.ts')

describe('tomo-note.service — todayDateKey', () => {
  it('returns YYYY-MM-DD in the given timezone (UTC)', () => {
    const result = todayDateKey('UTC')
    // Sanity: matches the ISO date shape.
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a valid ISO date for a non-UTC timezone (Tokyo)', () => {
    const result = todayDateKey('Asia/Tokyo')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns the same shape regardless of timezone (the value can differ by 1 day around midnight)', () => {
    // We can't deterministically assert one vs the other without freezing
    // time, but both must be valid ISO dates.
    expect(todayDateKey('America/Los_Angeles')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(todayDateKey('Pacific/Auckland')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('tomo-note.service — yesterdayDateKey', () => {
  it('rolls back one day across a month boundary', () => {
    expect(yesterdayDateKey('2026-03-01')).toBe('2026-02-28')
  })

  it('rolls back one day across a year boundary', () => {
    expect(yesterdayDateKey('2026-01-01')).toBe('2025-12-31')
  })

  it('handles leap-year math (2024-03-01 → 2024-02-29)', () => {
    expect(yesterdayDateKey('2024-03-01')).toBe('2024-02-29')
  })

  it('handles a non-leap year (2025-03-01 → 2025-02-28)', () => {
    expect(yesterdayDateKey('2025-03-01')).toBe('2025-02-28')
  })
})

describe('tomo-note.service — pickIdiomBody', () => {
  it('returns one of the catalogue idioms for a valid JLPT level', () => {
    const body = pickIdiomBody('user-1', '2026-05-17', 'N3')
    expect(typeof body).toBe('string')
    expect(body.length).toBeGreaterThan(0)
  })

  it('is deterministic for the same (userId, dateKey) pair across calls', () => {
    const a = pickIdiomBody('user-deadbeef', '2026-05-17', 'N3')
    const b = pickIdiomBody('user-deadbeef', '2026-05-17', 'N3')
    expect(a).toBe(b)
  })

  it('changes for the same user on different days (rotation across calendar days)', () => {
    // Two specific dates that hash to different idioms in the N3 pool. We
    // assert "not strictly the same" — if the pool has only N entries this
    // can collide accidentally, so we scan a small window to find at least
    // one shift instead of asserting on one date pair.
    const baseline = pickIdiomBody('user-fixed', '2026-05-01', 'N3')
    const dates = [
      '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
      '2026-05-06', '2026-05-07', '2026-05-08',
    ]
    const sawShift = dates.some((d) => pickIdiomBody('user-fixed', d, 'N3') !== baseline)
    expect(sawShift).toBe(true)
  })

  it('falls back to N3 when the JLPT target is null', () => {
    // We can't easily assert "this came from the N3 pool" without exposing
    // the pool, so we settle for "returns a non-empty string and is stable
    // across calls" — same contract as the N3 case.
    const a = pickIdiomBody('user-null-jlpt', '2026-05-17', null)
    const b = pickIdiomBody('user-null-jlpt', '2026-05-17', null)
    expect(typeof a).toBe('string')
    expect(a.length).toBeGreaterThan(0)
    expect(a).toBe(b)
  })

  it('serves a beyond_jlpt idiom for the BeyondJLPT enum value', () => {
    const body = pickIdiomBody('user-beyond', '2026-05-17', 'beyond_jlpt')
    expect(typeof body).toBe('string')
    expect(body.length).toBeGreaterThan(0)
  })
})
