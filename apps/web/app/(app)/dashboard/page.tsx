import type { Metadata } from 'next'
import Link from 'next/link'

import { TopBar } from '../_components/top-bar'

import { DashboardClient } from './_components/dashboard-client'

export const metadata: Metadata = { title: 'Dashboard' }

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatEditorialDate(d: Date): string {
  const weekday = d.toLocaleDateString('en-US', { weekday: 'long' })
  const day     = d.getDate()
  const month   = d.toLocaleDateString('en-US', { month: 'long' })
  return `${weekday} · ${day} ${month}`
}

// ── Header sub-components ─────────────────────────────────────────────────────

function DashboardHeader({ dateLabel }: { dateLabel: string }): React.JSX.Element {
  return (
    <>
      {/* Mobile: just the brand chrome (TopBar already injects hamburger + Logo) */}
      <span className="lg:hidden ml-auto" />

      {/* Desktop: editorial date left, Add Card right, edge-aligned to body column */}
      <div className="hidden lg:flex flex-1 items-center justify-between max-w-[1360px] mx-auto">
        <p className="font-mono text-sm tracking-wide text-faded-sumi">
          {dateLabel}
        </p>
        <AddCardAffordance />
      </div>
    </>
  )
}

function AddCardAffordance(): React.JSX.Element {
  return (
    <Link
      href="/decks/new"
      className={[
        'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[2px]',
        'bg-inari-vermillion text-warm-paper-raised',
        'text-sm font-medium',
        'transition-colors duration-150 ease-out',
        'hover:bg-inari-vermillion-deep',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
      ].join(' ')}
    >
      <span className="font-mono text-base leading-none translate-y-[-1px]" aria-hidden="true">+</span>
      <span>Add card</span>
    </Link>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage(): React.JSX.Element {
  const today     = new Date()
  const dateLabel = formatEditorialDate(today)

  return (
    <>
      <TopBar>
        <DashboardHeader dateLabel={dateLabel} />
      </TopBar>

      <div className="px-6 lg:px-10 pt-8 pb-24 lg:pt-16 lg:pb-32">
        <div className="max-w-[1360px] mx-auto">
          <DashboardClient />
        </div>
      </div>
    </>
  )
}
