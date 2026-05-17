import type { ActivityStats } from './types'

interface ActivityStatsStripProps {
  stats: ActivityStats
}

function formatTime(seconds: number): string {
  if (seconds <= 0) return '0 min'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rem   = minutes - hours * 60
  return rem === 0 ? `${hours} hr` : `${hours} hr ${rem} min`
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n)
}

/**
 * Five-stat horizontal strip for the Activity section header.
 * Bricolage display numbers + mono small-caps labels. Bricolage carries
 * the totals; the mono labels read as quiet annotations.
 */
export function ActivityStatsStrip({ stats }: ActivityStatsStripProps): React.JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
      <Stat label="Total reviews"  value={formatNumber(stats.totalReviews)} />
      <Stat label="Total time"     value={formatTime(stats.totalSeconds)} />
      <Stat label="Active days"    value={formatNumber(stats.activeDays)} />
      <Stat label="Current streak" value={`${stats.currentStreak}d`} accent />
      <Stat label="Best streak"    value={`${stats.bestStreak}d`} />
    </dl>
  )
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label:   string
  value:   string
  accent?: boolean
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-1.5">
      <dt className="font-mono text-[0.75rem] uppercase tracking-[0.18em] text-faded-sumi">
        {label}
      </dt>
      <dd
        className={
          accent
            ? 'font-display text-[1.875rem] font-medium leading-none tabular-nums text-inari-vermillion-deep'
            : 'font-display text-[1.875rem] font-medium leading-none tabular-nums text-sumi-ink'
        }
      >
        {value}
      </dd>
    </div>
  )
}
