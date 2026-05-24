'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { KbdChip } from '@/components/ui/KbdChip'
import { cn } from '@/lib/utils'

interface UndoPillProps {
  /** Bumped each time a new rating becomes undoable; resets the countdown. */
  generation: number
  /** Total milliseconds the rating remains undoable. The countdown bar
   *  shrinks across this window. */
  windowMs: number
  onUndo: () => void
}

// Bottom-left pill that surfaces the 3-second undo window after a rating
// fires. The pill carries its own countdown bar (cosmetic — the actual
// cancellation timer lives in the page-level deferred-submit logic so the
// two stay in sync via the `windowMs` prop and the parent's mount/unmount
// of this component).

export function UndoPill({ generation, windowMs, onUndo }: UndoPillProps): React.JSX.Element {
  const [progress, setProgress] = useState(1)

  useEffect(() => {
    setProgress(1)
    const start = performance.now()
    let raf = 0
    function tick(now: number): void {
      const elapsed = now - start
      const next = Math.max(0, 1 - elapsed / windowMs)
      setProgress(next)
      if (next > 0) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [generation, windowMs])

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // `inset-x-0 mx-auto w-fit` centers horizontally without using a
        // transform — leaves the transform channel free for the entry
        // animation below.
        'fixed inset-x-0 mx-auto w-fit z-30',
        // Sit just above the rating bar so the two never collide. On small
        // viewports the rating bar reserves ~76px from the bottom; we add
        // 12px of breathing room. Centered horizontally so it lands in the
        // user's natural eye-line after rating instead of the left edge.
        'bottom-[max(env(safe-area-inset-bottom),0.75rem)] mb-22 md:mb-24',
        // Subtle mount fade-up so the pill enters with intention rather
        // than blinking into existence. The countdown hairline below
        // carries the rest of the temporal feedback.
        'animate-page-enter',
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="md"
        onClick={onUndo}
        className="overflow-hidden gap-2"
      >
        {/* Countdown bar at the bottom edge: a hairline that shrinks
            right-to-left as the undo window elapses. Width animated via
            requestAnimationFrame so the motion stays smooth across renders. */}
        <span
          aria-hidden="true"
          style={{ width: `${progress * 100}%` }}
          className="absolute left-0 bottom-0 h-px bg-inari-vermillion/70"
        />
        {/* Mobile: plain sentence-case button label. */}
        <span className="md:hidden text-sm font-medium text-sumi-ink">
          Undo
        </span>
        {/* md+: keyboard-chrome register (mono uppercase + separator + kbd chip). */}
        <span className="max-md:hidden font-mono text-xs text-faded-sumi">
          Undo
        </span>
        <span aria-hidden="true" className="max-md:hidden text-faded-sumi/60 text-xs">·</span>
        <KbdChip size="sm" className="inline-flex max-md:hidden">U</KbdChip>
      </Button>
    </div>
  )
}
