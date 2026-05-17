import type { ProgressData } from './progressTypes'
import { buildSummaryLine } from './progressInterpretation'

interface ProgressSummaryStripProps {
  data: ProgressData
}

interface Tile {
  label: string
  value: string
  hint?: string
}

function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/**
 * Summary SectionCard body. Four stat tiles followed by a two-line
 * plain-language read. Tiles use a flat type pair (mono small-caps label
 * over tabular display value) with no icons, no deltas, no hero numbers.
 * Deltas live in the prose underneath; this strip is the snapshot.
 */
export function ProgressSummaryStrip({ data }: ProgressSummaryStripProps): React.JSX.Element {
  const { summary } = data
  const tiles: Tile[] = [
    {
      label: 'Mature cards',
      value: fmt(summary.matureCount),
      hint:  'in long-term storage',
    },
    {
      label: 'Retention, 30d',
      value: pct(summary.retention30d),
      hint:  `target ${pct(data.desiredRetention)}`,
    },
    {
      label: 'Active days',
      value: `${summary.activeDaysLast30} / 30`,
      hint:  'of the past 30 days',
    },
    {
      label: 'Added this month',
      value: `+${fmt(summary.cardsAddedThisMonth)}`,
      hint:  'new cards',
    },
  ]

  return (
    <div className="flex flex-col gap-y-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 sm:gap-x-8">
        {tiles.map((t) => (
          <div key={t.label} className="flex flex-col gap-y-1.5">
            <dt className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              {t.label}
            </dt>
            <dd className="flex items-baseline gap-x-2">
              <span className="font-display text-[1.5rem] font-medium leading-none tabular-nums text-sumi-ink sm:text-[1.625rem]">
                {t.value}
              </span>
            </dd>
            {t.hint !== undefined && (
              <span className="font-mono text-[0.6875rem] tabular-nums text-faded-sumi">
                {t.hint}
              </span>
            )}
          </div>
        ))}
      </dl>

      <p className="max-w-prose text-sm italic leading-relaxed text-sumi-ink/85">
        {buildSummaryLine(data)}
      </p>
    </div>
  )
}
