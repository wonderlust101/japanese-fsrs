'use client'

import Link from 'next/link'

import {
  SUMMARY_FIXTURE_KEYS,
  summaryFixtureLabel,
} from './summary-fixtures'

import type { SessionPattern } from '@/lib/review/summary-pattern'

interface Props {
  active: SessionPattern | null
}

/**
 * Dev-only state switcher pinned to the bottom of the Review Summary in
 * non-production builds. Mirrors the affordance the session dev toolbar
 * exposes, but in-context: engineers reviewing the Summary can cycle
 * through every pattern without backing out to /review/session.
 *
 * Rendered by the Summary page itself, gated to NODE_ENV !== 'production'.
 */
export function SummaryDevSwitcher({ active }: Props): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label="Summary dev state switcher"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-[2px] border border-sumi-ink/15 bg-sumi-ink px-2.5 py-1.5 shadow-[0_8px_24px_-12px_rgba(31,26,24,0.4)]"
    >
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-warm-paper-raised/55 pr-1 border-r border-warm-paper-raised/15">
        States
      </span>
      {SUMMARY_FIXTURE_KEYS.map((key) => {
        const isActive = active === key
        return (
          <Link
            key={key}
            href={`/review/summary?fixture=${key}`}
            className={[
              'rounded-[2px] px-2 py-1 text-[0.65rem] cursor-pointer',
              isActive
                ? 'bg-warm-paper-raised/25 text-warm-paper-raised'
                : 'text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10',
            ].join(' ')}
          >
            {summaryFixtureLabel(key)}
          </Link>
        )
      })}
      <Link
        href="/review/summary"
        className="ml-1 rounded-[2px] px-2 py-1 text-[0.65rem] text-warm-paper-raised/55 hover:text-warm-paper-raised cursor-pointer border border-warm-paper-raised/15"
        title="Clear fixture"
      >
        clear
      </Link>
    </div>
  )
}
