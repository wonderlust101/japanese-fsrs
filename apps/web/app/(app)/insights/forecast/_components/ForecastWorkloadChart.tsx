import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

export type ForecastWindow = 7 | 14 | 28

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

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoFromDate(d)
}

function dayLetter(iso: string): string {
  const dow = (parseIso(iso).getUTCDay() + 6) % 7
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'][dow] as string
}

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function sortAsc(xs: ReadonlyArray<ApiForecastDay>): ApiForecastDay[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function niceCeil(n: number): number {
  if (n <= 5)   return 5
  if (n <= 10)  return 10
  if (n <= 25)  return 25
  if (n <= 50)  return 50
  if (n <= 100) return 100
  if (n <= 200) return 200
  if (n <= 500) return 500
  return Math.ceil(n / 250) * 250
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
            <text
              x={PAD_LEFT - 10}
              y={y + 4}
              textAnchor="end"
              fontSize={13}
              fontFamily="ui-monospace, monospace"
              fill="var(--color-faded-sumi)"
            >
              {Math.round(tick)}
            </text>
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
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize={11}
                fontFamily="ui-monospace, monospace"
                fill="var(--color-faded-sumi)"
                opacity={0.6}
              >
                0
              </text>
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
                  fill="var(--color-sumi-ink)"
                  opacity={opacity * 0.8}
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
                  fill="var(--color-inari-vermillion-deep)"
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
                  fill="var(--color-inari-vermillion)"
                  opacity={opacity}
                />
              )
            })()}
            {bar.isToday && bar.total > 0 && (
              <text
                x={x + barW / 2}
                y={yFor(bar.total) - 6}
                textAnchor="middle"
                fontSize={12}
                fontFamily="ui-monospace, monospace"
                fontWeight={700}
                fill="var(--color-inari-vermillion-deep)"
              >
                {bar.total}
              </text>
            )}
          </g>
        )
      })}

      {/* X axis labels */}
      {bars.map((bar, i) => {
        const showDate = (parseIso(bar.date).getUTCDay() + 6) % 7 === 6
        const x = xFor(i) + barW / 2
        const showLabel = bars.length <= 14 || i % 2 === 0
        if (!showLabel) return null
        return (
          <g key={`label-${bar.date}`}>
            <text
              x={x}
              y={VIEW_H - PAD_BOTTOM + 20}
              textAnchor="middle"
              fontSize={13}
              fontFamily="ui-monospace, monospace"
              fontWeight={bar.isToday ? 600 : 400}
              fill={bar.isToday ? 'var(--color-inari-vermillion-deep)' : 'var(--color-faded-sumi)'}
            >
              {bar.letter}
            </text>
            {showDate && (
              <text
                x={x}
                y={VIEW_H - PAD_BOTTOM + 34}
                textAnchor="middle"
                fontSize={10.5}
                fontFamily="ui-monospace, monospace"
                fill="var(--color-faded-sumi)"
                opacity={0.7}
              >
                {dayOfMonth(bar.date)}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
