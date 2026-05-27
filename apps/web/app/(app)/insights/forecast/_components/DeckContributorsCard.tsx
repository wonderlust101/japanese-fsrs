'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { SectionCard } from '@/components/ui/SectionCard'
import { TomoLoader } from '@/components/ui/TomoLoader'
import { QuietLink } from '@/components/ui/QuietLink'
import { cn } from '@/lib/utils'
import { useDecksWithStats } from '@/lib/api/decks'

const TOP_N = 6

interface DeckContribution {
  id:       string
  name:     string
  dueCount: number
}

/**
 * Builds a single-hue Inari Vermillion Deep ramp stepped down in opacity by
 * rank, so the largest contributor reads darkest. Returns the base opacity
 * (used by the legend swatch via the cascading `opacity` style) and a
 * pre-composited background string. The background composites alpha directly
 * via `rgb(var(--token) / a)` rather than the CSS `opacity` property, so the
 * tooltip rendered inside each bar segment stays fully opaque instead of
 * inheriting the segment's transparency. The channels come from the
 * `--color-inari-vermillion-deep-rgb` token, not a hard-coded literal, so the
 * ramp tracks the brand color if it's ever retuned.
 */
function segmentStyle(rank: number): { baseOpacity: number; rgbaBg: string } {
  const opacity = Math.max(0.32, 1 - rank * 0.14)
  return {
    baseOpacity: opacity,
    rgbaBg:      `rgb(var(--color-inari-vermillion-deep-rgb) / ${opacity})`,
  }
}

/**
 * Deck contributors as a proportional segments bar. Each segment is a
 * focusable link to its deck and reveals a hover/focus tooltip with
 * name + count + share. A single Inari Vermillion ramp, stepped down in
 * opacity by rank (largest = darkest), keeps the segments distinguishable;
 * a two-column legend below mirrors those tones and cross-highlights when a
 * segment is hovered or focused.
 *
 * Data comes from the stats-bearing deck list (`list_decks_paginated`
 * rollups), so the per-deck `dueCount` arrives in one round-trip — no
 * per-deck `getDeck` fanout.
 */
export function DeckContributorsCard(): React.JSX.Element {
  const decksQuery = useDecksWithStats(24)

  const contributions = useMemo<DeckContribution[]>(() => {
    const rows = (decksQuery.data?.items ?? [])
      .filter((deck) => deck.dueCount > 0)
      .map((deck) => ({ id: deck.id, name: deck.name, dueCount: deck.dueCount }))
    rows.sort((a, b) => b.dueCount - a.dueCount)
    return rows.slice(0, TOP_N)
  }, [decksQuery.data])

  const totalDue  = contributions.reduce((acc, c) => acc + c.dueCount, 0)
  const isLoading = decksQuery.isLoading

  const [hoveredId, setHoveredId] = useState<string | null>(null)

  return (
    <SectionCard
      kanji="束"
      label="Deck contributors"
      description="Estimated from current deck schedules. Hover or focus a segment to see the deck, count, and share."
    >
      {isLoading ? (
        <ContributorsSkeleton />
      ) : contributions.length === 0 ? (
        <p className="text-sm leading-[1.55] text-faded-sumi">
          No decks have due cards right now. Add new material or wait for the schedule to catch up.
        </p>
      ) : (
        <div className="flex flex-col gap-y-6">
          <ProportionalBar
            contributions={contributions}
            totalDue={totalDue}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
          <DeckLegend
            contributions={contributions}
            totalDue={totalDue}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        </div>
      )}
    </SectionCard>
  )
}

// ── Proportional segments bar ───────────────────────────────────────────────

interface ProportionalBarProps {
  contributions: DeckContribution[]
  totalDue:      number
  hoveredId:     string | null
  onHover:       (id: string | null) => void
}

