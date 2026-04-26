'use client'

import { usePathname } from 'next/navigation'

/**
 * Wraps each onboarding step page in a keyed div so that React replaces
 * the DOM node on every route change, re-triggering the CSS enter animation.
 *
 * The `key` is derived from the pathname — the only external signal that
 * changes as the user moves between steps. No state or effect needed.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="animate-page-enter w-full"
    >
      {children}
    </div>
  )
}
