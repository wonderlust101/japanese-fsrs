'use client'

import { useMemo } from 'react'

import { ScrollableChartFrame, smoothLinePath } from '@/components/charts'

import { rangeDays, type ProgressRangeKey } from './progressRange'
import type { RetentionPoint } from './progressTypes'

interface RetentionRibbonChartProps {
  series:            ReadonlyArray<RetentionPoint>
  desiredRetention:  number
  /** Page-level time range, shared with the Mature chart. */
  range:             ProgressRangeKey
}

// ── Chart geometry (canonical) ──────────────────────────────────────────────

const VB_W = 1200
const VB_H = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM

// ── Rolling-window statistics ───────────────────────────────────────────────

interface WindowStats {
  mean: number
  se:   number  // standard error of the mean
  sd:   number  // standard deviation
}

/**
 * Compute the trailing-window weighted mean and dispersion for every
 * point in the series. Each "day" is weighted by its review count; days
 * with zero reviews contribute nothing. A point with at least one
 * active day in its window returns a stat — single-day windows produce a
 * point with SD = SE = 0 (no inferable uncertainty), so the ribbons
 * collapse to the line at that index and widen as more data accumulates.
 *
 * This keeps the chart line stretching across the full plot width even
 * on the 7d view, where the trailing window has fewer than 7 days at
 * the leading edge of the view.
 */
function rollingStats(
  series: ReadonlyArray<RetentionPoint>,
  windowDays: number,
): Array<WindowStats | null> {
  const out: Array<WindowStats | null> = []
  for (let i = 0; i < series.length; i += 1) {
    const lo = Math.max(0, i - windowDays + 1)
    const win = series.slice(lo, i + 1)
    let activeN = 0
    let wSum    = 0
    let wxSum   = 0
    for (const p of win) {
      if (p.retention === null || p.reviews <= 0) continue
      activeN += 1
      wSum    += p.reviews
      wxSum   += p.reviews * p.retention
    }
    if (activeN < 1 || wSum === 0) {
      out.push(null)
      continue
    }
    const mean = wxSum / wSum
    let varSum = 0
    let varWeight = 0
    for (const p of win) {
      if (p.retention === null || p.reviews <= 0) continue
      varSum    += p.reviews * (p.retention - mean) ** 2
      varWeight += p.reviews
    }
    const variance = varWeight > 0 ? varSum / varWeight : 0
    const sd = Math.sqrt(variance)
    const se = sd / Math.sqrt(Math.max(activeN, 1))
    out.push({ mean, sd, se })
  }
  return out
}

/**
 * Scale the rolling window to the visible range. Long views (30+d) use
 * the canonical 7-day window. Short views (7d) shrink the window so the
 * smoothing intent (roughly half the visible range) is preserved without
 * starving the leading edge of data.
 */
function pickWindowDays(viewLength: number): number {
  if (viewLength <= 7) return Math.max(2, Math.floor(viewLength / 2))
  return 7
}

// ── Tick helpers ────────────────────────────────────────────────────────────

type XAnchor = 'start' | 'middle' | 'end'

interface XTick {
  index:  number
  label:  string
  anchor: XAnchor
}

function formatDateShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * Pick evenly-spaced ticks. The first tick anchors `start` (so its label
 * extends rightward from the left edge instead of being clipped); the
 * last anchors `end` (so its label extends leftward and "today" is never
 * cropped past the right edge); interior ticks use `middle`.
 */
function pickXTicks(dates: ReadonlyArray<string>, want: number): XTick[] {
  if (dates.length === 0) return []
  if (dates.length === 1) {
    const only = dates[0]
    if (only === undefined) return []
    return [{ index: 0, label: formatDateShort(only), anchor: 'middle' }]
  }
  const lastIdx = dates.length - 1
  const tickCount = Math.max(2, Math.min(want, dates.length))
  const out: XTick[] = []
  const seen = new Set<number>()
  for (let i = 0; i < tickCount; i += 1) {
    const idx = Math.round((i / (tickCount - 1)) * lastIdx)
    if (seen.has(idx)) continue
    seen.add(idx)
    const d = dates[idx]
    if (d === undefined) continue
    const anchor: XAnchor = idx === 0 ? 'start' : idx === lastIdx ? 'end' : 'middle'
    out.push({ index: idx, label: formatDateShort(d), anchor })
  }
  return out
}

