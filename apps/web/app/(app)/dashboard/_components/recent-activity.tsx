import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

const RECENT_CHROME = `${DATA_CARD_CHROME} h-full`

export interface ActivityRow {
  date:      string
  reviewed:  number | null
  retention: number | null
}

interface RecentActivityProps {
  state: ModuleState
  rows?: ActivityRow[]
}

const HIGH_RETENTION_THRESHOLD = 0.85

export function RecentActivity({ state, rows = [] }: RecentActivityProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader id="activity-label" kanji="履歴" label="Recent" rightContent={<SkeletonBlock width={72} height={11} />} />
        <ul className="divide-y divide-soft-hairline/60">
          {[...Array(5)].map((_, i) => (
            <li key={i} className="py-2.5">
              <div className="flex items-center justify-between gap-3">
                <SkeletonBlock width={80} height={14} />
                <SkeletonBlock width={120} height={14} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader id="activity-label" kanji="履歴" label="Recent" />
        <ModuleError message="Couldn't load recent activity." />
      </section>
    )
  }

  if (rows.length === 0) {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader id="activity-label" kanji="履歴" label="Recent" />
        <p className="text-sm text-faded-sumi italic max-w-md leading-relaxed">
          No reviews logged yet. Today is a quiet page.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="activity-label" className={RECENT_CHROME}>
      <CardHeader id="activity-label" kanji="履歴" label="Recent" rightContent={<span>last 7 days</span>} />

      <ul className="divide-y divide-soft-hairline/60">
        {rows.map((row) => (
          <Row key={row.date} row={row} />
        ))}
      </ul>
    </section>
  )
}

function Row({ row }: { row: ActivityRow }): React.JSX.Element {
  if (row.reviewed === null) {
    return (
      <li className="flex items-baseline justify-between py-2.5 gap-4">
        <span className="text-sm text-sumi-ink font-medium">{row.date}</span>
        <span className="font-mono text-sm text-faded-sumi tracking-wide">
          in progress
        </span>
      </li>
    )
  }

  if (row.reviewed === 0) {
    return (
      <li className="flex items-baseline justify-between py-2.5 gap-4">
        <span className="text-sm text-faded-sumi">{row.date}</span>
        <span className="font-mono text-sm text-faded-sumi tabular-nums">
          rest day
        </span>
      </li>
    )
  }

  const isHighRet = row.retention !== null && row.retention >= HIGH_RETENTION_THRESHOLD

  return (
    <li className="flex items-baseline justify-between py-2.5 gap-4">
      <span className="text-sm text-sumi-ink">{row.date}</span>
      <span className="font-mono text-sm tabular-nums">
        <span className="text-sumi-ink">{row.reviewed}</span>
        <span className="text-faded-sumi"> reviewed</span>
        {row.retention !== null && (
          <>
            <span className="text-faded-sumi/60 mx-1.5">·</span>
            <span className={isHighRet ? 'text-aizome-indigo font-medium' : 'text-faded-sumi'}>
              {Math.round(row.retention * 100)}%
            </span>
          </>
        )}
      </span>
    </li>
  )
}
