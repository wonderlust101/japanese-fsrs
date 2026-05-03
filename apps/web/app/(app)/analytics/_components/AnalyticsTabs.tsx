'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { label: 'Overview', href: '/analytics/overview' },
  { label: 'Forecast', href: '/analytics/forecast' },
  { label: 'JLPT Gap', href: '/analytics/jlpt'     },
] as const

export function AnalyticsTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="Analytics sections" className="flex gap-1 border-b border-[var(--color-border-subtle)]">
      {TABS.map(({ label, href }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={[
              'px-3 py-2 text-sm font-medium transition-colors',
              '-mb-px border-b-2',
              active
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300',
            ].join(' ')}
            aria-current={active ? 'page' : undefined}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
