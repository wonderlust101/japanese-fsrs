'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Library, BookOpen, BarChart2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { OfflineQueueBadge } from './offline-queue-badge'

interface Tab {
  href: string
  label: string
  Icon: LucideIcon
}

const TABS: Tab[] = [
  { href: '/dashboard', label: 'Home',   Icon: LayoutDashboard },
  { href: '/decks',     label: 'Decks',  Icon: Library },
  { href: '/review',    label: 'Review', Icon: BookOpen },
  { href: '/analytics', label: 'Stats',  Icon: BarChart2 },
]

export function MobileBottomBar(): React.JSX.Element {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Mobile navigation"
      className="lg:hidden fixed bottom-0 inset-x-0 z-20 flex bg-warm-paper-raised border-t border-soft-hairline"
    >
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
              active ? 'text-inari-vermillion' : 'text-faded-sumi hover:text-sumi-ink',
            ].join(' ')}
          >
            <span className="relative inline-flex">
              <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
              {href === '/review' && <OfflineQueueBadge floating />}
            </span>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
