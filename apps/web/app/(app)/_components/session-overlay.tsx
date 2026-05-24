'use client'

import { useRef } from 'react'

import { cn } from '@/lib/utils'
import { useFocusTrap } from '@/hooks/use-focus-trap'

/**
 * Full-screen session takeover container (review + drill). A fixed overlay that
 * covers the app chrome; because the covered sidebar stays in the DOM and the
 * tab order, we trap focus here so Tab can't reach the invisible nav behind it.
 *
 * Trap-only: the session manages its own initial focus (and the route-focus
 * manager lands focus on <main> when the route opens), and it exits via its own
 * end-session flow — so no autoFocus / Escape-close / restoreFocus here.
 */
export function SessionOverlay({
  children,
  className,
}: {
  children:   React.ReactNode
  className?: string
}): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, { active: true })

  return (
    <div
      ref={ref}
      className={cn(
        'fixed inset-0 z-[var(--z-overlay)] flex flex-col bg-cool-paper-base overflow-y-auto',
        className,
      )}
    >
      {children}
    </div>
  )
}
