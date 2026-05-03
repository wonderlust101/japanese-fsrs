'use client'

import type { HeatmapDay } from '@/lib/actions/analytics.actions'

interface Props {
  data:      HeatmapDay[]
  isLoading: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function toYMD(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function dotColor(day: HeatmapDay | undefined): string {
  if (day === undefined || day.count === 0) return 'bg-neutral-200'
  if (day.retention >= 85)                  return 'bg-primary-500'
  return 'bg-warning-500'
}

function dotTitle(ymd: string, day: HeatmapDay | undefined): string {
  if (day === undefined || day.count === 0) return `${ymd} — no reviews`
  return `${ymd} — ${day.retention}% retention (${day.count} review${day.count === 1 ? '' : 's'})`
}

/** Returns an array of { year, month (0-based), days[] } covering the last 365 days. */
function buildMonthRows(): Array<{ year: number; month: number; days: Date[] }> {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 364)

  const months: Array<{ year: number; month: number; days: Date[] }> = []

  let cursor = new Date(start)
  cursor.setDate(1) // start at the 1st of the month containing `start`

  while (cursor <= today) {
    const year  = cursor.getFullYear()
    const month = cursor.getMonth()
    const days: Date[] = []

    const d = new Date(year, month, 1)
    while (d.getMonth() === month && d <= today) {
      if (d >= start) days.push(new Date(d))
      d.setDate(d.getDate() + 1)
    }

    if (days.length > 0) months.push({ year, month, days })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function HeatmapSkeleton() {
  return (
    <div className="animate-pulse space-y-1.5">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="h-3 w-8 bg-neutral-200 rounded shrink-0" />
          {Array.from({ length: 28 }).map((__, j) => (
            <div key={j} className="h-3 w-3 bg-neutral-100 rounded-sm" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RetentionHeatmap({ data, isLoading }: Props) {
  const dayMap = new Map<string, HeatmapDay>(data.map((d) => [d.date, d]))
  const months = buildMonthRows()

  return (
    <section
      aria-label="Retention heatmap"
      className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5 space-y-4"
    >
      <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Retention Heatmap
      </h2>

      {isLoading ? (
        <HeatmapSkeleton />
      ) : (
        <div className="space-y-1.5 overflow-x-auto">
          {months.map(({ year, month, days }) => (
            <div key={`${year}-${month}`} className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400 w-8 shrink-0 select-none">
                {MONTH_ABBR[month]}
              </span>
              {days.map((d) => {
                const ymd = toYMD(d)
                const entry = dayMap.get(ymd)
                return (
                  <div
                    key={ymd}
                    title={dotTitle(ymd, entry)}
                    className={`h-3 w-3 rounded-sm shrink-0 ${dotColor(entry)}`}
                    aria-label={dotTitle(ymd, entry)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-1">
        <LegendDot color="bg-neutral-200"  label="missed" />
        <LegendDot color="bg-primary-500"  label="85%+"   />
        <LegendDot color="bg-warning-500"  label="<85%"   />
      </div>
    </section>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500 select-none">
      <span className={`h-2.5 w-2.5 rounded-sm ${color}`} aria-hidden="true" />
      {label}
    </span>
  )
}
