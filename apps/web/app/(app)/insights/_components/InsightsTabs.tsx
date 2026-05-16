'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

interface InsightsTab {
  href:  string
  label: string
}

const TABS: ReadonlyArray<InsightsTab> = [
  { href: '/insights',            label: 'Overview' },
  { href: '/insights/mistakes',   label: 'Mistakes' },
  { href: '/insights/progress',   label: 'Progress' },
  { href: '/insights/forecast',   label: 'Forecast' },
  { href: '/insights/statistics', label: 'Statistics' },
] as const

function isActive(pathname: string, href: string): boolean {
  if (href === '/insights') return pathname === '/insights'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function InsightsTabs(): React.JSX.Element {
  const pathname = usePathname() ?? '/insights'

  return (
    <nav
      aria-label="Insights views"
      className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0"
    >
      <ul
        role="tablist"
        aria-label="Insights views"
        className="relative flex items-stretch gap-6 border-b border-soft-hairline whitespace-nowrap"
      >
        {TABS.map((tab) => {
          const selected = isActive(pathname, tab.href)
          return (
            <li key={tab.href} role="presentation" className="flex">
              <Link
                href={tab.href}
                role="tab"
                aria-selected={selected}
                aria-current={selected ? 'page' : undefined}
                className={cn(
                  'relative -mb-px py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em]',
                  'transition-colors duration-150 ease-out',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-4',
                  selected ? 'text-sumi-ink' : 'text-faded-sumi hover:text-sumi-ink',
                )}
              >
                <span>{tab.label}</span>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-inari-vermillion"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
