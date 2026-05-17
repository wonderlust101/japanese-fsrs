'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useQueries } from '@tanstack/react-query'
import type { ApiDeck, ApiDeckWithStats } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { QuietLink } from '@/components/ui/QuietLink'
import { cn } from '@/lib/utils'
import { useDecks } from '@/lib/api/decks'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckAction } from '@/lib/actions/decks.actions'

const TOP_N = 6

interface DeckContribution {
  id:       string
  name:     string
  dueCount: number
}

/**
 * RGB triple for Inari Vermillion Deep (#7E1F2A), used to build rgba()
 * background fills so the alpha channel handles transparency instead of
 * the CSS `opacity` property — that way the tooltip inside each segment
 * doesn't inherit the segment's transparency.
 */
const VERMILLION_DEEP_RGB = '126, 31, 42'

/**
 * Single-hue Inari Vermillion Deep ramp stepped down in opacity by rank —
 * the largest contributor reads darkest. Returns the base opacity number
 * (used by the legend swatch with the cascading `opacity` style) and a
 * pre-built rgba background (used by the bar segment, which can't use
 * `opacity` because the tooltip child would inherit it).
 */
function segmentStyle(rank: number): { baseOpacity: number; rgbaBg: string } {
  const opacity = Math.max(0.32, 1 - rank * 0.14)
  return {
    baseOpacity: opacity,
    rgbaBg:      `rgba(${VERMILLION_DEEP_RGB}, ${opacity})`,
  }
}

/**
 * Deck contributors as a proportional segments bar. Each segment is a
 * focusable link to its deck and reveals a hover/focus tooltip with
 * name + count + share. Segments alternate between vermillion and sumi
 * hues to stay distinguishable for viewers with reduced contrast
 * sensitivity. A two-column legend below mirrors the bar's colors and
 * cross-highlights when a segment is hovered.
 */
export function DeckContributorsCard(): React.JSX.Element {
  const decksQuery = useDecks(24)
  const allDecks: ApiDeck[] = useMemo(
    () => decksQuery.data?.items ?? [],
    [decksQuery.data],
  )

  const detailResults = useQueries({
    queries: allDecks.map((deck) => ({
      queryKey: queryKeys.decks.detail(deck.id),
      queryFn:  () => getDeckAction(deck.id),
    })),
  })

  const contributions = useMemo<DeckContribution[]>(() => {
    const rows: DeckContribution[] = []
    allDecks.forEach((deck, i) => {
      const stats = detailResults[i]?.data as ApiDeckWithStats | null | undefined
      if (stats === null || stats === undefined) return
      if (stats.dueCount <= 0) return
      rows.push({ id: deck.id, name: deck.name, dueCount: stats.dueCount })
    })
    rows.sort((a, b) => b.dueCount - a.dueCount)
    return rows.slice(0, TOP_N)
  }, [allDecks, detailResults])

  const totalDue  = contributions.reduce((acc, c) => acc + c.dueCount, 0)
  const isLoading = decksQuery.isLoading || detailResults.some((r) => r.isLoading)

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
        <p className="text-[0.9375rem] italic leading-relaxed text-faded-sumi">
          No decks have due cards right now. Add new material or wait for the schedule to catch up.
        </p>
      ) : (
        <div className="flex flex-col gap-y-5">
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
    <div className="flex flex-col gap-y-2.5">
      <div
        className="relative flex h-11 w-full overflow-visible rounded-[2px] border border-soft-hairline"
        role="group"
        aria-label={`Proportional bar of upcoming load across ${contributions.length} decks. Total ${totalDue} cards.`}
      >
        {contributions.map((c, i) => {
          const widthPct = totalDue > 0 ? (c.dueCount / totalDue) * 100 : 0
          const share    = totalDue > 0 ? Math.round((c.dueCount / Math.max(1, totalDue)) * 100) : 0
          const { baseOpacity } = segmentStyle(i)
          const isActive = hoveredId === c.id
          // Build the background as rgba directly so the tooltip child
          // (which renders inside the Link) reads at full opacity instead
          // of inheriting the segment's transparency.
          const segOpacity = isActive ? Math.min(1, baseOpacity + 0.18) : baseOpacity
          const segBg = `rgba(${VERMILLION_DEEP_RGB}, ${segOpacity})`
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
      <p className="flex items-baseline justify-between font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
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
        'flex items-center gap-x-2 whitespace-nowrap rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5',
        'shadow-[var(--shadow-card)] transition-opacity duration-150',
        active ? 'opacity-100' : 'opacity-0',
      )}
    >
      <span className="text-[0.8125rem] font-medium text-sumi-ink">{name}</span>
      <span aria-hidden="true" className="text-faded-sumi">·</span>
      <span className="font-mono text-[0.75rem] tabular-nums text-sumi-ink/85">{count}</span>
      <span aria-hidden="true" className="text-faded-sumi">·</span>
      <span className="font-mono text-[0.75rem] font-medium tabular-nums text-inari-vermillion-deep">
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
              '-mx-2 flex items-baseline gap-x-3 rounded-[2px] px-2 py-1 transition-colors',
              isActive && 'bg-vermillion-wash/40',
            )}
          >
            <span
              aria-hidden="true"
              className="mt-1 inline-block h-[10px] w-[10px] shrink-0 rounded-[2px]"
              style={{ backgroundColor: rgbaBg }}
            />
            <QuietLink href={`/decks/${c.id}`} tone="sumi" trailingArrow size="sm">
              {c.name}
            </QuietLink>
            <span className="ml-auto shrink-0 font-mono text-[0.75rem] tabular-nums text-sumi-ink/85">
              {c.dueCount}
              <span className="ml-1.5 text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
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
    <div className="flex flex-col gap-y-5">
      <div className="dashboard-skeleton h-11 w-full rounded-[2px]" />
      <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-baseline gap-x-3">
            <div className="dashboard-skeleton h-3 w-3 shrink-0 rounded-[2px]" />
            <div className="dashboard-skeleton h-3 w-[10rem] rounded-[2px]" />
            <div className="dashboard-skeleton ml-auto h-3 w-[3rem] rounded-[2px]" />
          </li>
        ))}
      </ul>
    </div>
  )
}
