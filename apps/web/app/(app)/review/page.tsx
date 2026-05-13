'use client'

import { useRouter } from 'next/navigation'

import { Button }            from '@/components/ui/Button'
import { useDueCards, useReviewForecast } from '@/lib/api/reviews'
import { useSessionActions } from '@/stores/useReviewSessionStore'
import { OfflineQueueBanner } from './_components/offline-queue-banner'

export default function ReviewHubPage(): React.JSX.Element {
  const router = useRouter()
  const { startSession } = useSessionActions()

  const { data: dueResult, isLoading: loadingDue } = useDueCards()
  const { data: forecastResult }                    = useReviewForecast()

  const dueCards = dueResult?.items      ?? []
  const forecast = forecastResult?.items ?? []

  function handleStart() {
    if (dueCards.length === 0) return
    startSession(dueCards)
    router.push('/review/session')
  }

  return (
    <div className="flex flex-col items-center px-4 py-12 gap-8 max-w-xl mx-auto">
      <OfflineQueueBanner />
      <div className="w-full rounded-[14px] bg-warm-paper-raised shadow-card p-8 flex flex-col items-center gap-4">
        <p className="text-5xl font-bold text-sumi-ink">
          {loadingDue ? '—' : dueCards.length}
        </p>
        <p className="text-sm text-faded-sumi">cards due today</p>
        <Button
          onClick={handleStart}
          disabled={loadingDue || dueCards.length === 0}
          className="w-full max-w-xs"
        >
          {dueCards.length === 0 ? 'Desk is clear' : 'Start reviews'}
        </Button>
      </div>

      {forecast.length > 0 && (
        <div className="w-full rounded-[14px] bg-warm-paper-raised shadow-card p-6 flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-faded-sumi">
            Upcoming reviews
          </h2>
          <ul className="flex flex-col gap-2">
            {forecast.slice(0, 7).map(({ date, count }) => (
              <li key={date} className="flex items-center justify-between text-sm">
                <span className="text-faded-sumi">{date}</span>
                <span className="font-medium text-sumi-ink">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
