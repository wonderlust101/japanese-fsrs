import { smoothAreaPath, smoothLinePath, type Pt } from '../../_components/chartPaths'

import type { ActivityDay } from './types'

interface RetentionLongCurveProps {
  days:       ReadonlyArray<ActivityDay>
  windowDays: number
}

const VIEW_W     = 1200
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function shortMonth(iso: string): string {
  const m = Number(iso.slice(5, 7))
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? ''
}

function sortAsc<T extends { date: string }>(xs: ReadonlyArray<T>): T[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function floorTo5(v: number): number { return Math.floor(v * 20) / 20 }
function ceilTo5 (v: number): number { return Math.ceil(v  * 20) / 20 }

/**
 * 30/90/365-day retention curve. Vermillion line + sumi mean reference,
 * Y-axis percentages, X-axis dates at sparse intervals. Differs from
 * the Overview's RetentionChart by supporting longer windows and
 * dropping the "now" focal annotation (this view is about the trend,
 * not the latest data point).
 */
export function RetentionLongCurve({
  days,
  windowDays,
}: RetentionLongCurveProps): React.JSX.Element | null {
  const sorted = sortAsc(days).slice(-windowDays)
  const values = sorted.map((d) => (d.count > 0 ? d.retention : null))
  const numeric = values.filter((v): v is number => v !== null)
  if (numeric.length < 3) return null

  // Y range anchored to data, snapped to 5% steps.
  const dataMin = Math.min(...numeric)
  const dataMax = Math.max(...numeric)
  const yMin = Math.max(0, floorTo5(dataMin - 0.05))
  const yMax = Math.min(1, ceilTo5(dataMax  + 0.05))
  const yRange = Math.max(0.1, yMax - yMin)

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP  - PAD_BOTTOM

  const xFor = (i: number): number => PAD_LEFT + (i / Math.max(1, sorted.length - 1)) * innerW
  const yFor = (v: number): number => PAD_TOP  + (1 - (v - yMin) / yRange) * innerH

  const yTicks: number[] = []
  for (let i = 0; i <= 4; i += 1) yTicks.push(yMin + (yRange / 4) * i)

  const points: ReadonlyArray<Pt | null> = values.map((v, i) =>
    v === null ? null : ([xFor(i), yFor(v)] as Pt),
  )

  // Single continuous curve through all active days — inactive (null)
  // entries are skipped rather than breaking the line.
  const continuousPoints: Pt[] = points.filter((p): p is Pt => p !== null)
  const linePath = smoothLinePath(continuousPoints)
  const areaPath = smoothAreaPath(continuousPoints, PAD_TOP + innerH)

  const mean  = numeric.reduce((a, b) => a + b, 0) / numeric.length
  const meanY = yFor(mean)
  const meanPct = Math.round(mean * 100)

  // X axis tick positions (5–7 evenly spaced labels)
  const tickCount = Math.min(6, sorted.length)
  const tickIndices: number[] = []
  for (let i = 0; i < tickCount; i += 1) {
    tickIndices.push(Math.round((sorted.length - 1) * (i / Math.max(1, tickCount - 1))))
  }

  return (
    <figure className="flex flex-col gap-y-3">
      <svg
        role="img"
        aria-label={`Retention over the last ${windowDays} days. Mean ${meanPct}%.`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Y gridlines + labels */}
        {yTicks.map((tick, idx) => {
          const y = yFor(tick)
          return (
            <g key={idx}>
              <line
                x1={PAD_LEFT}
                x2={VIEW_W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--color-soft-hairline)"
                strokeOpacity={idx === 0 ? 1 : 0.7}
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={13}
                fontFamily="ui-monospace, monospace"
                fill="var(--color-faded-sumi)"
              >
                {Math.round(tick * 100)}%
              </text>
            </g>
          )
        })}

        {/* Vermillion area gradient */}
        <defs>
          <linearGradient id="retention-long-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-inari-vermillion)"      stopOpacity={0.30} />
            <stop offset="100%" stopColor="var(--color-inari-vermillion-deep)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        {areaPath !== null && (
          <path d={areaPath} fill="url(#retention-long-area)" />
        )}

        {/* Curve */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-inari-vermillion-deep)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Trailing mean reference */}
        <line
          x1={PAD_LEFT}
          x2={VIEW_W - PAD_RIGHT}
          y1={meanY}
          y2={meanY}
          stroke="var(--color-sumi-ink)"
          strokeOpacity={0.55}
          strokeWidth={1.2}
          strokeDasharray="4 4"
        />
        <text
          x={VIEW_W - PAD_RIGHT - 4}
          y={meanY - 6}
          textAnchor="end"
          fontSize={11}
          fontFamily="ui-monospace, monospace"
          letterSpacing="0.08em"
          fill="var(--color-sumi-ink)"
          fillOpacity={0.75}
        >
          MEAN {meanPct}%
        </text>

        {/* X axis ticks: month + day */}
        {tickIndices.map((i, idx) => {
          const day = sorted[i]
          if (day === undefined) return null
          const x = xFor(i)
          return (
            <g key={`xt-${idx}`}>
              <text
                x={x}
                y={VIEW_H - PAD_BOTTOM + 20}
                textAnchor="middle"
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                fill="var(--color-faded-sumi)"
              >
                {shortMonth(day.date)} {dayOfMonth(day.date)}
              </text>
            </g>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
        <span>
          Retention trend <span className="text-sumi-ink/70">·</span> last {windowDays} days
        </span>
        <span className="text-sumi-ink/85">
          Mean <span className="text-inari-vermillion-deep">{meanPct}%</span>
        </span>
      </figcaption>
    </figure>
  )
}
