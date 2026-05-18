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
        'fixed left-4 z-30',
        // Sit just above the rating bar so the two never collide. On small
        // viewports the rating bar reserves ~76px from the bottom; we add
        // 12px of breathing room.
        'bottom-[max(env(safe-area-inset-bottom),0.75rem)] mb-[5.5rem] md:mb-[6rem]',
      )}
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
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
        <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
          Undo
        </span>
        <span aria-hidden="true" className="text-faded-sumi/60 text-xs">·</span>
        <KbdChip size="xs" className="inline-flex">U</KbdChip>
      </Button>
    </div>
  )
}
