'use client'

import { Menu } from 'lucide-react'

import { Logo } from '@/components/ui/Logo'
import { useMobileNavStore } from '@/stores/useMobileNavStore'

import { OfflineQueueBadge } from './offline-queue-badge'

/**
 * Per-page chrome rendered by every (app) page via <TopBar>{title/actions}</TopBar>.
 *
 * On mobile (< lg) the bar carries the global chrome (hamburger + brand mark)
 * in addition to whatever the page declares as children. The hamburger opens
 * the MobileDrawer; the floating OfflineQueueBadge attached to it preserves
 * offline-queue visibility from the retired bottom bar.
 *
 * On desktop (lg+) the sidebar handles brand and nav, so this bar collapses
 * to just the page-declared children.
 */
export function TopBar({ children }: { children: React.ReactNode }): React.JSX.Element {
  const open = useMobileNavStore((s) => s.open)

  return (
    <header className="sticky top-0 z-10 flex items-center gap-3 px-4 lg:px-6 h-16 bg-warm-paper-raised border-b border-soft-hairline shrink-0">
      <button
        type="button"
        onClick={open}
        aria-label="Open menu"
        className="lg:hidden relative flex items-center justify-center w-11 h-11 -ml-2 rounded-[2px] text-sumi-ink hover:bg-cream-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vermillion-wash transition-colors"
      >
        <Menu size={20} aria-hidden="true" />
        <OfflineQueueBadge floating />
      </button>

      <Logo size={48} wordmarkSize="md" className="lg:hidden" />

      {children}
    </header>
  )
}
