'use client'

import {
  clampRatio,
  formatExactCount,
  safeNonNegativeInteger,
} from './dashboard-format'
import { DashboardRowMotion } from './dashboard-motion'
import {
  CardHeader,
  ConnectionErrorNotice,
  EmptyState,
  LIST_MODULE_CHROME,
  type ModuleState,
  SkeletonBlock,
  UnavailableState,
} from './section-primitives'

const RECENT_CHROME = `${LIST_MODULE_CHROME} flex flex-col`
const RECENT_LABEL = 'Recent reviews'
const RECENT_DESCRIPTION = 'Last 7 days of reviews.'

export interface ActivityRow {
  date:      string
  reviewed:  number | null
  retention: number | null
}

interface RecentActivityProps {
  state: ModuleState
  rows?: ActivityRow[]
}

const GOOD_RETENTION_THRESHOLD = 0.85

export function RecentActivity({ state, rows = [] }: RecentActivityProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="activity-label" aria-busy="true" className={RECENT_CHROME}>
        <CardHeader
          id="activity-label"
          kanji="履歴"
          label={RECENT_LABEL}
          variant="compact"
          description={RECENT_DESCRIPTION}
          rightContent={<SkeletonBlock width={72} height={11} />}
        />
        <ul>
          {[...Array(5)].map((_, i) => (
            <DashboardRowMotion
              key={i}
              index={i}
              interactive={false}
              className="grid grid-cols-1 gap-1.5 border-b border-soft-hairline/60 px-2.5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <SkeletonBlock width={16} height={16} className="shrink-0 rounded-full" />
                <SkeletonBlock width={84} height={14} />
              </span>
              <span className="flex min-w-0 items-center gap-3 pl-6 sm:min-w-[13rem] sm:justify-end sm:pl-0">
                <SkeletonBlock width={52} height={14} />
                <SkeletonBlock width={48} height={14} />
              </span>
            </DashboardRowMotion>
          ))}
        </ul>
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader
          id="activity-label"
          kanji="履歴"
          label={RECENT_LABEL}
          variant="compact"
          description={RECENT_DESCRIPTION}
        />
        <div className="flex min-h-[10rem] items-center py-5">
          <ConnectionErrorNotice sectionName="Recent activity" />
        </div>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader
          id="activity-label"
          kanji="履歴"
          label={RECENT_LABEL}
          variant="compact"
          description={RECENT_DESCRIPTION}
        />
        <UnavailableState
          title="Recent reviews are not connected yet"
          body="The review queue still works. Once history is available, this space will show reviewed cards, rest days, and retention for the last week."
          action={{ href: '/review', label: 'Start reviews' }}
        />
      </section>
    )
  }

  const normalizedRows = rows.map(normalizeActivityRow)

  if (normalizedRows.length === 0) {
    return (
      <section aria-labelledby="activity-label" className={RECENT_CHROME}>
        <CardHeader
          id="activity-label"
          kanji="履歴"
          label={RECENT_LABEL}
          variant="compact"
          description={RECENT_DESCRIPTION}
        />
        <EmptyState
          title="Your first review will draw the week"
          body="After one session, this becomes a seven-day trail of practice and retention."
          action={{ href: '/review', label: 'Start reviews' }}
          visual="recent"
        />
      </section>
    )
  }

  return (
    <section aria-labelledby="activity-label" className={RECENT_CHROME}>
      <CardHeader
        id="activity-label"
        kanji="履歴"
        label={RECENT_LABEL}
        variant="compact"
        description={RECENT_DESCRIPTION}
        rightContent={<span>7 days</span>}
      />

      <RecentReviewsKey />

      <ul>
        {normalizedRows.map((row, index) => (
          <Row key={`${row.date}-${index}`} row={row} index={index} />
        ))}
      </ul>
    </section>
  )
}

