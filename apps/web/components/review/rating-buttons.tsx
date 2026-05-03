'use client'

import type { ReviewRating } from '@fsrs-japanese/shared-types'

const RATINGS: Array<{ value: ReviewRating; label: string; key: string; colors: string }> = [
  { value: 'again', label: 'Again', key: '1', colors: 'bg-danger-500  hover:bg-danger-700  focus-visible:ring-danger-500'  },
  { value: 'hard',  label: 'Hard',  key: '2', colors: 'bg-warning-500 hover:bg-warning-700 focus-visible:ring-warning-500' },
  { value: 'good',  label: 'Good',  key: '3', colors: 'bg-success-500 hover:bg-success-700 focus-visible:ring-success-500' },
  { value: 'easy',  label: 'Easy',  key: '4', colors: 'bg-primary-500 hover:bg-primary-700 focus-visible:ring-primary-500' },
]

interface Props {
  onRate: (rating: ReviewRating) => void
}

export function RatingButtons({ onRate }: Props) {
  return (
    <div className="w-full max-w-[640px] grid grid-cols-4 gap-3">
      {RATINGS.map(({ value, label, key, colors }) => (
        <button
          key={value}
          onClick={() => onRate(value)}
          className={`h-16 rounded-lg flex flex-col items-center justify-center gap-0.5 text-white font-medium
            cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
            ${colors}`}
        >
          <span className="text-sm">{label}</span>
          <span className="text-xs opacity-70">{key}</span>
        </button>
      ))}
    </div>
  )
}
