import type { ApiHeatmapDay } from '@fsrs-japanese/shared-types'

interface DailyMistakesChartProps {
  /** Full heatmap; the chart uses the most recent 14 days. */
  heatmap: ReadonlyArray<ApiHeatmapDay>
}

const VIEW_W     = 600
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46
const WINDOW     = 14

function sortAsc(xs: ReadonlyArray<ApiHeatmapDay>): ApiHeatmapDay[] {
  return [...xs].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function dayLetter(iso: string): string {
  const dow = (parseIso(iso).getUTCDay() + 6) % 7
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'][dow] as string
}

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function niceCeil(n: number): number {
  if (n <= 2)   return 2
  if (n <= 5)   return 5
  if (n <= 10)  return 10
  if (n <= 25)  return 25
  if (n <= 50)  return 50
  if (n <= 100) return 100
  return Math.ceil(n / 25) * 25
}

interface Bar {
  date:    string
  letter:  string
  wrong:   number
  count:   number
  isToday: boolean
}

/**
 * 14-day daily-mistakes bar chart. Each vertical bar represents the number
 * of wrong answers that day (estimated as `count × (1 − retention)`).
 * Today's bar is annotated with its count; the Y axis labels integer
 * mistake counts on a nice scale; the X axis labels each day with its
 * weekday letter and a date number on Sundays for orientation. The
 * caption rolls up the period total and the matching accuracy %.
 */
export function DailyMistakesChart({
  heatmap,
}: DailyMistakesChartProps): React.JSX.Element | null {
  const days = sortAsc(heatmap).slice(-WINDOW)
  if (days.length === 0) return null

  const today = days[days.length - 1]?.date

  const bars: Bar[] = days.map((d) => ({
    date:    d.date,
    letter:  dayLetter(d.date),
    wrong:   d.count > 0 ? Math.round(d.count * (1 - d.retention)) : 0,
    count:   d.count,
    isToday: d.date === today,
  }))

  const max = Math.max(0, ...bars.map((b) => b.wrong))
  if (max === 0) return null
  const yMax = niceCeil(Math.max(2, max))
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP  - PAD_BOTTOM

  const slotW = innerW / bars.length
  const barW  = slotW * 0.62
  const xFor = (i: number): number => PAD_LEFT + slotW * i + (slotW - barW) / 2
  const yFor = (v: number): number => PAD_TOP + (1 - v / yMax) * innerH

  const totalWrong    = bars.reduce((acc, b) => acc + b.wrong, 0)
  const totalReviewed = bars.reduce((acc, b) => acc + b.count, 0)
  const periodAccuracy =
    totalReviewed > 0 ? Math.round(((totalReviewed - totalWrong) / totalReviewed) * 100) : null

  return (
    <figure className="flex flex-col gap-y-3">
      <svg
        role="img"
        aria-label={
          `Bar chart of daily wrong answers over the last ${days.length} days. ${totalWrong} cards missed of ${totalReviewed} reviewed${periodAccuracy === null ? '' : ` (${periodAccuracy}% accuracy)`}.`
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

        {/* Mistake bars */}
        {bars.map((bar, i) => {
          if (bar.wrong === 0) return null
          const x = xFor(i)
          const y = yFor(bar.wrong)
          const h = Math.max(0, VIEW_H - PAD_BOTTOM - y)
          return (
            <g key={bar.date}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={h}
                rx={1.5}
                fill="var(--color-inari-vermillion-deep)"
                opacity={bar.isToday ? 1 : 0.78}
              />
              {bar.isToday && (
                <g>
                  <rect
                    x={x + barW / 2 - 22}
                    y={y - 18}
                    width={44}
                    height={14}
                    rx={2}
                    fill="var(--color-warm-paper-raised)"
                  />
                  <text
                    x={x + barW / 2}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontFamily="ui-monospace, monospace"
                    fontWeight={700}
                    fill="var(--color-inari-vermillion-deep)"
                  >
                    TODAY · {bar.wrong}
                  </text>
                </g>
              )}
            </g>
          )
        })}

        {/* X axis labels — weekday letter; date number on Sundays */}
        {bars.map((bar, i) => {
          const showDate = (parseIso(bar.date).getUTCDay() + 6) % 7 === 6
          const x = xFor(i) + barW / 2
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

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
        <span>
          Wrong answers / day <span className="text-sumi-ink/70">·</span> last {days.length} days
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <span className="font-medium text-inari-vermillion-deep">{totalWrong}</span> missed
            <span className="text-faded-sumi/80"> of </span>
            <span className="text-sumi-ink/80">{totalReviewed}</span>
          </span>
          {periodAccuracy !== null && (
            <span className="text-sumi-ink/85">
              {periodAccuracy}% accuracy
            </span>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
