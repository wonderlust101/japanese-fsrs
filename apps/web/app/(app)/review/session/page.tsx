'use client'

import { useEffect, useRef } from 'react'
import { useRouter }         from 'next/navigation'

import { ReviewCard }                          from '@/components/review/review-card'
import { useSubmitReview, useOfflineSync }     from '@/lib/api/reviews'
import {
  useCurrentCard,
  useIsSessionStarted,
  useSessionHistory,
} from '@/stores/useReviewSessionStore'

export default function ReviewSessionPage() {
  const router         = useRouter()
  const isStarted      = useIsSessionStarted()
  const currentCard    = useCurrentCard()
  const sessionHistory = useSessionHistory()
  const { mutate: submitReview } = useSubmitReview()
  const processedRef   = useRef(0)

  useOfflineSync()

  useEffect(() => {
    if (!isStarted) router.replace('/review')
  }, [isStarted, router])

  useEffect(() => {
    if (isStarted && currentCard === undefined) router.replace('/review')
  }, [isStarted, currentCard, router])

  useEffect(() => {
    if (sessionHistory.length <= processedRef.current) return
    processedRef.current = sessionHistory.length
    const last = sessionHistory.at(-1)
    if (last !== undefined) {
      submitReview({ cardId: last.card.id, rating: last.rating })
    }
  }, [sessionHistory, submitReview])

  if (!isStarted || currentCard === undefined) return null

  return <ReviewCard />
}
