import { setSystemTime } from 'bun:test'

/**
 * Freeze the process clock at a fixed instant so any code that reads
 * `Date.now()` / `new Date()` — timezone day-keys, Retry-After math, TTL
 * windows — becomes deterministic. Pair with `restoreClock()` in `afterEach`.
 *
 * @param instant ISO-8601 string or `Date`. Defaults to a reference instant
 *   where Asia/Tokyo (+9) has already rolled to 2026-05-17 while
 *   America/Los_Angeles (−7) is still on 2026-05-16 — the boundary the
 *   tomo-note day-key tests exercise.
 */
export function freezeClock(instant: string | Date = '2026-05-17T03:00:00.000Z'): void {
  setSystemTime(new Date(instant))
}

/** Restore the real system clock. Safe to call when no clock was frozen. */
export function restoreClock(): void {
  setSystemTime()
}
