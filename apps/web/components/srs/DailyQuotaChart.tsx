'use client'


type ScheduleKey = 'light' | 'steady' | 'intensive' | null

interface DailyQuotaChartProps {
  pace:       ScheduleKey
  className?: string
}

interface PaceSpec {
  label:      string
  newPerDay:  number
  reviewMult: number   // Reviews are typically 4–6× new cards once you build a backlog
}

const PACES: Record<Exclude<ScheduleKey, null>, PaceSpec> = {
  light:     { label: 'Light',     newPerDay: 5,  reviewMult: 4 },
  steady:    { label: 'Steady',    newPerDay: 20, reviewMult: 5 },
  intensive: { label: 'Intensive', newPerDay: 50, reviewMult: 6 },
}

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

/**
 * 7-day daily-quota chart. Each day is two stacked bars: new cards (vermillion)
 * and reviews (sumi-ink). Bar heights animate on selection. Empty state when
 * pace is null shows ghost bars at base opacity.
 */
export function DailyQuotaChart({ pace, className = '' }: DailyQuotaChartProps): React.JSX.Element {
  const _reducedMotion = false
  const spec = pace !== null ? PACES[pace] : null

  // Reviews scale with reviewMult; vary slightly per day for visual rhythm.
  const dailyReviews = DAY_LABELS.map((_, i) => {
    if (spec === null) return 0
    const base = spec.newPerDay * spec.reviewMult
    const variance = 1 + ((i % 3) - 1) * 0.12
    return Math.round(base * variance)
  })

  const maxReviews    = Math.max(...dailyReviews, 1)
  const maxNew        = spec?.newPerDay ?? 0
  const maxStackTotal = maxReviews + maxNew

  return (
    <div className={['w-full', className].join(' ')}>
      <div className="flex items-end justify-between gap-2 h-[180px] border-b border-soft-hairline">
        {DAY_LABELS.map((day, i) => {
          const newCount     = spec?.newPerDay ?? 0
          const reviewCount  = dailyReviews[i] ?? 0
          const _newPercent  = maxStackTotal > 0 ? (newCount    / maxStackTotal) : 0
          const _reviewPct   = maxStackTotal > 0 ? (reviewCount / maxStackTotal) : 0

          return (
            // Each column is full-height with absolutely-positioned bars. Bars
            // animate via transform (scaleY + translateY), not height: keeps the
            // animation on the compositor and avoids 14 simultaneous layouts
            // per pace change.
            <div key={day} className="relative flex-1 max-w-[32px] h-full">
              <div
                className="absolute inset-0 bg-inari-vermillion origin-bottom"
                style={{ willChange: 'transform' }}              />
              <div
                className="absolute inset-0 bg-sumi-ink/60 origin-bottom"
                style={{ willChange: 'transform' }}              />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex items-center justify-between gap-2 mt-2">
        {DAY_LABELS.map((day) => (
          <span
            key={day}
            className="flex-1 text-center text-[10px] font-mono uppercase tracking-[0.08em] text-faded-sumi max-w-[32px]"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Legend + totals */}
      <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-soft-hairline">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-faded-sumi">
            <span className="inline-block w-2 h-2 bg-inari-vermillion" aria-hidden="true" />
            new
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-faded-sumi">
            <span className="inline-block w-2 h-2 bg-sumi-ink/60" aria-hidden="true" />
            reviews
          </span>
        </div>
        {spec !== null && (
          <span className="text-xs font-mono tabular-nums text-sumi-ink">
            ~{spec.newPerDay + (dailyReviews[0] ?? 0)} <span className="text-faded-sumi">/ day</span>
          </span>
        )}
      </div>
    </div>
  )
}
