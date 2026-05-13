'use client'

import type { ApiHeatmapDay } from '@fsrs-japanese/shared-types'

interface Props {
  heatmap:    ApiHeatmapDay[]
  isLoading:  boolean
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

export function TodayProgressCard({ heatmap, isLoading }: Props): React.JSX.Element {
  const today    = todayUtc()
  const todayRow = heatmap.find((d) => d.date === today)
  const count    = todayRow?.count ?? 0
  const retention = todayRow?.retention ?? 0

  return (
    <article className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-soft-hairline shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold text-faded-sumi uppercase tracking-wider">Today</h3>
      {isLoading ? (
        <div className="h-12 w-24 mt-2 bg-cream-inset rounded animate-pulse" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-sumi-ink tabular-nums">{count}</span>
          <span className="text-sm text-faded-sumi">
            {count === 1 ? 'review' : 'reviews'} done
          </span>
        </div>
      )}
      <p className="mt-1 text-xs text-faded-sumi tabular-nums">
        {count > 0 ? `${retention}% retention` : 'Start reviews. Your streak is waiting.'}
      </p>
    </article>
  )
}
