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
        // h-10 (40px) brings the chip closer to the WCAG 2.5.5 44×44px touch
        // target while keeping it visibly subordinate to the h-12 Start
        // Review hero CTA. h-9 (36px) was below the AAA recommendation.
        'inline-flex items-center gap-1.5 h-10 px-3.5 rounded-[2px]',
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
          {/* Visually-hidden h1 anchors the page heading hierarchy.
              Screen readers announce "Dashboard" as the page entry point;
              the kanji-headed cards below provide h2-level navigation. */}
          <h1 className="sr-only">Dashboard</h1>
          <DashboardClient />
        </div>
      </div>
    </>
  )
}
