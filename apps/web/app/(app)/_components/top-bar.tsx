'use client'

import Link from 'next/link'

import { IconHamburger } from '@/components/icons/chrome-marks'
import { Logo } from '@/components/ui/Logo'
import { useMobileNavStore } from '@/stores/useMobileNavStore'

import { OfflineQueueBadge } from './offline-queue-badge'

/**
 * Per-page chrome rendered by every (app) page via <TopBar>{title/actions}</TopBar>.
 *
 * On mobile (< lg) the bar carries the global chrome: hamburger + brand mark on
 * the left, page-declared actions pushed to the right. The page's TopBarTitle /
 * TopBarBackLink hide themselves on mobile (the brand mark takes the title's
 * place and the drawer handles nav), so the bar reads identically on every
 * page. The hamburger opens the MobileDrawer; the floating OfflineQueueBadge
 * attached to it preserves offline-queue visibility from the retired bottom bar.
 *
 * On desktop (lg+) the sidebar handles brand and nav, so this bar collapses
 * to just the page-declared children (title + actions).
 */
interface TopBarProps {
  children?: React.ReactNode
  desktopHidden?: boolean
}

export function TopBar({ children, desktopHidden = false }: TopBarProps): React.JSX.Element {
  const open = useMobileNavStore((s) => s.open)

  return (
    <header
      className={[
        'sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-soft-hairline bg-warm-paper-raised px-4 lg:px-6',
        desktopHidden ? 'lg:hidden' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={open}
        aria-label="Open menu"
        className="lg:hidden relative flex items-center justify-center w-11 h-11 -ml-2 rounded-[2px] text-sumi-ink hover:bg-cream-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 transition-colors"
      >
        <IconHamburger aria-hidden="true" className="w-5 h-5" />
        <OfflineQueueBadge floating />
      </button>

      {/*
        Mobile brand mark. Claims flex-1 so page-declared actions are pushed to
        the right edge (the role TopBarTitle's flex-1 plays on desktop). Hidden
        at lg+, where the sidebar owns the brand and the page title takes over.
      */}
      <Link
        href="/today"
        aria-label="Go to Reviews"
        className="lg:hidden flex flex-1 items-center rounded-[2px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <Logo size={48} wordmarkSize="md" priority />
      </Link>

      {children}
    </header>
  )
}