function ProportionalBar({
  contributions,
  totalDue,
  hoveredId,
  onHover,
}: ProportionalBarProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-3">
      <div
        className="relative flex h-11 w-full overflow-visible rounded-xs border border-soft-hairline"
        role="group"
        aria-label={`Proportional bar of upcoming load across ${contributions.length} decks. Total ${totalDue} cards.`}
      >
        {contributions.map((c, i) => {
          const widthPct = totalDue > 0 ? (c.dueCount / totalDue) * 100 : 0
          const share    = totalDue > 0 ? Math.round((c.dueCount / Math.max(1, totalDue)) * 100) : 0
          const { baseOpacity } = segmentStyle(i)
          const isActive = hoveredId === c.id
          // Composite the background alpha directly via the token so the
          // tooltip child (rendered inside the Link) reads at full opacity
          // instead of inheriting the segment's transparency.
          const segOpacity = isActive ? Math.min(1, baseOpacity + 0.18) : baseOpacity
          const segBg = `rgb(var(--color-inari-vermillion-deep-rgb) / ${segOpacity})`
          return (
            <Link
              key={c.id}
              href={`/decks/${c.id}`}
              onMouseEnter={() => onHover(c.id)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(c.id)}
              onBlur={() => onHover(null)}
              aria-label={`${c.name}: ${c.dueCount} cards, ${share}% of upcoming load. Open deck.`}
              className={cn(
                'group relative block h-full border-r border-warm-paper-raised/80 last:border-r-0',
                'transition-[background-color] duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 focus-visible:z-10',
              )}
              style={{
                width:           `${widthPct}%`,
                backgroundColor: segBg,
              }}
            >
              {/* Hover/focus tooltip, anchored below the segment so the
                  SectionCard's overflow-hidden doesn't clip it. */}
              <SegmentTooltip
                active={isActive}
                name={c.name}
                count={c.dueCount}
                share={share}
              />
            </Link>
          )
        })}
      </div>
      <p className="flex items-baseline justify-between font-mono text-sm tabular-nums text-faded-sumi">
        <span>
          {contributions.length} {contributions.length === 1 ? 'deck' : 'decks'}
          <span className="text-sumi-ink/70"> · </span>
          <span className="text-sumi-ink/85">{totalDue} cards due</span>
        </span>
        <span>Largest left</span>
      </p>
    </div>
  )
}

// ── Segment tooltip ─────────────────────────────────────────────────────────

interface SegmentTooltipProps {
  active: boolean
  name:   string
  count:  number
  share:  number
}

function SegmentTooltip({
  active,
  name,
  count,
  share,
}: SegmentTooltipProps): React.JSX.Element {
  return (
    <span
      role="tooltip"
      aria-hidden={!active}
      className={cn(
        'pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2',
        'flex items-center gap-x-2 whitespace-nowrap rounded-xs border border-soft-hairline bg-warm-paper-raised px-3 py-1.5',
        'shadow-card transition-opacity duration-150',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <span className="text-sm font-medium text-sumi-ink">{name}</span>
      <span aria-hidden="true" className="text-faded-sumi">·</span>
      <span className="font-mono text-sm tabular-nums text-sumi-ink/85">{count}</span>
      <span aria-hidden="true" className="text-faded-sumi">·</span>
      <span className="font-mono text-sm font-medium tabular-nums text-inari-vermillion-deep">
        {share}%
      </span>
    </span>
  )
}

// ── Deck legend ─────────────────────────────────────────────────────────────

interface DeckLegendProps {
  contributions: DeckContribution[]
  totalDue:      number
  hoveredId:     string | null
  onHover:       (id: string | null) => void
}

function DeckLegend({
  contributions,
  totalDue,
  hoveredId,
  onHover,
}: DeckLegendProps): React.JSX.Element {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      {contributions.map((c, i) => {
        const share = totalDue > 0 ? Math.round((c.dueCount / Math.max(1, totalDue)) * 100) : 0
        const { rgbaBg } = segmentStyle(i)
        const isActive = hoveredId === c.id
        return (
          <li
            key={c.id}
            onMouseEnter={() => onHover(c.id)}
            onMouseLeave={() => onHover(null)}
            className={cn(
              '-mx-2 flex items-baseline gap-x-3 rounded-xs px-2 py-1 transition-colors',
              isActive && 'bg-vermillion-wash/40',
            )}
          >
            <span
              aria-hidden="true"
              className="mt-1 inline-block h-[10px] w-[10px] shrink-0 rounded-xs"
              style={{ backgroundColor: rgbaBg }}
            />
            <QuietLink href={`/decks/${c.id}`} tone="sumi" trailingArrow size="sm">
              {c.name}
            </QuietLink>
            <span className="ml-auto shrink-0 font-mono text-sm tabular-nums text-sumi-ink/85">
              {c.dueCount}
              <span className="ml-1.5 text-sm text-faded-sumi">
                · {share}%
              </span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ContributorsSkeleton(): React.JSX.Element {
  return (
    <div className="flex items-center justify-center py-10">
      <TomoLoader size="block" />
    </div>
  )
}
