import { spyOn } from 'bun:test'

/** A constant, a cycled sequence, or a generator for the next `Math.random()`. */
export type RandomSource = number | readonly number[] | (() => number)

let activeSpy: { mockRestore: () => void } | null = null

/**
 * Make `Math.random()` deterministic. Pass a constant (`0`), a sequence that
 * cycles (`[0.1, 0.9]`), or a generator fn. Pair with `restoreRandom()` in
 * `afterEach`.
 *
 * Seed a sequence to pin jitter/fuzz paths — circuit-breaker Retry-After
 * jitter, FSRS interval fuzz — to exact values so assertions can be exact
 * instead of range-based.
 */
export function seedRandom(source: RandomSource = 0): void {
  restoreRandom()
  activeSpy = spyOn(Math, 'random').mockImplementation(toGenerator(source))
}

/** Restore the real `Math.random`. Safe to call when nothing was seeded. */
export function restoreRandom(): void {
  if (activeSpy !== null) {
    activeSpy.mockRestore()
    activeSpy = null
  }
}

function toGenerator(source: RandomSource): () => number {
  if (typeof source === 'function') return source
  if (typeof source === 'number') return () => source
  let i = 0
  return () => {
    const value = source[i % source.length] ?? 0
    i += 1
    return value
  }
}
