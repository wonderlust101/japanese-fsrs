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
 * Snapshot row stats: streak (Aizome), reviews-this-week, retention-this-week
 * (Aizome at ≥85%). Three large Bricolage numbers with lowercase mono labels.
 *
 * v6 changes: header refactored to use the shared `CardHeader` primitive
 * (kanji ornament + small-caps mono + hairline rule), keeping the 週 + THIS
 * WEEK signature established in v5 but unifying the markup with the other
 * seven cards on the dashboard.
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
        <div className="flex-1 flex items-center mt-2">
          <div className="grid grid-cols-3 gap-x-6 lg:gap-x-12 w-full">
            {[0, 1, 2].map((i) => (
              <div key={i}>
                <SkeletonBlock width="60%" height={50} className="rounded-[4px]" />
                <SkeletonBlock width="80%" height={12} className="mt-3 rounded-[4px]" />
              </div>
            ))}
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
      <div className="flex-1 flex items-center mt-2">
        <div className="grid grid-cols-3 gap-x-6 lg:gap-x-12 w-full">
          <Stat label="day streak"         value={streakDays}      accent="aizome" />
          <Stat label="reviews this week"  value={reviewsThisWeek} />
          {isHighRetention
            ? <Stat label="retention this week" value={`${retentionPct}%`} accent="aizome" />
            : <Stat label="retention this week" value={`${retentionPct}%`} />
          }
        </div>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label:   string
  value:   number | string
  accent?: 'aizome'
}): React.JSX.Element {
  return (
    <div>
      <div
        className={[
          'font-display text-[2.5rem] sm:text-[3rem] lg:text-[3.5rem] leading-[1] tracking-[-0.02em] tabular-nums',
          accent === 'aizome' ? 'text-aizome-indigo' : 'text-sumi-ink',
        ].join(' ')}
      >
        {value}
      </div>
      <div className="mt-2 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </div>
    </div>
  )
}
