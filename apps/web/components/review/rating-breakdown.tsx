const BARS = [
  { key: 'again', label: 'Again', bar: 'bg-danger-500'  },
  { key: 'hard',  label: 'Hard',  bar: 'bg-warning-500' },
  { key: 'good',  label: 'Good',  bar: 'bg-success-500' },
  { key: 'easy',  label: 'Easy',  bar: 'bg-primary-500' },
] as const

interface Props {
  breakdown: { again: number; hard: number; good: number; easy: number }
  total:     number
}

export function RatingBreakdown({ breakdown, total }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {BARS.map(({ key, label, bar }) => {
        const count = breakdown[key]
        const pct   = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-10 text-right text-xs text-neutral-500 shrink-0">{label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-neutral-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-500 ${bar}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-5 text-right text-xs font-medium text-neutral-700 shrink-0">{count}</span>
          </div>
        )
      })}
    </div>
  )
}
