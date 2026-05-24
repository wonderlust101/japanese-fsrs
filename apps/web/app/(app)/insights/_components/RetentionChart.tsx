import type { ApiHeatmapDay } from '@fsrs-japanese/shared-types'

import { smoothAreaPath, smoothLinePath, type Pt } from '@/components/charts'
import {
  AXIS_SUBLABEL_SIZE,
  AxisText,
  ChartFigcaption,
  DATA_INK,
  FocalDot,
  LegendSwatch,
  REFERENCE_INK,
  ReferenceLine,
} from '@/components/charts'
import { ScrollableChartFrame } from '@/components/charts'

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
      <ScrollableChartFrame minWidth={640}>
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
              <AxisText x={PAD_LEFT - 10} y={y + 4} anchor="end">
                {Math.round(tick * 100)}%
              </AxisText>
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

        {/* Trailing mean reference — the shared sumi dashed baseline. It's the
            only sumi mark on the chart, so the eye reads it as "reference." */}
        <ReferenceLine x1={PAD_LEFT} x2={VIEW_W - PAD_RIGHT} y={meanY} />
        {/* Mean value as a deliberate outlined callout: solid paper fill +
            thin vermillion hairline so it reads as an intentional label on
            the red fill, not an accidental gap in it. Parked just below the
            dashed line to clear the curve and the "now" dot above-right. */}
        <rect
          x={VIEW_W - PAD_RIGHT - 80}
          y={meanY + 3}
          width={78}
          height={17}
          rx={3}
          fill="var(--color-warm-paper-raised)"
          stroke="var(--color-inari-vermillion-deep)"
          strokeOpacity={0.45}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        <AxisText
          x={VIEW_W - PAD_RIGHT - 8}
          y={meanY + 15}
          anchor="end"
          size={11}
          fill={REFERENCE_INK}
          letterSpacing="0.08em"
        >
          MEAN {meanPct}%
        </AxisText>


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
            {/* Shared focal marker: halo + ring + core, the "current value"
                dot used across every chart. */}
            <FocalDot cx={xFor(recent.i)} cy={yFor(recent.v)} />
            <AxisText
              x={xFor(recent.i)}
              y={yFor(recent.v) - 14}
              size={11.5}
              weight={700}
              fill={DATA_INK}
            >
              {recentPct}%
            </AxisText>
          </g>
        )}

        {/* X axis day labels — weekday letter on top, date on Sundays for orientation */}
        {days.map((d, i) => {
          const showDate = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7 === 6
          const isRecent = recent !== null && recent.i === i
          return (
            <g key={d.date}>
              <AxisText
                x={xFor(i)}
                y={VIEW_H - PAD_BOTTOM + 20}
                weight={isRecent ? 600 : 400}
                fill={isRecent ? DATA_INK : undefined}
              >
                {dayLetter(d.date)}
              </AxisText>
              {showDate && (
                <AxisText x={xFor(i)} y={VIEW_H - PAD_BOTTOM + 34} size={AXIS_SUBLABEL_SIZE}>
                  {dayOfMonth(d.date)}
                </AxisText>
              )}
            </g>
          )
        })}
      </svg>
      </ScrollableChartFrame>

      {/* Legend carries series identity only; the actual mean/now values live
          on the chart as callouts, so they're not repeated here. */}
      <ChartFigcaption>
        <span>Daily retention <span className="text-sumi-ink/70">·</span> last {days.length} days</span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <LegendSwatch shape="line" color={DATA_INK} label="Daily" />
          <LegendSwatch shape="line" color={REFERENCE_INK} opacity={0.6} dashed label="Mean" />
          {recentPct !== null && (
            <LegendSwatch shape="line" color={DATA_INK} bold label="Now" />
          )}
        </span>
      </ChartFigcaption>
    </figure>
  )
}
