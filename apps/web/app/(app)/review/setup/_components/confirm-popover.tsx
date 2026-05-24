'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

interface ConfirmPopoverProps {
  open:           boolean
  headline:       string
  confirmLabel:   string
  onConfirm:      () => void
  onCancel:       () => void
  /**
   * Element to anchor the popover to. The popover positions itself just
   * above the trigger's top edge, flipping below when there isn't room.
   * Required so the floating popover knows where in the viewport to land.
   */
  anchorRef:      React.RefObject<HTMLElement | null>
  /** Optional secondary line. */
  description?:   string
}

// Small floating popover for destructive confirmations on /review/setup.
// Renders via createPortal into document.body so no ancestor's overflow
// or transform clipping touches it, and so opening it never shifts any
// surrounding layout. Position is computed from the anchor's bounding
// rect on open and on scroll/resize, mirroring the codebase's existing
// floating-element idiom (see components/ui/TomoSelect.tsx).
//
// Tomo chrome: warm-paper background, 2px Inari-vermillion top stripe,
// soft-hairline border. Dismisses on Escape, outside-click, and restores
// focus to the previously-focused element on close.

const POPOVER_PREFERRED_WIDTH = 260
const POPOVER_GAP             = 8     // px between trigger and popover
const VIEWPORT_MARGIN         = 16    // px of breathing room from window edges

// Resolve the popover width against the current viewport. On sub-280px
// devices (foldables, large accessibility zoom) the preferred width plus
// the 16px×2 margins would clip the screen; clamping here keeps the
// popover inside the viewport without changing the visual rhythm on
// roomy widths.
function resolvePopoverWidth(): number {
  if (typeof window === 'undefined') return POPOVER_PREFERRED_WIDTH
  const available = window.innerWidth - VIEWPORT_MARGIN * 2
  return Math.max(160, Math.min(POPOVER_PREFERRED_WIDTH, available))
}

interface Position {
  top:     number
  left:    number
  width:   number
  flipped: boolean   // true = anchored below trigger instead of above
}

export function ConfirmPopover({
  open,
  headline,
  confirmLabel,
  onConfirm,
  onCancel,
  anchorRef,
  description,
}: ConfirmPopoverProps): React.JSX.Element | null {
  const popoverRef        = useRef<HTMLDivElement | null>(null)
  // Captures the trigger that opened the popover so we can return focus to
  // it on close. Without this the keyboard user lands at the top of the
  // document after dismiss.
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [mounted, setMounted] = useState(false)
  // Two-phase reveal flag. First paint uses the estimate-based position
  // and stays hidden; the next frame re-measures the real popover height
  // and reveals. Without this, the very first open paints with a wrong
  // height estimate (no DOM to measure yet) and lands on top of the
  // trigger instead of above it.
  const [measured, setMeasured] = useState(false)

  // createPortal target is only safe to compute on the client; React 18+
  // hydration is fine if we gate the portal call on mount.
  useEffect(() => { setMounted(true) }, [])

  // Compute position from anchor rect. Prefers above; flips below when the
  // popover would clip the top of the viewport.
  useLayoutEffect(() => {
    if (!open) {
      // Reset on close so the next open starts from a known state and
      // doesn't inherit a stale position from the previous trigger.
      setPosition(null)
      setMeasured(false)
      return
    }
    function reposition(): void {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect       = anchor.getBoundingClientRect()
      // Read measured popover height once it's rendered; fall back to a
      // conservative estimate on first paint so the flip decision is sane.
      const estHeight  = popoverRef.current?.offsetHeight ?? 110
      const wantTop    = rect.top - estHeight - POPOVER_GAP
      const flipped    = wantTop < VIEWPORT_MARGIN
      const top        = flipped ? rect.bottom + POPOVER_GAP : wantTop
      // Width adapts to the viewport so very narrow screens (foldable
      // inner, large accessibility zoom) don't clip the popover.
      const width      = resolvePopoverWidth()
      // Horizontally align to the anchor's left edge, clamped to the
      // viewport so the popover never escapes the window.
      const maxLeft    = window.innerWidth - width - VIEWPORT_MARGIN
      const left       = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft))
      setPosition({ top, left, width, flipped })
    }
    // First pass: estimate-based, popover renders hidden via `measured`.
    reposition()
    // Second pass on the next frame, once the popover is in the DOM and
    // its real height can be read. Schedules into rAF so the estimate
    // pass completes its render first; then we correct and reveal.
    const raf = requestAnimationFrame(() => {
      reposition()
      setMeasured(true)
    })
    window.addEventListener('scroll',  reposition, true)
    window.addEventListener('resize',  reposition)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [open, anchorRef])

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement as HTMLElement | null

    function handleKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    function handleClickOutside(e: MouseEvent): void {
      const target = e.target as Node | null
      if (target === null) return
      // Click inside the popover itself: keep open.
      if (popoverRef.current?.contains(target)) return
      // Click on the trigger: let the trigger's own handler manage state
      // (otherwise outside-click closes the popover, then the trigger
      // re-opens it in the same tick).
      if (anchorRef.current?.contains(target)) return
      onCancel()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('mousedown', handleClickOutside)
      // Restore focus on close. Guarded by isConnected so a re-render that
      // unmounts the trigger doesn't throw.
      const prev = previouslyFocused.current
      if (prev && prev.isConnected) prev.focus()
    }
  }, [open, onCancel, anchorRef])

  if (!open || !mounted || position === null) return null

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-label={headline}
      style={{
        position:   'fixed',
        top:        position.top,
        left:       position.left,
        width:      position.width,
        // Stay hidden during the estimate-only first paint. The next
        // frame re-measures and flips `measured` true; from then on the
        // popover is visible at the correct position.
        visibility: measured ? 'visible' : 'hidden',
      }}
      className={cn(
        'z-[60] overflow-hidden rounded-[2px]',
        'border border-soft-hairline bg-warm-paper-raised shadow-card',
        // Identity stripe.
        'before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-inari-vermillion before:content-[""]',
      )}
    >
      <div className="px-4 pt-4 pb-3">
        <p className="text-base font-medium text-sumi-ink">
          {headline}
        </p>
        {description !== undefined && (
          <p className="mt-1 text-sm leading-relaxed text-faded-sumi">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-soft-hairline/60 px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          className={cn(
            'font-mono text-sm px-2 py-1 rounded-[2px]',
            'text-faded-sumi hover:text-sumi-ink cursor-pointer',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          )}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            'inline-flex items-center justify-center rounded-[2px]',
            'bg-inari-vermillion-deep px-3 py-1.5 text-warm-paper-raised',
            'font-medium text-sm cursor-pointer hover:bg-inari-vermillion',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
            'transition-colors duration-150 ease-out',
          )}
          autoFocus
        >
          {confirmLabel}
        </button>
      </div>
    </div>,
    document.body,
  )
}
