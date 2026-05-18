'use client'

import { formatExactCount } from '@/app/(app)/today/_components/today-format'

import { StagingOfflineChip } from './staging-offline-chip'

export interface YesterdayStat {
  reviewed:  number
  retention: number | null
}

interface StagingMetadataRowProps {
  yesterday: YesterdayStat | null
  /** Reserved for the weakSpot-count chip once the dashboard list API exists. */
  leechCount: number | null
}

/**
 * Editorial metadata strip rendered at the top of the briefing card. Holds
 * three discrete signals — yesterday's recap, the weakSpot count, and the
 * offline-queue chip — in a single dot-separated mono row. Each segment
 * renders only when it has something to say; if no segment qualifies,
 * the row renders nothing and the briefing kicker becomes the first line.
 */
export function StagingMetadataRow({
  yesterday,
  leechCount,
}: StagingMetadataRowProps): React.JSX.Element | null {
  const yesterdayLabel = formatYesterday(yesterday)
  const showLeeches    = leechCount !== null && leechCount > 0
  // The offline chip self-renders to null when there's no queue, so the row
  // can't predict its presence without a query of its own. We always pass it
  // through and rely on the outer flex-gap + dot separators to collapse.

  // Build a list of nodes; intersperse dots between them at low opacity. A
  // sentinel approach (each segment optionally renders + a leading dot) is
  // cleaner than an Array.join because React children aren't strings.
  const segments: React.ReactNode[] = []

  if (yesterdayLabel !== null) {
    segments.push(<YesterdaySegment key="yesterday" label={yesterdayLabel} />)
  }
  if (showLeeches) {
    segments.push(<LeechesSegment key="weakSpots" count={leechCount as number} />)
  }
  // Offline chip is its own segment but only renders when queue > 0. To keep
  // separators in sync we always include it; if it returns null the wrapping
  // span still occupies no width.
  segments.push(<StagingOfflineChip key="offline" />)

  // Strip out leading null/undefined entries so the dot logic doesn't add
  // a leading dot before the first visible segment.
  const visibleSegments = segments.filter(Boolean)
  if (visibleSegments.length === 0) return null

  return (
    <p
      aria-label="Page status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3"
    >
      {visibleSegments.map((segment, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span aria-hidden="true" className="text-faded-sumi/35">·</span>
          )}
          {segment}
        </span>
      ))}
    </p>
  )
}

function formatYesterday(stat: YesterdayStat | null): string | null {
  if (stat === null) return null
  if (stat.reviewed === 0) return 'paused'
  if (stat.retention === null || !Number.isFinite(stat.retention)) {
    return `${formatExactCount(stat.reviewed)} cards`
  }
  const retention = Math.round(stat.retention)
  return `${formatExactCount(stat.reviewed)} at ${retention}%`
}

function YesterdaySegment({ label }: { label: string }): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
      <span
        lang="ja"
        aria-hidden="true"
        className="select-none text-[0.875rem] text-inari-vermillion/70 leading-none translate-y-[0.06em]"
      >
        昨日
      </span>
      <span>{label}</span>
    </span>
  )
}

function LeechesSegment({ count }: { count: number }): React.JSX.Element {
  return (
    <span className="inline-flex items-baseline gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-error/55" />
      <span>{formatExactCount(count)} weakSpots in queue</span>
    </span>
  )
}
