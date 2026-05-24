'use client'

import { cn } from '@/lib/utils'

interface MobileStickyActionBarProps {
  /** ARIA label for the wrapping landmark. Defaults to "Sticky actions". */
  ariaLabel?: string
  /** Accent classes appended to the outer wrapper (e.g. `lg:hidden` override
   *  hooks). Defaults are already mobile-only. */
  className?: string
  children:   React.ReactNode
}

/**
 * Mobile-only sticky action bar pinned to the bottom of the viewport.
 *
 * Lifted out of `review/setup/_components/setup-client.tsx`. Identical visual
 * treatment: opaque warm-paper-raised, soft-hairline top border, the canonical
 * 1440px content cap, and consistent horizontal padding across breakpoints.
 * Per the Opaque-Chrome Rule (DESIGN.md §Elevation), the bar commits to fully
 * opaque instead of translucency-plus-blur — warm-paper against the cool page
 * gives enough separation via the surface contrast and the hairline border.
 *
 * Hidden at `lg+` (where pages park their primary action inside a sticky
 * sidebar instead).
 */
export function MobileStickyActionBar({
  ariaLabel = 'Sticky actions',
  className = '',
  children,
}: MobileStickyActionBarProps): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 border-t border-soft-hairline',
        // Bottom padding clears the iOS home indicator, matching the review /
        // drill rating bars' established safe-area pattern (this bar is the
        // primary CTA on the mobile dashboard).
        'bg-warm-paper-raised px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:px-6',
        'lg:hidden',
        className,
      )}
    >
      <div className="mx-auto max-w-[1440px]">{children}</div>
    </div>
  )
}
