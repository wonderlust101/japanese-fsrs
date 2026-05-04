'use client'

import type {
  JlptGapRow,
  MilestoneForecastRow,
} from '@/lib/actions/analytics.actions'

interface Props {
  gap:        JlptGapRow[]
  milestones: MilestoneForecastRow[]
  isLoading:  boolean
}

const ORDER = ['N5', 'N4', 'N3', 'N2', 'N1', 'beyond_jlpt'] as const

const JLPT_BG: Record<string, string> = {
  N5:          'var(--color-jlpt-n5-bg)',
  N4:          'var(--color-jlpt-n4-bg)',
  N3:          'var(--color-jlpt-n3-bg)',
  N2:          'var(--color-jlpt-n2-bg)',
  N1:          'var(--color-jlpt-n1-bg)',
  beyond_jlpt: 'var(--color-jlpt-beyond-bg)',
}

const JLPT_FG: Record<string, string> = {
  N5:          'var(--color-jlpt-n5-text)',
  N4:          'var(--color-jlpt-n4-text)',
  N3:          'var(--color-jlpt-n3-text)',
  N2:          'var(--color-jlpt-n2-text)',
  N1:          'var(--color-jlpt-n1-text)',
  beyond_jlpt: 'var(--color-jlpt-beyond-text)',
}

function labelFor(level: string): string {
  return level === 'beyond_jlpt' ? 'Beyond' : level
}

function formatDate(iso: string | null): string {
  if (iso === null) return '—'
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function JLPTProgressBars({ gap, milestones, isLoading }: Props): React.JSX.Element {
  const gapByLevel       = new Map(gap.map((g) => [g.jlptLevel, g]))
  const milestoneByLevel = new Map(milestones.map((m) => [m.jlptLevel, m]))

  const visible = ORDER.filter((lvl) => gapByLevel.has(lvl) || milestoneByLevel.has(lvl))

  return (
    <section className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-neutral-200 shadow-[var(--shadow-card)]">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
        JLPT progress
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-neutral-100 rounded animate-pulse" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Subscribe to a JLPT premade deck to start tracking your gap to each level.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((lvl) => {
            const g = gapByLevel.get(lvl)
            const m = milestoneByLevel.get(lvl)
            const total      = g?.total ?? m?.total ?? 0
            const learned    = g?.learned ?? m?.learned ?? 0
            const pct        = g?.progressPct
              ?? (total > 0 ? Math.round((learned / total) * 1000) / 10 : 0)
            const projection = m?.projectedCompletionDate ?? null

            return (
              <li key={lvl} className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums"
                  style={{ backgroundColor: JLPT_BG[lvl], color: JLPT_FG[lvl] }}
                >
                  {labelFor(lvl)}
                </span>
                <div className="relative h-3 rounded-full bg-neutral-100 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width:           `${Math.min(100, pct)}%`,
                      backgroundColor: JLPT_FG[lvl],
                    }}
                    role="progressbar"
                    aria-valuenow={pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>
                <div className="flex flex-col items-end text-xs tabular-nums">
                  <span className="font-medium text-neutral-700">{pct}%</span>
                  <span className="text-neutral-400">
                    {learned} / {total}
                  </span>
                </div>
                {projection !== null && (
                  <span className="col-span-3 text-xs text-neutral-500 pl-12">
                    Projected complete: <strong className="text-neutral-700">{formatDate(projection)}</strong>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
