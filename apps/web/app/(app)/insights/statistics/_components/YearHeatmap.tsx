import type { ActivityDay } from './types'

interface YearHeatmapProps {
  days: ReadonlyArray<ActivityDay>
}

const CELL    = 12  // viewBox units per cell
const GAP     = 3
const ROW_GAP = 3
const PAD_L   = 28  // room for day labels (Mon, Wed, Fri)
const PAD_T   = 22  // room for month labels
const PAD_R   = 4
const PAD_B   = 4

const VERM_RGB = '126, 31, 42'
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const
const DOW_LABELS_VISIBLE: ReadonlyArray<{ row: number; label: string }> = [
  { row: 0, label: 'Mon' },
  { row: 2, label: 'Wed' },
  { row: 4, label: 'Fri' },
]

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

/** 0=Mon, 6=Sun */
function isoDow(d: Date): number {
  return (d.getUTCDay() + 6) % 7
}

/** Fill intensity for a cell. Returns rgba string baked with alpha
 *  (so the SVG `opacity` property doesn't cascade to label text). */
function cellFill(day: ActivityDay | null, max: number): string {
  if (day === null || day.count === 0) return 'var(--color-soft-hairline)'
  if (max === 0) return 'var(--color-soft-hairline)'
  const ratio = Math.min(1, day.count / max)
  // 5-step ramp: 0.18 → 1.0
  const alpha = 0.2 + ratio * 0.8
  return `rgba(${VERM_RGB}, ${alpha.toFixed(2)})`
}

/**
 * Year heatmap: 52 weeks × 7 days. Each cell is a day, colored on a
 * vermillion alpha ramp by review count. Day-of-week row labels on the
 * left (Mon/Wed/Fri only, GitHub-style), month labels along the top
 * positioned at month boundaries. Cells with zero reviews render as the
 * soft hairline so empty days stay visible without competing with data.
 */
export function YearHeatmap({ days }: YearHeatmapProps): React.JSX.Element | null {
  if (days.length === 0) return null

  // Align so the leftmost column starts on a Monday.
  const sorted = [...days].sort((a, b) => (a.date < b.date ? -1 : 1))
  const firstEntry = sorted[0]
  if (firstEntry === undefined) return null
  const firstDate = parseIso(firstEntry.date)
  const firstDow  = isoDow(firstDate)
  // Prepend null cells until the first day lands on its correct row.
  const cells: Array<ActivityDay | null> = Array.from({ length: firstDow }, () => null)
  cells.push(...sorted)
  // Pad to a multiple of 7 so the grid is rectangular.
  while (cells.length % 7 !== 0) cells.push(null)

  const totalDays = cells.length
  const weeks = totalDays / 7

  const max = Math.max(0, ...sorted.map((d) => d.count))

  const viewW = PAD_L + weeks * (CELL + GAP) - GAP + PAD_R
  const viewH = PAD_T + 7 * (CELL + ROW_GAP) - ROW_GAP + PAD_B

  const xFor = (week: number): number => PAD_L + week * (CELL + GAP)
  const yFor = (row: number):  number => PAD_T + row  * (CELL + ROW_GAP)

  // Build month-label positions: where the month changes in column 0 of each week.
  const monthMarks: Array<{ week: number; month: number }> = []
  for (let w = 0; w < weeks; w += 1) {
    // The Monday of this week
    const cellIdx = w * 7
    const cell = cells[cellIdx]
    if (cell === null || cell === undefined) continue
    const d = parseIso(cell.date)
    const m = d.getUTCMonth()
    const isFirstOfMonth = d.getUTCDate() <= 7
    if (isFirstOfMonth) monthMarks.push({ week: w, month: m })
  }

  const totalReviews = sorted.reduce((acc, d) => acc + d.count, 0)
  const activeDays   = sorted.filter((d) => d.count > 0).length
  const ariaLabel    = `Year activity heatmap. ${totalReviews} total reviews across ${activeDays} active days. Peak day: ${max} reviews.`

  return (
    <figure className="flex flex-col gap-y-3">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${viewW} ${viewH}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Month labels */}
        {monthMarks.map(({ week, month }, i) => (
          <text
            key={`m-${i}`}
            x={xFor(week)}
            y={PAD_T - 8}
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill="var(--color-faded-sumi)"
            letterSpacing="0.08em"
          >
            {MONTH_ABBR[month]}
          </text>
        ))}

        {/* Day-of-week labels (Mon / Wed / Fri) */}
        {DOW_LABELS_VISIBLE.map(({ row, label }) => (
          <text
            key={label}
            x={PAD_L - 6}
            y={yFor(row) + CELL - 2}
            textAnchor="end"
            fontSize={10}
            fontFamily="ui-monospace, monospace"
            fill="var(--color-faded-sumi)"
            letterSpacing="0.08em"
          >
            {label}
          </text>
        ))}

        {/* Cells */}
        {cells.map((cell, i) => {
          const week = Math.floor(i / 7)
          const row  = i % 7
          return (
            <rect
              key={i}
              x={xFor(week)}
              y={yFor(row)}
              width={CELL}
              height={CELL}
              rx={2}
              fill={cellFill(cell, max)}
            >
              {cell !== null && cell.count > 0 && (
                <title>{`${cell.date}: ${cell.count} reviews · ${Math.round(cell.retention * 100)}% retention`}</title>
              )}
            </rect>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
        <span>
          Calendar activity <span className="text-sumi-ink/70">·</span> last 365 days
        </span>
        <span className="flex items-center gap-x-2">
          <span className="text-faded-sumi/80">less</span>
          <span className="flex items-center gap-x-[2px]">
            {[0.2, 0.4, 0.6, 0.8, 1.0].map((a, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="block h-[10px] w-[10px] rounded-[2px]"
                style={{ backgroundColor: `rgba(${VERM_RGB}, ${a})` }}
              />
            ))}
          </span>
          <span className="text-faded-sumi/80">more</span>
        </span>
      </figcaption>
    </figure>
  )
}
