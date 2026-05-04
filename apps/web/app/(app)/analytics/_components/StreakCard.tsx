'use client'

interface Props {
  currentStreak:  number
  longestStreak:  number
  isLoading:      boolean
}

export function StreakCard({ currentStreak, longestStreak, isLoading }: Props): React.JSX.Element {
  return (
    <article className="p-5 rounded-[var(--radius-lg)] bg-[var(--color-surface-raised)] border border-neutral-200 shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Streak</h3>
      {isLoading ? (
        <div className="h-12 w-24 mt-2 bg-neutral-100 rounded animate-pulse" />
      ) : (
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-neutral-900 tabular-nums">{currentStreak}</span>
          <span className="text-sm text-neutral-500">{currentStreak === 1 ? 'day' : 'days'}</span>
        </div>
      )}
      <p className="mt-1 text-xs text-neutral-500 tabular-nums">
        Longest: {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
      </p>
    </article>
  )
}
