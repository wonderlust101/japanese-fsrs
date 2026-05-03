'use client'

import { useRouter } from 'next/navigation'

import { Button }            from '@/components/ui/button'
import { useDueCards, useReviewForecast } from '@/lib/api/reviews'
import { useSessionActions } from '@/stores/useReviewSessionStore'

export default function ReviewHubPage() {
  const router = useRouter()
  const { startSession } = useSessionActions()

  const { data: dueCards = [], isLoading: loadingDue } = useDueCards()
  const { data: forecast = [] }                         = useReviewForecast()

  function handleStart() {
    if (dueCards.length === 0) return
    startSession(dueCards)
    router.push('/review/session')
  }

  return (
    <div className="flex flex-col items-center px-4 py-12 gap-8 max-w-xl mx-auto">
      <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-8 flex flex-col items-center gap-4">
        <p className="text-5xl font-bold text-neutral-900">
          {loadingDue ? '—' : dueCards.length}
        </p>
        <p className="text-sm text-neutral-500">cards due today</p>
        <Button
          onClick={handleStart}
          disabled={loadingDue || dueCards.length === 0}
          className="w-full max-w-xs"
        >
          {dueCards.length === 0 ? 'All caught up!' : 'Start Review'}
        </Button>
      </div>

      {forecast.length > 0 && (
        <div className="w-full rounded-[14px] bg-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] p-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            Upcoming
          </h2>
          <ul className="flex flex-col gap-2">
            {forecast.slice(0, 7).map(({ date, count }) => (
              <li key={date} className="flex items-center justify-between text-sm">
                <span className="text-neutral-600">{date}</span>
                <span className="font-medium text-neutral-900">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
