// One stacked horizontal bar keyed to the review-session rating palette
// (`--color-rating-{again,hard,good,easy}` in globals.css — the same tokens
// the in-session RatingBar uses). Closing the session in the same color
// language the learner just rated in means a glance at the bar maps
// directly to their muscle memory from the past 5 minutes. Segments below
// ~5% of the bar width are clamped to a minimum so even a single Again
// read stays visible.

interface Breakdown {
  again: number
  hard:  number
  good:  number
  easy:  number
}

interface Props {
  breakdown: Breakdown
  total:     number
}

const SEGMENTS = [
  { key: 'again', label: 'Again', bg: 'bg-rating-again' },
  { key: 'hard',  label: 'Hard',  bg: 'bg-rating-hard'  },
  { key: 'good',  label: 'Good',  bg: 'bg-rating-good'  },
  { key: 'easy',  label: 'Easy',  bg: 'bg-rating-easy'  },
] as const

export function RatingDistributionBar({ breakdown, total }: Props): React.JSX.Element {
  const safeTotal = Math.max(total, 1)
  const segments = SEGMENTS.map((s) => {
    const count = breakdown[s.key]
    const pct   = (count / safeTotal) * 100
    return { ...s, count, pct }
  })

  // Build an ARIA description so the bar reads as a sentence to screen readers
  // ("Again 3, Hard 5, Good 22, Easy 12 of 42 cards") instead of a stack of
  // unlabelled boxes.
  const ariaLabel = `Rating breakdown: ${segments
    .map((s) => `${s.label} ${s.count}`)
    .join(', ')}. Total ${total} ${total === 1 ? 'card' : 'cards'}.`

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex w-full h-7 overflow-hidden rounded-xs border border-soft-hairline bg-cream-inset"
      >
        {segments.map((s) => {
          if (s.count === 0) return null
          // Apply a soft minimum width so even a 1-of-50 rating remains
          // visible. The minimum stays small enough that two healthy ratings
          // still dominate the bar.
          const displayPct = Math.max(s.pct, 1.5)
          return (
            <div
              key={s.key}
              className={`${s.bg} h-full first:rounded-l-[1px] last:rounded-r-[1px]`}
              style={{ width: `${displayPct}%` }}
            />
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-4 text-xs text-faded-sumi font-mono">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`inline-block h-2 w-2 rounded-[1px] ${s.bg}`}
            />
            <span className="uppercase tracking-[0.08em]">{s.label}</span>
            <span className="text-sumi-ink font-medium">{s.count}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * Builds the takeaway line that sits beside the bar. Names the dominant
 * rating and, when it differs, the most salient other rating. Stays plain
 * and adult; never congratulates.
 */
export function buildDistributionTakeaway(breakdown: Breakdown, total: number): string {
  if (total === 0) return 'No cards rated.'
  const entries = [
    { key: 'again' as const, label: 'Again',  count: breakdown.again },
    { key: 'hard'  as const, label: 'Hard',   count: breakdown.hard  },
    { key: 'good'  as const, label: 'Good',   count: breakdown.good  },
    { key: 'easy'  as const, label: 'Easy',   count: breakdown.easy  },
  ].sort((a, b) => b.count - a.count)

  const top    = entries[0]
  const second = entries[1]
  if (top === undefined) return 'No cards rated.'
  const topShare = top.count / total

  if (topShare >= 0.85) return `Almost all ${top.label}.`
  if (topShare >= 0.6)  return `Mostly ${top.label}.`

  if (second === undefined || second.count === 0) return `Mostly ${top.label}.`
  return `Mostly ${top.label}, with some ${second.label}.`
}
