'use client'

import { useReviewQueue, useCurrentIndex } from '@/stores/useReviewSessionStore'

export function SessionProgress(): React.JSX.Element {
  const queue        = useReviewQueue()
  const currentIndex = useCurrentIndex()

  const total      = queue.length
  const completed  = Math.min(currentIndex, total)
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={percentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${completed} of ${total} cards reviewed`}
      className="h-1.5 bg-neutral-200 shrink-0"
    >
      <div
        style={{ width: `${percentage}%` }}
        className="h-full bg-primary-500 transition-[width] duration-[300ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
      />
    </div>
  )
}
