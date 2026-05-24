'use client'

import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type PeekPosition = 'bottom-right' | 'bottom-left'
type PeekOffset   = 'edge' | 'above-bar'

interface PeekPanelProps {
  children:    ReactNode
  /**
   * Click handler on the panel body. Treated as a dismissal affordance when
   * present; the panel becomes `cursor-pointer` and behaves like a toast.
   * Omit for non-dismissible peek surfaces.
   */
  onDismiss?:  () => void
  position?:   PeekPosition
  /**
   * `edge` (default): bottom-4, sits flush with the viewport bottom edge.
   * `above-bar`: bottom-20, sits above a sticky bottom action bar so the two
   * don't overlap. Used in the cards browser where the bulk-action bar
   * occupies the bottom edge.
   */
  offset?:     PeekOffset
  ariaLabel?:  string
  role?:       'status' | 'alert' | 'note' | 'region'
  className?:  string
  /**
   * Max width override (e.g. `'max-w-[32rem]'`). Default `'max-w-[28rem]'`
   * fits the card-detail and deck-detail toasts; the cards browser uses a
   * wider variant to fit its longer status copy. */
  maxWidth?:   string
}

const POSITION_CLASS: Record<PeekPosition, string> = {
  'bottom-right': 'right-4',
  'bottom-left':  'left-4',
}

const OFFSET_CLASS: Record<PeekOffset, string> = {
  edge:        'bottom-4',
  'above-bar': 'bottom-20',
}

/**
 * Floating "peek" panel — the small warm-paper-raised card that slides into
 * the bottom corner of a workspace to surface a recent action, an undo
 * affordance, or a contextual hint.
 *
 * Anatomy follows DESIGN.md card geometry (2px corner, 1px soft-hairline
 * border, no top-stripe because the panel is chrome, not a Card) plus the
 * `--shadow-card` popover lift since the panel detaches from the page.
 * Animates in with the existing `animate-page-enter` keyframe.
 *
 * Dismissal is opt-in: pass `onDismiss` to make the surface click-to-close.
 */
export function PeekPanel({
  children,
  onDismiss,
  position    = 'bottom-right',
  offset      = 'edge',
  ariaLabel,
  role        = 'status',
  className,
  maxWidth    = 'max-w-[28rem]',
}: PeekPanelProps): React.JSX.Element {
  const interactive = onDismiss !== undefined

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      onClick={onDismiss}
      onKeyDown={interactive ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onDismiss()
        }
      } : undefined}
      tabIndex={interactive ? 0 : undefined}
      className={cn(
        'ui-motion-colors fixed z-[var(--z-toast)] rounded-xs border border-soft-hairline',
        'bg-warm-paper-raised px-3.5 py-2.5 text-sm text-sumi-ink',
        'shadow-card animate-page-enter',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        POSITION_CLASS[position],
        OFFSET_CLASS[offset],
        maxWidth,
        interactive && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  )
}
