'use client'

import type { HeatmapDay } from '@/lib/actions/analytics.actions'

interface Props {
  heatmap:    HeatmapDay[]
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
    <article className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-neutral-200 shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Today</h3>
      {isLoading ? (
        <div className="h-12 w-24 mt-2 bg-neutral-100 rounded animate-pulse" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-neutral-900 tabular-nums">{count}</span>
          <span className="text-sm text-neutral-500">
            {count === 1 ? 'review' : 'reviews'} done
          </span>
        </div>
      )}
      <p className="mt-1 text-xs text-neutral-500 tabular-nums">
        {count > 0 ? `${retention}% retention` : 'Get started — your streak is waiting.'}
      </p>
    </article>
  )
}