function Row({ row, index }: { row: ActivityRow; index: number }): React.JSX.Element {
  if (row.reviewed === null) {
    return (
      <DashboardRowMotion
        index={index}
        interactive={false}
        className="grid grid-cols-1 gap-1.5 border-b border-soft-hairline/60 px-2.5 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <StatusMark tone="progress" />
          <span className="min-w-0 truncate text-sm font-medium text-sumi-ink">{row.date}</span>
        </span>
        <span className="min-w-0 break-words pl-6 font-mono text-sm tracking-wide text-faded-sumi sm:pl-0 sm:text-right">
          in progress
        </span>
      </DashboardRowMotion>
    )
  }

  if (row.reviewed === 0) {
    return (
      <DashboardRowMotion
        index={index}
        interactive={false}
        className="grid grid-cols-1 gap-1 border-b border-soft-hairline/40 px-2.5 py-2 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <StatusMark tone="rest" />
          <span className="min-w-0 truncate font-mono text-sm font-medium tracking-[0.02em] text-faded-sumi/70">{row.date}</span>
        </span>
        <span className="min-w-0 break-words pl-6 font-mono text-[0.625rem] font-medium uppercase tracking-[0.08em] text-faded-sumi/65 sm:pl-0 sm:text-right">
          Rest day
        </span>
      </DashboardRowMotion>
    )
  }

  const retention = row.retention
  const isGoodRetention = retention !== null && retention >= GOOD_RETENTION_THRESHOLD
  const tone = retention !== null ? (isGoodRetention ? 'good' : 'low') : 'progress'

  return (
    <DashboardRowMotion
      index={index}
      interactive={false}
      className="grid grid-cols-1 gap-1.5 border-b border-soft-hairline/70 px-2.5 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-4"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        <StatusMark tone={tone} />
        <span className="min-w-0 truncate text-sm font-semibold text-sumi-ink">{row.date}</span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_1px_4.5rem] items-baseline gap-x-2 gap-y-1 pl-6 font-mono text-sm font-semibold tabular-nums sm:w-[13rem] sm:pl-0">
        <span
          aria-label={`${formatExactCount(row.reviewed)} cards reviewed`}
          className="text-right text-sumi-ink"
        >
          {formatExactCount(row.reviewed)}
        </span>
        <span aria-hidden="true" className="block w-px self-stretch bg-soft-hairline/65" />
        {retention !== null ? (
          <RetentionSummary retention={retention} isGood={isGoodRetention} />
        ) : (
          <span aria-hidden="true" />
        )}
      </span>
    </DashboardRowMotion>
  )
}

function RecentReviewsKey(): React.JSX.Element {
  return (
    <div
      className="grid grid-cols-1 gap-1.5 border-b border-soft-hairline/45 px-2.5 pb-2 pt-1 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-faded-sumi sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4"
    >
      <span className="pl-6">Day</span>
      <span className="hidden pl-6 sm:grid sm:w-[13rem] sm:grid-cols-[minmax(0,1fr)_1px_4.5rem] sm:items-center sm:gap-x-2 sm:pl-0">
        <span className="text-right">Reviewed</span>
        <span aria-hidden="true" className="block w-px self-stretch bg-soft-hairline/70" />
        <span className="text-right">Retention</span>
      </span>
    </div>
  )
}

function RetentionSummary({
  retention,
  isGood,
}: {
  retention: number
  isGood:    boolean
}): React.JSX.Element {
  const percent = Math.round(clampRatio(retention) * 100)
  const label   = isGood ? 'Good' : 'Low'

  return (
    <span
      aria-label={`${label} retention, ${percent}% remembered`}
      className={[
        'shrink-0 text-right text-sm font-semibold tabular-nums tracking-normal',
        isGood
          ? 'text-jlpt-n4-deep-emerald'
          : 'text-jlpt-beyond-amber-warn',
      ].join(' ')}
    >
      {percent}%
    </span>
  )
}

function normalizeActivityRow(row: ActivityRow): ActivityRow {
  const reviewed = row.reviewed === null ? null : safeNonNegativeInteger(row.reviewed)

  return {
    date:      row.date.trim() || 'Review day',
    reviewed,
    retention:
      reviewed !== null &&
      reviewed > 0 &&
      row.retention !== null &&
      Number.isFinite(row.retention)
        ? clampRatio(row.retention)
        : null,
  }
}

function StatusMark({ tone }: { tone: 'progress' | 'rest' | 'good' | 'low' }): React.JSX.Element {
  if (tone === 'rest') {
    return (
      <span
        aria-hidden="true"
        className="h-3.5 w-3.5 shrink-0 rounded-full border border-soft-hairline/70 bg-warm-paper-raised/55"
      />
    )
  }

  if (tone === 'good') {
    return (
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-jlpt-n4-deep-emerald/30 bg-transparent text-[0.625rem] font-semibold leading-none text-jlpt-n4-deep-emerald"
      >
        ✓
      </span>
    )
  }

  if (tone === 'low') {
    return (
      <span
        aria-hidden="true"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[2px] border border-jlpt-beyond-amber-warn/30 bg-transparent text-[0.625rem] font-semibold leading-none text-jlpt-beyond-amber-warn"
      >
        !
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className="h-4 w-4 shrink-0 rounded-full border border-inari-vermillion/25 bg-vermillion-wash"
    />
  )
}