// ── Component ───────────────────────────────────────────────────────────────

export function RetentionRibbonChart({
  series,
  desiredRetention,
  range,
}: RetentionRibbonChartProps): React.JSX.Element {
  const view = useMemo(() => {
    // Defensive sort: ensure oldest-first regardless of how `series`
    // arrived (live API order isn't guaranteed). The chart's x-axis
    // assumes ascending dates.
    const sorted = [...series].sort((a, b) => a.date.localeCompare(b.date))
    const days = rangeDays(range)
    // `null` (the "All" range) shows the full series.
    return days === null ? sorted : sorted.slice(-days)
  }, [series, range])

  const stats = useMemo(() => rollingStats(view, pickWindowDays(view.length)), [view])

  // Y domain: floor = min(70, observed-5), ceiling = 100.
  const yDomain = useMemo(() => {
    let lo = 100
    for (const s of stats) {
      if (s === null) continue
      lo = Math.min(lo, (s.mean - s.sd) * 100 - 2)
    }
    lo = Math.max(50, Math.min(70, Math.floor(lo)))
    return { lo, hi: 100 }
  }, [stats])

  const xOf = (i: number): number => {
    if (view.length <= 1) return PAD_LEFT + PLOT_W / 2
    return PAD_LEFT + (i / (view.length - 1)) * PLOT_W
  }
  const yOf = (v: number): number => {
    const t = (v - yDomain.lo) / (yDomain.hi - yDomain.lo)
    return PAD_TOP + (1 - t) * PLOT_H
  }

  // Build SD ribbon polygon (lower then upper, reversed for close).
  const sdLower: Array<readonly [number, number]> = []
  const sdUpper: Array<readonly [number, number]> = []
  const seLower: Array<readonly [number, number]> = []
  const seUpper: Array<readonly [number, number]> = []
  const meanLine: Array<readonly [number, number]> = []

  for (let i = 0; i < stats.length; i += 1) {
    const s = stats[i]
    if (s === undefined || s === null) continue
    const x = xOf(i)
    sdLower.push([x, yOf((s.mean - s.sd) * 100)])
    sdUpper.push([x, yOf((s.mean + s.sd) * 100)])
    seLower.push([x, yOf((s.mean - s.se) * 100)])
    seUpper.push([x, yOf((s.mean + s.se) * 100)])
    meanLine.push([x, yOf(s.mean * 100)])
  }

  const ribbonPath = (lower: typeof sdLower, upper: typeof sdUpper): string => {
    if (lower.length === 0 || upper.length === 0) return ''
    const u = smoothLinePath(upper)
    const lReversed = lower.slice().reverse()
    // Build the lower edge as a smoothed line, then close.
    const first = lReversed[0]
    if (first === undefined) return ''
    const lPath = smoothLinePath(lReversed).replace(/^M/, 'L')
    return `${u} ${lPath} Z`
  }

  const sdPath  = ribbonPath(sdLower, sdUpper)
  const sePath  = ribbonPath(seLower, seUpper)
  const linePath = smoothLinePath(meanLine)

  // Y ticks: 70/85/100 if domain allows; otherwise 3 evenly spaced.
  const yTicks = useMemo(() => {
    const span = yDomain.hi - yDomain.lo
    if (span === 0) return [{ value: yDomain.hi, y: yOf(yDomain.hi) }]
    const stops = [yDomain.lo, Math.round((yDomain.lo + yDomain.hi) / 2), yDomain.hi]
    return stops.map((v) => ({ value: v, y: yOf(v) }))
  }, [yDomain])

  const xTicks = useMemo(() => pickXTicks(view.map((p) => p.date), 5), [view])

  const windowDays = pickWindowDays(view.length)
  const targetY = yOf(desiredRetention * 100)

  return (
    <div className="flex flex-col gap-y-6">
      <p className="font-mono text-sm text-faded-sumi">
        Daily retention <span className="text-sumi-ink/70">·</span>{' '}
        <span className="text-sumi-ink/85">{windowDays}-day rolling mean</span>
      </p>

      <ScrollableChartFrame minWidth={640}>
      <svg
        role="img"
        aria-label="Retention over time with confidence ribbon"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Y gridlines */}
        {yTicks.map((t) => (
          <line
            key={`grid-${t.value}`}
            x1={PAD_LEFT}
            x2={VB_W - PAD_RIGHT}
            y1={t.y}
            y2={t.y}
            stroke="color-mix(in oklch, var(--color-retention-uncertainty), transparent 92%)"
            strokeWidth={1}
          />
        ))}

        {/* SD ribbon (outer, faded sumi) */}
        {sdPath !== '' && (
          <path d={sdPath} fill="color-mix(in oklch, var(--color-retention-uncertainty), transparent 90%)" stroke="none" />
        )}
        {/* SE ribbon (inner, vermillion) */}
        {sePath !== '' && (
          <path d={sePath} fill="color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 82%)" stroke="none" />
        )}

        {/* Target line (dotted) */}
        <line
          x1={PAD_LEFT}
          x2={VB_W - PAD_RIGHT}
          y1={targetY}
          y2={targetY}
          stroke="color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 45%)"
          strokeWidth={1}
          strokeDasharray="3 4"
        />
        <text
          x={VB_W - PAD_RIGHT}
          y={targetY - 6}
          textAnchor="end"
          className="fill-faded-sumi font-mono"
          fontSize="11"
        >
          {Math.round(desiredRetention * 100)}% target
        </text>

        {/* Mean line */}
        {linePath !== '' && (
          <path
            d={linePath}
            fill="none"
            stroke="var(--color-inari-vermillion-deep)"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Y tick labels */}
        {yTicks.map((t) => (
          <text
            key={`ylabel-${t.value}`}
            x={PAD_LEFT - 10}
            y={t.y + 4}
            textAnchor="end"
            className="fill-faded-sumi font-mono"
            fontSize="13"
          >
            {t.value}%
          </text>
        ))}

        {/* X tick labels — anchored start/end at the chart edges so the
            "today" label is never clipped past the right viewBox boundary. */}
        {xTicks.map((t) => (
          <text
            key={`xlabel-${t.index}`}
            x={xOf(t.index)}
            y={VB_H - PAD_BOTTOM + 22}
            textAnchor={t.anchor}
            className="fill-faded-sumi font-mono"
            fontSize="13"
          >
            {t.label}
          </text>
        ))}

        {/* Baseline rule */}
        <line
          x1={PAD_LEFT}
          x2={VB_W - PAD_RIGHT}
          y1={VB_H - PAD_BOTTOM}
          y2={VB_H - PAD_BOTTOM}
          stroke="color-mix(in oklch, var(--color-retention-uncertainty), transparent 75%)"
          strokeWidth={1}
        />
      </svg>
      </ScrollableChartFrame>

      {/* Legend */}
      <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-sm text-faded-sumi">
        <li className="flex items-center gap-x-2">
          <span aria-hidden="true" className="inline-block h-[2px] w-6 bg-inari-vermillion-deep" />
          {windowDays}-day mean
        </li>
        <li className="flex items-center gap-x-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-[1px]"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-inari-vermillion-deep), transparent 82%)' }}
          />
          ± 1 standard error
        </li>
        <li className="flex items-center gap-x-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-[1px]"
            style={{ backgroundColor: 'color-mix(in oklch, var(--color-retention-uncertainty), transparent 90%)' }}
          />
          ± 1 standard deviation
        </li>
        <li className="flex items-center gap-x-2">
          <span aria-hidden="true" className="inline-block h-[2px] w-6 border-t border-dashed border-inari-vermillion-deep/60" />
          target
        </li>
      </ul>
    </div>
  )
}
