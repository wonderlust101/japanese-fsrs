import type { ActivityStats } from './types'
import { StatTile } from '@/components/ui/StatTile'

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
 * Effort summary for the Activity section header: total reviews, total time,
 * and active days, rendered through the shared <StatTile>. Streak figures were
 * intentionally dropped (streak UI is deferred per DESIGN.md); this strip
 * stays a quiet read of volume, not a leaderboard.
 */
export function ActivityStatsStrip({ stats }: ActivityStatsStripProps): React.JSX.Element {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3">
      <StatTile label="Total reviews" value={formatNumber(stats.totalReviews)} />
      <StatTile label="Total time"    value={formatTime(stats.totalSeconds)} />
      <StatTile label="Active days"   value={formatNumber(stats.activeDays)} />
    </dl>
  )
}
