import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

import { AxisText, DATA_INK } from '@/components/charts'
import {
  addDays,
  dayLetter,
  dayOfMonth,
  isoFromDate,
  isWeekEnd,
  niceCeil,
} from '@/components/charts'
import { ScrollableChartFrame } from '@/components/charts'

export type ForecastWindow = 7 | 14 | 28

/**
 * Stacked-workload fills, drawn from the same queue palette the Today page
 * uses for its New / Due / Overdue stack (`week-rhythm-strip`): blue for new,
 * inari-red for review, deep-red for backlog. Sharing those tokens keeps the
 * status language consistent across Today and Forecast, and the blue-vs-red
 * hue split reads as distinct by hue, not just lightness.
 */
export const NEW_FILL     = 'var(--color-queue-new-mark)'
export const REVIEW_FILL  = 'var(--color-queue-review-mark)'
export const BACKLOG_FILL = 'var(--color-queue-backlog-mark)'

interface ForecastWorkloadChartProps {
  forecast:   ReadonlyArray<ApiForecastDay>
  windowDays: ForecastWindow
}

// Wider viewBox so the chart renders full-card-width without towering at
// taller aspect ratios. At a 1200px container, viewBox units render 1:1 with
// screen pixels, so the same label/bar sizes that the Overview charts use
// (declared in viewBox units) end up at the same physical size on screen.
const VIEW_W     = 1200
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46

function sortAsc(xs: ReadonlyArray<ApiForecastDay>): ApiForecastDay[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

interface Bar {
  date:    string
  letter:  string
  total:   number
  newCnt:  number
  review:  number
  backlog: number
  isToday: boolean
}

/**
 * Forward-only stacked bar chart for upcoming workload. Each day's bar
 * carries up to three segments: backlog (sumi, bottom), review (vermillion
 * deep, middle), new (inari vermillion, top). Today gets a deeper saturation
 * and a value annotation. Y axis shows integer counts; X axis labels each
 * day with weekday letter and date number on Sundays.
 */
export function ForecastWorkloadChart({
  forecast,
  windowDays,
}: ForecastWorkloadChartProps): React.JSX.Element | null {
  // Always render `windowDays` consecutive columns starting from the first
  // forecast day (or today if forecast is empty). Missing days are treated
  // as zero so the visible window stays consistent regardless of how
  // sparsely the API populates the forecast.
  const ordered  = sortAsc(forecast)
  const startIso = ordered[0]?.date ?? isoFromDate(new Date())
  const byDate   = new Map(ordered.map((d) => [d.date, d]))

  const bars: Bar[] = []
  for (let i = 0; i < windowDays; i += 1) {
    const date = addDays(startIso, i)
    const d    = byDate.get(date)
    bars.push({
      date,
      letter:  dayLetter(date),
      total:   d?.count        ?? 0,
      newCnt:  d?.newCount     ?? 0,
      review:  d?.reviewCount  ?? 0,
      backlog: d?.backlogCount ?? 0,
      isToday: i === 0,
    })
  }

  const max  = Math.max(0, ...bars.map((b) => b.total))
  const yMax = niceCeil(Math.max(5, max))
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP - PAD_BOTTOM

  const slotW = innerW / bars.length
  const barW  = Math.min(slotW * 0.62, 56)
  const xFor = (i: number): number => PAD_LEFT + slotW * i + (slotW - barW) / 2
  const yFor = (v: number): number => PAD_TOP + (1 - v / yMax) * innerH

  return (
    <ScrollableChartFrame minWidth={640}>
    <svg
      role="img"
      aria-label={
        `Forward-only forecast bar chart showing the next ${windowDays} days of scheduled reviews. Peak day: ${max} cards.`
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
              {Math.round(tick)}
            </AxisText>
          </g>
        )
      })}

      {/* Stacked bars: backlog (bottom) + review (middle) + new (top).
          Zero-review days get a faint "0" floating at the baseline so the
          gap stays explicit rather than ambiguous (no bar = no data, vs.
          no bar but a "0" = "we know — nothing scheduled here"). */}
      {bars.map((bar, i) => {
        const x = xFor(i)
        const baseY = VIEW_H - PAD_BOTTOM

        if (bar.total === 0) {
          // Thin placeholder bar at the baseline so the day still has a
          // visible slot in the chart, with a small "0" floating above.
          // Keeps the rhythm of fourteen evenly-spaced columns even when
          // several days are empty.
          const placeholderH = 4
          const y = baseY - placeholderH
          return (
            <g key={bar.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={placeholderH}
                rx={1}
                fill="var(--color-soft-hairline)"
              />
              <AxisText x={x + barW / 2} y={y - 5} size={11}>
                0
              </AxisText>
            </g>
          )
        }

        const reviewH  = (bar.review  / yMax) * innerH
        const newH     = (bar.newCnt  / yMax) * innerH
        const backlogH = (bar.backlog / yMax) * innerH
        const opacity = bar.isToday ? 1 : 0.85
        let cursorY = baseY

        return (
          <g key={bar.date}>
            {bar.backlog > 0 && (() => {
              const segH = backlogH
              const y = cursorY - segH
              cursorY = y
              return (
                <rect
                  x={x} y={y} width={barW} height={segH}
                  fill={BACKLOG_FILL}
                  opacity={opacity}
                />
              )
            })()}
            {bar.review > 0 && (() => {
              const segH = reviewH
              const y = cursorY - segH
              cursorY = y
              return (
                <rect
                  x={x} y={y} width={barW} height={segH}
                  fill={REVIEW_FILL}
                  opacity={opacity}
                />
              )
            })()}
            {bar.newCnt > 0 && (() => {
              const segH = newH
              const y = cursorY - segH
              cursorY = y
              return (
                <rect
                  x={x} y={y} width={barW} height={segH}
                  rx={1}
                  fill={NEW_FILL}
                  opacity={opacity}
                />
              )
            })()}
            {bar.isToday && bar.total > 0 && (
              <AxisText x={x + barW / 2} y={yFor(bar.total) - 6} size={12} weight={700} fill={DATA_INK}>
                {bar.total}
              </AxisText>
            )}
          </g>
        )
      })}

      {/* X axis labels */}
      {bars.map((bar, i) => {
        const showDate = isWeekEnd(bar.date)
        const x = xFor(i) + barW / 2
        const showLabel = bars.length <= 14 || i % 2 === 0
        if (!showLabel) return null
        return (
          <g key={`label-${bar.date}`}>
            <AxisText
              x={x}
              y={VIEW_H - PAD_BOTTOM + 20}
              weight={bar.isToday ? 600 : 400}
              fill={bar.isToday ? DATA_INK : undefined}
            >
              {bar.letter}
            </AxisText>
            {showDate && (
              <AxisText x={x} y={VIEW_H - PAD_BOTTOM + 34} size={10.5}>
                {dayOfMonth(bar.date)}
              </AxisText>
            )}
          </g>
        )
      })}
    </svg>
    </ScrollableChartFrame>
  )
}
