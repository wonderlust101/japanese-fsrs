'use client'

import type { ForecastDay } from '@/lib/actions/reviews.actions'

interface Props {
  data:      ForecastDay[]
  isLoading: boolean
}

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildNext14Days(byDate: Map<string, number>): { date: string; count: number; label: string; isToday: boolean }[] {
  const out: { date: string; count: number; label: string; isToday: boolean }[] = []
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() + i)
    const ymd  = d.toISOString().slice(0, 10)
    const dow  = d.getUTCDay()
    const dn   = String(d.getUTCDate()).padStart(2, '0')
    out.push({
      date:    ymd,
      count:   byDate.get(ymd) ?? 0,
      label:   `${DAY_ABBR[dow]} ${dn}`,
      isToday: i === 0,
    })
  }
  return out
}

export function ReviewForecastChart({ data, isLoading }: Props): React.JSX.Element {
  const byDate = new Map(data.map((d) => [d.date, d.count]))
  const days   = buildNext14Days(byDate)
  const max    = Math.max(1, ...days.map((d) => d.count))

  return (
    <section className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-neutral-200 shadow-[var(--shadow-card)]">
      <header className="flex items-baseline justify-between mb-4">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
          Review forecast — next 14 days
        </h2>
        <span className="text-xs text-neutral-500 tabular-nums">
          peak {max}
        </span>
      </header>

      {isLoading ? (
        <div className="h-32 bg-neutral-100 rounded animate-pulse" />
      ) : (
        <ol className="grid grid-cols-7 sm:grid-cols-14 gap-2 items-end h-32">
          {days.map((d) => {
            const h = Math.round((d.count / max) * 100)
            return (
              <li
                key={d.date}
                className="flex flex-col items-center gap-1"
                title={`${d.date} — ${d.count} review${d.count === 1 ? '' : 's'}`}
              >
                <span className="text-[10px] tabular-nums text-neutral-500">{d.count}</span>
                <div
                  className={[
                    'w-full rounded-sm transition-all',
                    d.isToday ? 'bg-primary-500' : 'bg-primary-300',
                  ].join(' ')}
                  style={{ height: `${Math.max(h, 2)}%` }}
                  aria-label={`${d.label}: ${d.count} reviews`}
                />
                <span className="text-[10px] text-neutral-400 truncate w-full text-center">{d.label}</span>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
