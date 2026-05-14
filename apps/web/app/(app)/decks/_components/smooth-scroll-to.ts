/**
 * Cross-browser smooth scroll to a target Y position.
 *
 * Why hand-rolled instead of `scrollIntoView({ behavior: 'smooth' })`:
 *
 *   1. Safari (desktop and iOS) implements `scrollIntoView({ behavior:
 *      'smooth' })` inconsistently; it sometimes skips, jumps mid-animation,
 *      or honors only the first call when several queue up in the same tick.
 *   2. Older Edge (pre-Chromium) lacks smooth scrolling entirely and silently
 *      degrades to instant.
 *   3. `behavior: 'smooth'` is governed by the browser's own easing curve;
 *      hand-rolling lets the page use the same `cubic-bezier(0.22, 1, 0.36, 1)`
 *      ease-out-quart curve that the rest of Tomo's motion system uses.
 *
 * Respects `prefers-reduced-motion` by snapping instantly.
 */
export function smoothScrollTo(targetY: number, durationMs = 320): void {
  if (typeof window === 'undefined') return

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const startY = window.scrollY ?? window.pageYOffset ?? 0
  const distance = targetY - startY

  if (reduce || Math.abs(distance) < 2) {
    window.scrollTo(0, targetY)
    return
  }

  const startTime = performance.now()
  // cubic-bezier(0.22, 1, 0.36, 1) ≈ ease-out-quart. Closed-form analog: 1 - (1 - t)^4.
  const ease = (t: number): number => 1 - Math.pow(1 - t, 4)

  function step(now: number): void {
    const elapsed = now - startTime
    const t = Math.min(1, elapsed / durationMs)
    const eased = ease(t)
    window.scrollTo(0, startY + distance * eased)
    if (t < 1) {
      window.requestAnimationFrame(step)
    }
  }

  window.requestAnimationFrame(step)
}
