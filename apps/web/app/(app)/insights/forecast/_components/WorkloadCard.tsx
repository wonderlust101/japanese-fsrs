'use client'

import { useMemo, useState } from 'react'

import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

import {
  ForecastWorkloadChart,
  type ForecastWindow,
} from './ForecastWorkloadChart'

interface WorkloadCardProps {
  forecast: ReadonlyArray<ApiForecastDay>
}

const WINDOW_OPTIONS: ForecastWindow[] = [7, 14, 28]

/**
 * Upcoming workload section. SectionCard wrapping the forward-only stacked
 * forecast chart, with a 7 / 14 / 28 tab control in the header's right slot
 * and an italic planning caption beneath the chart that interprets the
 * window's character (steady / heavy / light / backlog) for the learner.
 */
export function WorkloadCard({ forecast }: WorkloadCardProps): React.JSX.Element {
  const [windowDays, setWindowDays] = useState<ForecastWindow>(14)

  const caption = useMemo(() => buildPlanningCaption(forecast, windowDays), [forecast, windowDays])
  const summary = useMemo(() => summarizeWindow(forecast, windowDays), [forecast, windowDays])

  return (
    <SectionCard
      kanji="次"
      label="Upcoming load"
      rightContent={
        <WindowTabs value={windowDays} onChange={setWindowDays} />
      }
    >
      <div className="pb-1 lg:py-2 xl:py-3">
        <ForecastWorkloadChart forecast={forecast} windowDays={windowDays} />
        <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
          <span>
            Daily load <span className="text-sumi-ink/70">·</span> next {windowDays} days
          </span>
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendSwatch color="var(--color-inari-vermillion)" label={`New ${summary.newTotal}`} />
            <LegendSwatch color="var(--color-inari-vermillion-deep)" label={`Review ${summary.reviewTotal}`} />
            {summary.backlogTotal > 0 && (
              <LegendSwatch color="var(--color-sumi-ink)" opacity={0.8} label={`Backlog ${summary.backlogTotal}`} />
            )}
            <span className="text-sumi-ink/85">
              <span className="font-medium">{summary.total}</span> total
            </span>
          </span>
        </figcaption>
        <p className="mt-5 max-w-[68ch] text-[0.9375rem] italic leading-relaxed text-sumi-ink/85">
          {caption}
        </p>
      </div>
    </SectionCard>
  )
}

// ── Window tabs (right-slot control) ────────────────────────────────────────

interface WindowTabsProps {
  value:    ForecastWindow
  onChange: (next: ForecastWindow) => void
}

function WindowTabs({ value, onChange }: WindowTabsProps): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Forecast window"
      className="inline-flex items-center gap-x-1 rounded-[2px] border border-soft-hairline bg-cream-inset/60 p-0.5"
    >
      {WINDOW_OPTIONS.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={cn(
              'inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-[2px] px-2',
              'font-mono text-[0.6875rem] uppercase tracking-[0.16em] transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              active
                ? 'bg-inari-vermillion text-warm-paper-raised'
                : 'text-faded-sumi hover:text-sumi-ink',
            )}
          >
            {opt}d
          </button>
        )
      })}
    </div>
  )
}

// ── Legend swatch ───────────────────────────────────────────────────────────

function LegendSwatch({
  color,
  opacity = 1,
  label,
}: {
  color:    string
  opacity?: number
  label:    string
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-x-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-[10px] w-[10px] rounded-[1px]"
        style={{ backgroundColor: color, opacity }}
      />
      <span>{label}</span>
    </span>
  )
}

// ── Window summary + planning caption ───────────────────────────────────────

interface WindowSummary {
  total:         number
  newTotal:      number
  reviewTotal:   number
  backlogTotal:  number
  peakCount:     number
  peakDate:      string | null
  averagePerDay: number
}

function summarizeWindow(
  forecast: ReadonlyArray<ApiForecastDay>,
  windowDays: ForecastWindow,
): WindowSummary {
  const ordered = [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(0, windowDays)
  let total = 0, newTotal = 0, reviewTotal = 0, backlogTotal = 0
  let peakCount = 0
  let peakDate: string | null = null
  for (const d of ordered) {
    total        += d.count
    newTotal     += d.newCount
    reviewTotal  += d.reviewCount
    backlogTotal += d.backlogCount
    if (d.count > peakCount) {
      peakCount = d.count
      peakDate = d.date
    }
  }
  const averagePerDay = ordered.length > 0 ? total / ordered.length : 0
  return { total, newTotal, reviewTotal, backlogTotal, peakCount, peakDate, averagePerDay }
}

function dayName(iso: string): string {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dow] ?? ''
}

function buildPlanningCaption(
  forecast: ReadonlyArray<ApiForecastDay>,
  windowDays: ForecastWindow,
): string {
  const s = summarizeWindow(forecast, windowDays)
  if (s.total === 0) {
    return 'Nothing scheduled in this window. Add new cards or run a review to start shaping the forecast.'
  }

  // Backlog dominates the period.
  if (s.backlogTotal >= s.total * 0.25 && s.backlogTotal > 0) {
    return `About ${Math.round((s.backlogTotal / s.total) * 100)}% of the next ${windowDays} days is backlog. Clearing the overdue cards first will make the rest feel lighter.`
  }

  // Peak day is notably heavier than the window's average.
  if (s.peakDate !== null && s.peakCount >= s.averagePerDay * 1.5 && s.peakCount >= 30) {
    return `${dayName(s.peakDate)} is heavier than usual at ${s.peakCount} cards. Consider easing new cards the day before to keep the load steady.`
  }

  // Heavy across the board.
  if (s.averagePerDay >= 40) {
    return `Heavier than usual ahead, averaging ${Math.round(s.averagePerDay)} cards per day. Pausing new cards for a few days would soften the curve.`
  }

  // Light.
  if (s.averagePerDay < 12) {
    return `A light stretch, averaging ${Math.round(s.averagePerDay)} cards per day. There's room to add new material if you'd like.`
  }

  // Steady.
  return `Steady stretch, averaging ${Math.round(s.averagePerDay)} cards per day. Nothing to rearrange.`
}
