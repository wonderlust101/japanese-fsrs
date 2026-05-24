import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface StickyActionBarProps {
  children:    ReactNode
  /**
   * Bar role for assistive tech. Default `'region'` with `aria-label` is the
   * safe choice for selection / bulk-action bars. Use `'toolbar'` only when
   * the bar contains a logically-grouped set of related actions.
   */
  role?:       'region' | 'toolbar' | 'status'
  ariaLabel?:  string
  className?:  string
  /** Vertical edge. Default `bottom` matches every current use; `top` is
   *  reserved for future banner-style bars. */
  edge?:       'top' | 'bottom'
  /**
   * Renders the 2px Inari Vermillion brand stripe along the bar's leading
   * edge — the same identity device used on Card and DeckRow. Opt-in
   * because not every sticky bar carries brand weight (the mobile sticky
   * action bar in the app shell does not, the cards/decks curate bars do).
   */
  brandStripe?: boolean
}

// Sticky positioning lets the bar inherit its container's width
// instead of escaping to the viewport. The closest scrolling ancestor
// (in the app shell that's `<main className="overflow-y-auto">`)
// becomes the sticky context, so the bar naturally sits at the bottom
// of the viewport but only across the main column — excluding the
// desktop sidebar. Consumers render it inside the content tree.
const EDGE_CLASS = {
  bottom: 'bottom-0 border-t',
  top:    'top-0 border-b',
} as const

const STRIPE_POSITION = {
  bottom: 'top-0',
  top:    'bottom-0',
} as const

/**
 * Full-width sticky bar pinned to the bottom (or top) of the viewport.
 * Used by bulk-selection / curate bars on the cards and decks browsers; the
 * mobile sticky action bar in the app shell uses the same shell but adds its
 * own opacity/safe-area tuning.
 *
 * Anatomy per DESIGN.md §Opaque-Chrome Rule: fully opaque
 * `bg-warm-paper-raised` (never translucency-plus-blur) with a 1px
 * soft-hairline edge against the page beneath. No drop shadow — depth
 * comes from the warm-on-cool surface contrast.
 *
 * The bar does NOT wrap children in an inner layout container; each
 * consumer provides its own inner layout (max-width, padding, gap) since
 * the bulk-action bars and the curate bar use page-specific gutters that
 * don't match a generic `max-w-7xl` default.
 */
export function StickyActionBar({
  children,
  role            = 'region',
  ariaLabel,
  className,
  edge            = 'bottom',
  brandStripe     = false,
}: StickyActionBarProps): React.JSX.Element {
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'sticky z-[var(--z-raised)] border-soft-hairline bg-warm-paper-raised',
        EDGE_CLASS[edge],
        className,
      )}
    >
      {brandStripe && (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-x-0 h-0.5 bg-inari-vermillion',
            STRIPE_POSITION[edge],
          )}
        />
      )}
      {children}
    </div>
  )
}
