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
  const spec = pace !== null ? PACES[pace] : null
  // No pace chosen yet: preview a representative ("steady") shape as faint
  // ghost bars so the empty step still shows what the chart will look like.
  const ghost         = spec === null
  const effectiveSpec = spec ?? PACES.steady

  // Reviews scale with reviewMult; vary slightly per day for visual rhythm.
  const dailyReviews = DAY_LABELS.map((_, i) => {
    const base = effectiveSpec.newPerDay * effectiveSpec.reviewMult
    const variance = 1 + ((i % 3) - 1) * 0.12
    return Math.round(base * variance)
  })

  const maxReviews    = Math.max(...dailyReviews, 1)
  const maxNew        = effectiveSpec.newPerDay
  const maxStackTotal = maxReviews + maxNew

  return (
    <div className={['w-full', className].join(' ')}>
      <div className="flex items-end justify-between gap-2 h-[180px] border-b border-soft-hairline">
        {DAY_LABELS.map((day, i) => {
          const newCount    = effectiveSpec.newPerDay
          const reviewCount = dailyReviews[i] ?? 0
          const newFrac     = maxStackTotal > 0 ? newCount    / maxStackTotal : 0
          const reviewFrac  = maxStackTotal > 0 ? reviewCount / maxStackTotal : 0

          return (
            // Full-height column with two absolutely-positioned bars sized via
            // transform (scaleY), composited on the GPU instead of animating
            // height. The reviews bar (sumi) anchors at the bottom; the new bar
            // (vermillion) is scaled then translated up by the reviews' height
            // so it stacks directly on top.
            <div
              key={day}
              className="relative flex-1 max-w-[32px] h-full"
              style={ghost ? { opacity: 0.32 } : undefined}
            >
              <div
                className="absolute inset-0 bg-sumi-ink/60 origin-bottom"
                style={{ transform: `scaleY(${reviewFrac})`, willChange: 'transform' }}
              />
              <div
                className="absolute inset-0 bg-inari-vermillion origin-bottom"
                style={{ transform: `translateY(-${reviewFrac * 100}%) scaleY(${newFrac})`, willChange: 'transform' }}
              />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex items-center justify-between gap-2 mt-2">
        {DAY_LABELS.map((day) => (
          <span
            key={day}
            className="flex-1 text-center text-sm font-mono text-faded-sumi max-w-[32px]"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Legend + totals */}
      <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-soft-hairline">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-2 text-xs text-faded-sumi">
            <span className="inline-block w-2 h-2 bg-inari-vermillion" aria-hidden="true" />
            new
          </span>
          <span className="inline-flex items-center gap-2 text-xs text-faded-sumi">
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
