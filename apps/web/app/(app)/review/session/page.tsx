'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter }                   from 'next/navigation'

import { ReviewCard }                      from '@/components/review/review-card'
import { useSubmitReview, useOfflineSync } from '@/lib/api/reviews'
import {
  useCurrentCard,
  useIsSessionStarted,
  useSessionHistory,
  useSessionId,
  useSessionActions,
} from '@/stores/useReviewSessionStore'

export default function ReviewSessionPage() {
  const router         = useRouter()
  const isStarted      = useIsSessionStarted()
  const currentCard    = useCurrentCard()
  const sessionHistory = useSessionHistory()
  const sessionId      = useSessionId()
  const { endSession } = useSessionActions()
  const { mutate: submitReview, isError } = useSubmitReview()
  const [hasSyncError, setHasSyncError] = useState(false)
  const processedRef   = useRef(0)
  const cardShownAtRef = useRef<number>(Date.now())

  useOfflineSync()

  // Guard: redirect only when there is no active session. The "queue exhausted"
  // case is handled inside effect ① so that navigation waits for the last
  // mutation to settle rather than racing with it.
  useEffect(() => {
    if (!isStarted) {
      router.replace('/review')
    }
  }, [isStarted, router])

  // ① Fire mutation when sessionHistory grows. For the last card, navigation
  // is deferred to onSettled so the hub refetch sees the fully-updated DB.
  useEffect(() => {
    if (sessionHistory.length <= processedRef.current) return
    processedRef.current = sessionHistory.length
    const last = sessionHistory.at(-1)
    if (last === undefined) return

    const reviewTimeMs = Date.now() - cardShownAtRef.current
    const isLastCard   = currentCard === undefined

    submitReview(
      { cardId: last.card.id, rating: last.rating, reviewTimeMs, ...(sessionId !== null ? { sessionId } : {}) },
      isLastCard
        ? {
            onSettled: () => {
              endSession()
              router.replace(`/review/summary?id=${sessionId}`)
            },
          }
        : undefined,
    )
  }, [sessionHistory, submitReview, currentCard, endSession, sessionId, router])

  // ② Reset card timer after mutation fires (declared after ① so it runs second)
  useEffect(() => {
    if (currentCard !== undefined) {
      cardShownAtRef.current = Date.now()
    }
  }, [currentCard?.id])

  // Track cumulative submission failures so the banner stays visible
  useEffect(() => {
    if (isError) setHasSyncError(true)
  }, [isError])

  if (!isStarted || currentCard === undefined) return null

  return (
    <>
      {hasSyncError && (
        <div className="mx-4 mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2 text-sm text-red-700">
          Review sync failed — check the browser console for details. Progress is saved offline and will retry automatically.
        </div>
      )}
      <ReviewCard />
    </>
  )
}
