'use client'


interface ScheduleHorizonProps {
  /** Total cards across subscribed decks. Used to scale the daily projections. */
  totalCards: number
  /** Estimated daily new-card capacity (from selected pace, defaults to 20). */
  paceNewPerDay?: number
  className?: string
}

const HORIZON_DAYS = 14

/**
 * 14-day stacked-bar projection of upcoming reviews. Used on the Decks step.
 *
 * The shape is the FSRS interval distribution after a fresh subscription:
 * day 1 has the most "new" cards (intro batch), days 2–4 have learning
 * reviews, days 5+ slowly add review cards as intervals expand. Heights
 * scale with totalCards / paceNewPerDay.
 */
export function ScheduleHorizon({
  totalCards,
  paceNewPerDay = 20,
  className     = '',
}: ScheduleHorizonProps): React.JSX.Element {
  const _reducedMotion = false

  // Stylized review-count distribution per day. Front-loaded (early days have
  // more learning churn), then settles to a steady state once intervals expand.
  const distributionShape = [
    1.0, 0.85, 0.72, 0.68, 0.62, 0.55, 0.50,
    0.46, 0.43, 0.40, 0.38, 0.36, 0.34, 0.32,
  ]

  const days = Array.from({ length: HORIZON_DAYS }, (_, i) => {
    const newCount    = i === 0 ? Math.min(paceNewPerDay, totalCards) : 0
    const reviewCount = Math.round(paceNewPerDay * (distributionShape[i] ?? 0.3) * 4)
    return { day: i, newCount, reviewCount }
  })

  const maxStack  = Math.max(...days.map((d) => d.newCount + d.reviewCount), 1)
  const totalDay1 = (days[0]?.newCount ?? 0) + (days[0]?.reviewCount ?? 0)

  return (
    <div className={['w-full', className].join(' ')}>
      <div className="flex items-center justify-between gap-4 mb-3 text-xs">
        <span className="font-mono uppercase tracking-[0.08em] text-faded-sumi">
          14-DAY HORIZON
        </span>
        <span className="font-mono tabular-nums text-sumi-ink">
          {totalCards.toLocaleString()} <span className="text-faded-sumi">cards</span>
        </span>
      </div>

      <div className="flex items-end justify-between gap-1 h-[160px] border-b border-soft-hairline">
        {days.map((d, _i) => {
          // Fractions (0–1) drive scaleY; the secondary bar translates by the
          // primary's scaled height so the two stack without animating layout.
          const _newFrac   = d.newCount    / maxStack
          const _reviewFrac = d.reviewCount / maxStack

          return (
            // Absolute-positioned bars on a full-height column; animation runs
            // entirely on transform so 28 simultaneous bars compose on the GPU
            // instead of triggering 28 layouts per frame.
            <div key={d.day} className="relative flex-1 h-full">
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

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-faded-sumi">
          today
        </span>
        <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-faded-sumi">
          +14d
        </span>
      </div>

      <div className="flex items-center justify-between gap-4 mt-5 pt-4 border-t border-soft-hairline">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-faded-sumi">
            <span className="inline-block w-2 h-2 bg-inari-vermillion" aria-hidden="true" />
            new today
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-faded-sumi">
            <span className="inline-block w-2 h-2 bg-sumi-ink/60" aria-hidden="true" />
            reviews
          </span>
        </div>
        <span className="text-xs font-mono tabular-nums text-sumi-ink">
          {totalDay1} <span className="text-faded-sumi">/ today</span>
        </span>
      </div>
    </div>
  )
}
