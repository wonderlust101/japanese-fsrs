import type { Metadata } from 'next'

import { TopBar } from '../_components/top-bar'

import { DashboardActions } from './_components/dashboard-actions'
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

      {/* Desktop: editorial date left, ?-glossary + Add card chrome right,
          edge-aligned to the body column. DashboardActions is a client
          component because it owns the keyboard-shortcut handler + glossary
          popover state. */}
      <div className="hidden lg:flex flex-1 items-center justify-between max-w-[1360px] mx-auto">
        <p className="font-mono text-sm tracking-wide text-faded-sumi">
          {dateLabel}
        </p>
        <DashboardActions />
      </div>
    </>
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
