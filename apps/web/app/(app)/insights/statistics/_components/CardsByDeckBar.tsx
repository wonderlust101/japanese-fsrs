'use client'

import { useState } from 'react'
import Link from 'next/link'

import { QuietLink } from '@/components/ui/QuietLink'
import { cn } from '@/lib/utils'

import type { DeckCardCount } from './types'

interface CardsByDeckBarProps {
  decks: ReadonlyArray<DeckCardCount>
}

const VERMILLION_DEEP_RGB = '126, 31, 42'

function segmentBg(rank: number): string {
  const opacity = Math.max(0.32, 1 - rank * 0.14)
  return `rgba(${VERMILLION_DEEP_RGB}, ${opacity})`
}

/**
 * Cards-by-deck proportional segments bar. Same chrome as Forecast's
 * DeckContributors but for total card count, not due count: every deck
 * the user has, sized by how much of the collection it represents.
 * Hover/focus reveals the deck name + count + share; clicking opens
 * the deck.
 */
export function CardsByDeckBar({ decks }: CardsByDeckBarProps): React.JSX.Element {
  const sorted = [...decks].sort((a, b) => b.totalCards - a.totalCards)
  const total  = sorted.reduce((acc, d) => acc + d.totalCards, 0)
  const safe   = Math.max(1, total)

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (sorted.length === 0) {
    return (
      <p className="text-[0.9375rem] italic leading-relaxed text-faded-sumi">
        No decks yet.
      </p>
    )
  }

  return (
    <figure className="flex flex-col gap-y-5">
      <div className="flex flex-col gap-y-2.5">
        <div
          role="group"
          aria-label={`Proportional bar of card counts across ${sorted.length} decks. Total ${total} cards.`}
          className="relative flex h-11 w-full overflow-visible rounded-[2px] border border-soft-hairline"
        >
          {sorted.map((d, i) => {
            const widthPct  = (d.totalCards / safe) * 100
            const share     = Math.round((d.totalCards / safe) * 100)
            const isActive  = hoveredId === d.id
            const baseAlpha = Math.max(0.32, 1 - i * 0.14)
            const segOpacity = isActive ? Math.min(1, baseAlpha + 0.18) : baseAlpha
            const segBg = `rgba(${VERMILLION_DEEP_RGB}, ${segOpacity})`
            return (
              <Link
                key={d.id}
                href={`/decks/${d.id}`}
                onMouseEnter={() => setHoveredId(d.id)}
                onMouseLeave={() => setHoveredId(null)}
                onFocus={() => setHoveredId(d.id)}
                onBlur={() => setHoveredId(null)}
                aria-label={`${d.name}: ${d.totalCards} cards, ${share}% of collection. Open deck.`}
                className={cn(
                  'group relative block h-full border-r border-warm-paper-raised/80 last:border-r-0',
                  'transition-[background-color] duration-150',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 focus-visible:z-10',
                )}
                style={{ width: `${widthPct}%`, backgroundColor: segBg }}
              >
                <span
                  role="tooltip"
                  aria-hidden={!isActive}
                  className={cn(
                    'pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2',
                    'flex items-center gap-x-2 whitespace-nowrap rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5',
                    'shadow-[var(--shadow-card)] transition-opacity duration-150',
                    isActive ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  <span className="text-[0.8125rem] font-medium text-sumi-ink">{d.name}</span>
                  <span aria-hidden="true" className="text-faded-sumi">·</span>
                  <span className="font-mono text-[0.75rem] tabular-nums text-sumi-ink/85">{d.totalCards}</span>
                  <span aria-hidden="true" className="text-faded-sumi">·</span>
                  <span className="font-mono text-[0.75rem] font-medium tabular-nums text-inari-vermillion-deep">
                    {share}%
                  </span>
                </span>
              </Link>
            )
          })}
        </div>
        <p className="font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
          {sorted.length} {sorted.length === 1 ? 'deck' : 'decks'}
          <span className="text-sumi-ink/70"> · </span>
          <span className="text-sumi-ink/85">{total} cards total</span>
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {sorted.map((d, i) => {
          const share = Math.round((d.totalCards / safe) * 100)
          const isActive = hoveredId === d.id
          return (
            <li
              key={d.id}
              onMouseEnter={() => setHoveredId(d.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={cn(
                '-mx-2 flex items-baseline gap-x-3 rounded-[2px] px-2 py-1 transition-colors',
                isActive && 'bg-vermillion-wash/40',
              )}
            >
              <span
                aria-hidden="true"
                className="mt-1 inline-block h-[10px] w-[10px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: segmentBg(i) }}
              />
              <QuietLink href={`/decks/${d.id}`} tone="sumi" trailingArrow size="sm">
                {d.name}
              </QuietLink>
              <span className="ml-auto shrink-0 font-mono text-[0.75rem] tabular-nums text-sumi-ink/85">
                {d.totalCards}
                <span className="ml-1.5 text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
                  · {share}%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
