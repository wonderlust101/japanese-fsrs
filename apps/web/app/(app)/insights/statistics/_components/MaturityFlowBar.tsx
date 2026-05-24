import { cn } from '@/lib/utils'

import type { MaturityCounts } from './types'

interface MaturityFlowBarProps {
  counts: MaturityCounts
}

interface Stage {
  key:   keyof MaturityCounts
  label: string
  /** Tailwind bg class for the segment + swatch. Each stage gets a vivid,
   *  semantically-distinct color — none of which overlap with the four
   *  rating-button colors (sumi-ink / amber-warn / fresh-leaf / aizome). */
  bg:    string
}

/**
 * Five-stage maturity flow visualization. The stages run left-to-right
 * in the order cards move through them (new → learning → young → mature),
 * with suspended sitting separately at the end. Each stage's width is
 * proportional to its count.
 *
 * Color story: a single-hue vermillion alpha ramp from lightest (new) to
 * fully saturated (mature). The brand's deep red represents the
 * destination state — "the more mature a card, the more deeply it lives
 * in Tomo's identity." Suspended drops out of the ramp into a grey to
 * signal "paused, not progressing."
 */
export function MaturityFlowBar({ counts }: MaturityFlowBarProps): React.JSX.Element {
  const stages: Stage[] = [
    { key: 'new',       label: 'New',       bg: 'bg-inari-vermillion-deep/25' },
    { key: 'learning',  label: 'Learning',  bg: 'bg-inari-vermillion-deep/45' },
    { key: 'young',     label: 'Young',     bg: 'bg-inari-vermillion-deep/70' },
    { key: 'mature',    label: 'Mature',    bg: 'bg-inari-vermillion-deep'    },
    { key: 'suspended', label: 'Suspended', bg: 'bg-faded-sumi'               },
  ]

  const activeTotal = stages
    .filter((s) => s.key !== 'suspended')
    .reduce((acc, s) => acc + counts[s.key], 0)
  const totalCards = activeTotal + counts.suspended
  const safeTotal = Math.max(1, totalCards)

  return (
    <figure className="flex flex-col gap-y-6">
      {/* The flow bar: every stage (including suspended) rendered as a
          proportional segment. Suspended sits at the right end in grey,
          visually stepped out of the vermillion ramp. */}
      <div className="flex flex-col gap-y-3">
        <div
          role="img"
          aria-label={
            `Maturity flow: ${counts.new} new, ${counts.learning} learning, ${counts.young} young, ${counts.mature} mature, ${counts.suspended} suspended.`
          }
          className="flex h-11 w-full overflow-hidden rounded-[2px] border border-soft-hairline"
        >
          {stages.map((stage) => {
            const value = counts[stage.key]
            if (value === 0) return null
            const widthPct = (value / safeTotal) * 100
            return (
              <span
                key={stage.key}
                aria-hidden="true"
                title={`${stage.label}: ${value} cards`}
                className={cn(
                  'block h-full border-r border-warm-paper-raised/85 last:border-r-0',
                  stage.bg,
                )}
                style={{ width: `${widthPct}%` }}
              />
            )
          })}
        </div>
        <p className="font-mono text-sm tabular-nums text-faded-sumi">
          Flow <span className="text-sumi-ink/70">·</span>{' '}
          <span className="text-sumi-ink/85">{activeTotal} active cards</span>
          {counts.suspended > 0 && (
            <>
              <span className="text-sumi-ink/70"> · </span>
              {counts.suspended} suspended
            </>
          )}
          <span className="text-sumi-ink/70"> · </span>
          {totalCards} total
        </p>
      </div>

      {/* Stage legend with counts */}
      <ul className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-5">
        {stages.map((stage) => {
          const value = counts[stage.key]
          const pct = totalCards > 0 ? Math.round((value / totalCards) * 100) : 0
          return (
            <li key={stage.key} className="flex flex-col gap-y-1">
              <div className="flex items-baseline gap-x-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'inline-block h-[10px] w-[10px] shrink-0 rounded-[2px]',
                    stage.bg,
                  )}
                />
                <span className="font-mono text-sm text-faded-sumi">
                  {stage.label}
                </span>
              </div>
              <div className="flex items-baseline gap-x-2">
                <span className="font-display text-[1.375rem] font-medium leading-none tabular-nums text-sumi-ink">
                  {value}
                </span>
                <span className="font-mono text-sm tabular-nums text-faded-sumi">
                  {pct}%
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
