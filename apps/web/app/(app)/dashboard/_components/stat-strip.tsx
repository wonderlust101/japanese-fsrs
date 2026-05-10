import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

interface StatStripProps {
  state:           ModuleState
  streakDays?:     number
  reviewsThisWeek?: number
  retentionPct?:   number
}

const HIGH_RETENTION_THRESHOLD = 85

const STATS_CHROME = `h-full ${DATA_CARD_CHROME} flex flex-col`

/**
 * Snapshot row stats: streak (Aizome) + reviews this week + retention this
 * week (Aizome at ≥85%).
 *
 * v9 composition (post-critique): the streak number is promoted to a single
 * hero stat at the top; reviews + retention become a secondary baseline row
 * below a hairline. This breaks the three-equal-tile hero-metric template
 * (which the critique flagged as a SaaS cliché edge case) by giving streak
 * dominant visual weight and reading the other two as supporting context.
 */
export function StatStrip({
  state,
  streakDays      = 0,
  reviewsThisWeek = 0,
  retentionPct    = 0,
}: StatStripProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-label="dashboard stats" className={STATS_CHROME}>
        <CardHeader kanji="週" label="This week" />
        <div className="flex-1 flex flex-col mt-2 gap-5">
          <SkeletonBlock width="40%" height={88} className="rounded-[4px]" />
          <hr className="border-soft-hairline" />
          <div className="flex gap-8">
            <SkeletonBlock width="35%" height={20} />
            <SkeletonBlock width="35%" height={20} />
          </div>
        </div>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-label="dashboard stats" className={STATS_CHROME}>
        <CardHeader kanji="週" label="This week" />
        <div className="flex-1 flex items-center mt-2">
          <ModuleError message="Couldn't load stats." />
        </div>
      </section>
    )
  }

  const isHighRetention = retentionPct >= HIGH_RETENTION_THRESHOLD

  return (
    <section aria-label="dashboard stats" className={STATS_CHROME}>
      <CardHeader kanji="週" label="This week" />

      <div className="flex-1 flex flex-col justify-center gap-5 mt-2">
        {/* Hero stat: day streak. Aizome-Indigo for emotional anchor. */}
        <HeroStat
          value={streakDays}
          label={streakDays === 1 ? 'day streak' : 'day streak'}
        />

        <hr aria-hidden="true" className="border-0 border-t border-soft-hairline" />

        {/* Secondary stats: reviews + retention. Smaller scale, baseline-aligned,
            laid out as a quiet supporting row beneath the streak hero. */}
        <div className="flex items-baseline gap-x-8 gap-y-3 flex-wrap">
          <SecondaryStat
            value={reviewsThisWeek}
            label="reviews this week"
          />
          {isHighRetention
            ? <SecondaryStat value={`${retentionPct}%`} label="retention" accent="aizome" />
            : <SecondaryStat value={`${retentionPct}%`} label="retention" />
          }
        </div>
      </div>
    </section>
  )
}

// ── Hero stat (single big number + label) ────────────────────────────────────

function HeroStat({ value, label }: { value: number | string; label: string }): React.JSX.Element {
  return (
    <div>
      <div className="font-display text-[3.5rem] sm:text-[4rem] lg:text-[4.5rem] leading-[1] tracking-[-0.02em] tabular-nums text-aizome-indigo">
        {value}
      </div>
      <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </div>
    </div>
  )
}

// ── Secondary stat (small inline number + label) ─────────────────────────────

function SecondaryStat({
  value,
  label,
  accent,
}: {
  value:   number | string
  label:   string
  accent?: 'aizome'
}): React.JSX.Element {
  return (
    <div className="flex items-baseline gap-2">
      <span
        className={[
          'font-display text-2xl sm:text-[1.75rem] leading-none tracking-[-0.01em] tabular-nums',
          accent === 'aizome' ? 'text-aizome-indigo' : 'text-sumi-ink',
        ].join(' ')}
      >
        {value}
      </span>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </span>
    </div>
  )
}
