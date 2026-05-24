import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type KbdSize = 'xs' | 'sm'

interface KbdChipProps {
  children:   ReactNode
  size?:      KbdSize
  className?: string
  /**
   * When the chip floats inside an Input (e.g., the search bar's right-side
   * "/" hint), pass `floating` so positioning + pointer-events-none come along.
   * Default is `inline` for chip use inside chrome rows.
   */
  placement?: 'inline' | 'floating'
  ariaLabel?: string
}

const SIZE_CLASS: Record<KbdSize, string> = {
  xs: 'h-5 px-1.5 text-sm',
  sm: 'h-6 px-1.5 text-sm',
}

/**
 * Small mono "kbd hint" chip used to surface keyboard shortcuts (⌘K, /, Esc,
 * Space, etc.) inside input fields and toolbar rows.
 *
 * Distinct from `<Pill variant="keyboard-key">`:
 *   - KbdChip is small + rounded-xs + faded-sumi + no inset shadow (a
 *     ghosted shortcut hint that lives in chrome rows or floats inside an Input).
 *   - Pill's keyboard-key is the larger keycap-style rounded-full chip used for
 *     in-review prompts like "Space" or the rating-row keys.
 */
export function KbdChip({
  children,
  size       = 'sm',
  className,
  placement  = 'inline',
  ariaLabel,
}: KbdChipProps): React.JSX.Element {
  const isFloating = placement === 'floating'
  return (
    <kbd
      aria-label={ariaLabel}
      className={cn(
        // Display intentionally NOT set here so consumers can use responsive
        // display utilities (`hidden sm:inline-flex` etc.) without collision.
        // Always pair this primitive with `inline-flex` (or a responsive variant).
        'items-center rounded-xs border border-soft-hairline',
        'bg-warm-paper-raised font-mono tracking-tight text-faded-sumi',
        SIZE_CLASS[size],
        isFloating && 'pointer-events-none',
        className,
      )}
    >
      {children}
    </kbd>
  )
}
