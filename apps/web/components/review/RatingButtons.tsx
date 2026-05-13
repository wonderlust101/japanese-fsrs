'use client'

import type { UserRating } from '@fsrs-japanese/shared-types'

const RATINGS: Array<{ value: UserRating; label: string; key: string; colors: string }> = [
  { value: 'again', label: 'Again', key: '1', colors: 'bg-sumi-ink                focus-visible:ring-sumi-ink'                },
  { value: 'hard',  label: 'Hard',  key: '2', colors: 'bg-jlpt-beyond-amber-warn focus-visible:ring-jlpt-beyond-amber-warn' },
  { value: 'good',  label: 'Good',  key: '3', colors: 'bg-jlpt-n5-fresh-leaf     focus-visible:ring-jlpt-n5-fresh-leaf'     },
  { value: 'easy',  label: 'Easy',  key: '4', colors: 'bg-aizome-indigo          focus-visible:ring-aizome-indigo'          },
]

interface Props {
  onRate: (rating: UserRating) => void
}

export function RatingButtons({ onRate }: Props): React.JSX.Element {
  return (
    <div className="w-full max-w-[640px] grid grid-cols-4 gap-3">
      {RATINGS.map(({ value, label, key, colors }) => (
        <button
          key={value}
          onClick={() => onRate(value)}
          className={`ui-motion-pressable h-16 rounded-lg flex flex-col items-center justify-center gap-0.5 text-warm-paper-raised font-medium
            cursor-pointer hover:brightness-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            ${colors}`}
        >
          <span className="text-sm">{label}</span>
          <span className="text-xs opacity-70">{key}</span>
        </button>
      ))}
    </div>
  )
}
