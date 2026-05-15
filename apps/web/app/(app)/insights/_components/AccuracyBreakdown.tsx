'use client'

import { BarChart2 } from 'lucide-react'

import type { ApiLayoutAccuracy } from '@fsrs-japanese/shared-types'

interface Props {
  data:      ApiLayoutAccuracy[]
  isLoading: boolean
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function BreakdownSkeleton() {
  return (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Bar chart skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <div className="h-3 w-24 bg-cream-inset rounded" />
              <div className="h-3 w-8 bg-cream-inset rounded" />
            </div>
            <div className="h-2 w-full bg-cream-inset rounded-full" />
          </div>
        ))}
      </div>
      {/* Text breakdown skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-28 bg-cream-inset rounded" />
            <div className="h-3 w-10 bg-cream-inset rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-surface-inset)]">
        <BarChart2 size={22} strokeWidth={1.5} className="text-faded-sumi" aria-hidden="true" />
      </div>
      <p className="text-sm text-faded-sumi">No review history yet.</p>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AccuracyBreakdown({ data, isLoading }: Props): React.JSX.Element {
  return (
    <section
      aria-label="Accuracy breakdown by layout"
      className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-4"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-faded-sumi">
          Accuracy by Layout
        </h2>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-faded-sumi md:text-right">
          Layout Breakdown
        </h2>
      </div>

      {isLoading ? (
        <BreakdownSkeleton />
      ) : data.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left — horizontal bar chart */}
          <div className="space-y-4">
            {data.map((row) => (
              <div key={row.layout} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-sumi-ink capitalize">{row.layout}</span>
                  <span className="text-sm font-medium text-sumi-ink tabular-nums">
                    {row.accuracyPct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-cream-inset" role="progressbar" aria-valuenow={row.accuracyPct} aria-valuemin={0} aria-valuemax={100}>
                  <div
                    className="h-2 rounded-full bg-inari-vermillion transition-[width] duration-500"
                    style={{ width: `${row.accuracyPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Right — text breakdown */}
          <div className="space-y-3 md:border-l md:border-[var(--color-border-subtle)] md:pl-6">
            {data.map((row) => (
              <div key={row.layout} className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-sumi-ink capitalize">{row.layout}</span>
                <span className="text-sm font-semibold text-sumi-ink tabular-nums">
                  {row.accuracyPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
