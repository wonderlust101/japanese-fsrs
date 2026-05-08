const BARS = [
  { key: 'again', label: 'Again', bar: 'bg-error'  },
  { key: 'hard',  label: 'Hard',  bar: 'bg-jlpt-beyond-amber-warn' },
  { key: 'good',  label: 'Good',  bar: 'bg-jlpt-n5-fresh-leaf' },
  { key: 'easy',  label: 'Easy',  bar: 'bg-inari-vermillion' },
] as const

interface Props {
  breakdown: { again: number; hard: number; good: number; easy: number }
  total:     number
}

export function RatingBreakdown({ breakdown, total }: Props): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      {BARS.map(({ key, label, bar }) => {
        const count = breakdown[key]
        const pct   = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-10 text-right text-xs text-faded-sumi shrink-0">{label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-cream-inset overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-5 text-right text-xs font-medium text-sumi-ink shrink-0">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
