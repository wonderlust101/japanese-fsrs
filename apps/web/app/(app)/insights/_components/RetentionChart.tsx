import type { ApiHeatmapDay } from '@fsrs-japanese/shared-types'

import { smoothAreaPath, smoothLinePath, type Pt } from './chartPaths'

interface RetentionChartProps {
  /** Full heatmap; the chart will pick the most recent active days. */
  heatmap: ReadonlyArray<ApiHeatmapDay>
}

const VIEW_W     = 600
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46
const WINDOW     = 14
const Y_TICKS    = 4

function sortAsc(xs: ReadonlyArray<ApiHeatmapDay>): ApiHeatmapDay[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function dayLetter(iso: string): string {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'][dow] as string
}

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function floorTo5(v: number): number { return Math.floor(v * 20) / 20 }
function ceilTo5 (v: number): number { return Math.ceil(v  * 20) / 20 }

/**
 * 14-day retention area chart. The Y axis shows percentages anchored to
 * the data range (snapped to 5% steps with breathing room). The X axis
 * labels each day with its weekday letter and a date number on Sundays.
 * A dashed reference line marks the trailing mean across the active days.
 * The most recent active point is annotated with a vermillion dot and a
 * vertical droplines back to its date label, so the eye can find "today's"
 * value without parsing the curve.
 */
export function RetentionChart({ heatmap }: RetentionChartProps): React.JSX.Element | null {
  const days    = sortAsc(heatmap).slice(-WINDOW)
  const values  = days.map((d) => (d.count > 0 ? d.retention : null))
  const numeric = values.filter((v): v is number => v !== null)
  if (numeric.length < 3) return null

  // Y range — anchor to the data, snap to 5% steps with 5pt padding either side.
  const dataMin = Math.min(...numeric)
  const dataMax = Math.max(...numeric)
  const yMin = Math.max(0, floorTo5(dataMin - 0.05))
  const yMax = Math.min(1, ceilTo5(dataMax  + 0.05))
  const yRange = Math.max(0.1, yMax - yMin)

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP  - PAD_BOTTOM

  const xFor = (i: number): number => PAD_LEFT + (i / Math.max(1, days.length - 1)) * innerW
  const yFor = (v: number): number => PAD_TOP  + (1 - (v - yMin) / yRange) * innerH

  const yTicks: number[] = []
  for (let i = 0; i <= Y_TICKS; i += 1) yTicks.push(yMin + (yRange / Y_TICKS) * i)

  const points: ReadonlyArray<Pt | null> = values.map((v, i) =>
    v === null ? null : ([xFor(i), yFor(v)] as Pt),
  )

  // Draw one continuous curve through all active days — the line flows
  // across inactive (null) days rather than breaking at them, so the
  // trend reads as a single shape.
  const continuousPoints: Pt[] = points.filter((p): p is Pt => p !== null)
  const linePath = smoothLinePath(continuousPoints)
  const areaPath = smoothAreaPath(continuousPoints, PAD_TOP + innerH)

  // Most recent active value gets the vermillion annotation.
  let recent: { i: number; v: number } | null = null
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i]
    if (typeof v === 'number') { recent = { i, v }; break }
  }

  const mean  = numeric.reduce((a, b) => a + b, 0) / numeric.length
  const meanY = yFor(mean)

  const recentPct = recent === null ? null : Math.round(recent.v * 100)
  const meanPct   = Math.round(mean * 100)

  return (
    <figure className="flex flex-col gap-y-3">
      <svg
        role="img"
        aria-label={
          recentPct === null
            ? `Retention over the last ${days.length} days. Trailing mean ${meanPct}%.`
            : `Retention over the last ${days.length} days. Latest value ${recentPct}%, trailing mean ${meanPct}%.`
        }
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Y gridlines + axis labels */}
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

        {/* Vermillion gradient for the area fill — denser near the curve,
            fading toward the baseline so the line stays the loudest element. */}
        <defs>
          <linearGradient id="retention-area-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-inari-vermillion)"      stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-inari-vermillion-deep)" stopOpacity={0.04} />
          </linearGradient>
        </defs>

        {/* Area fill under the curve */}
        {areaPath !== null && (
          <path d={areaPath} fill="url(#retention-area-gradient)" />
        )}

        {/* Main retention curve — Inari Vermillion Deep, the brand carrying the data. */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-inari-vermillion-deep)"
          strokeOpacity={1}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Per-day dots — same vermillion family, lower presence than the focal point. */}
        {points.map((p, i) => {
          if (p === null) return null
          const isRecent = recent !== null && recent.i === i
          if (isRecent) return null
          return (
            <circle
              key={i}
              cx={p[0]}
              cy={p[1]}
              r={2.4}
              fill="var(--color-inari-vermillion-deep)"
              fillOpacity={0.45}
            />
          )
        })}

        {/* Trailing mean reference — Sumi Ink dashed. It's the only sumi
            mark on the chart, so the eye reads it as "reference," not "data." */}
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
        <rect
          x={VIEW_W - PAD_RIGHT - 86}
          y={meanY - 16}
          width={84}
          height={13}
          rx={2}
          fill="var(--color-warm-paper-raised)"
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


        {/* Most-recent annotated dot + dropline + label */}
        {recent !== null && (
          <g>
            <line
              x1={xFor(recent.i)}
              x2={xFor(recent.i)}
              y1={yFor(recent.v) + 9}
              y2={VIEW_H - PAD_BOTTOM + 4}
              stroke="var(--color-inari-vermillion-deep)"
              strokeOpacity={0.4}
              strokeWidth={1}
              strokeDasharray="2 3"
            />
            {/* Outer halo + inner ring give the focal dot a "target" feel
                that reads clearly against the curve. */}
            <circle
              cx={xFor(recent.i)}
              cy={yFor(recent.v)}
              r={7}
              fill="var(--color-warm-paper-raised)"
              stroke="var(--color-inari-vermillion-deep)"
              strokeWidth={1.5}
            />
            <circle
              cx={xFor(recent.i)}
              cy={yFor(recent.v)}
              r={3.2}
              fill="var(--color-inari-vermillion-deep)"
            />
            <text
              x={xFor(recent.i)}
              y={yFor(recent.v) - 14}
              textAnchor="middle"
              fontSize={11.5}
              fontFamily="ui-monospace, monospace"
              fontWeight={700}
              fill="var(--color-inari-vermillion-deep)"
            >
              {recentPct}%
            </text>
          </g>
        )}

        {/* X axis day labels — weekday letter on top, date on Sundays for orientation */}
        {days.map((d, i) => {
          const showDate = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7 === 6
          const isRecent = recent !== null && recent.i === i
          return (
            <g key={d.date}>
              <text
                x={xFor(i)}
                y={VIEW_H - PAD_BOTTOM + 20}
                textAnchor="middle"
                fontSize={13}
                fontFamily="ui-monospace, monospace"
                fontWeight={isRecent ? 600 : 400}
                fill={isRecent ? 'var(--color-inari-vermillion-deep)' : 'var(--color-faded-sumi)'}
              >
                {dayLetter(d.date)}
              </text>
              {showDate && (
                <text
                  x={xFor(i)}
                  y={VIEW_H - PAD_BOTTOM + 34}
                  textAnchor="middle"
                  fontSize={10.5}
                  fontFamily="ui-monospace, monospace"
                  fill="var(--color-faded-sumi)"
                  opacity={0.7}
                >
                  {dayOfMonth(d.date)}
                </text>
              )}
            </g>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
        <span>Daily retention <span className="text-sumi-ink/70">·</span> last {days.length} days</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendSwatch color="var(--color-inari-vermillion-deep)" label="Daily" />
          <LegendSwatch color="var(--color-sumi-ink)" opacity={0.6} dashed label={`Mean ${meanPct}%`} />
          {recentPct !== null && (
            <LegendSwatch color="var(--color-inari-vermillion-deep)" label={`Now ${recentPct}%`} bold />
          )}
        </span>
      </figcaption>
    </figure>
  )
}

function LegendSwatch({
  color,
  opacity = 1,
  dashed = false,
  bold = false,
  label,
}: {
  color:    string
  opacity?: number
  dashed?:  boolean
  bold?:    boolean
  label:    string
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-x-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-[2px] w-4"
        style={{
          backgroundColor: dashed ? 'transparent' : color,
          opacity,
          ...(dashed
            ? {
                backgroundImage: `repeating-linear-gradient(to right, ${color} 0, ${color} 3px, transparent 3px, transparent 6px)`,
              }
            : {}),
        }}
      />
      <span className={bold ? 'font-medium text-inari-vermillion-deep' : undefined}>
        {label}
      </span>
    </span>
  )
}
