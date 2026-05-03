'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button }          from '@/components/ui/button'
import { queryKeys }       from '@/lib/api/queryKeys'
import { getDeckAction }   from '@/lib/actions/decks.actions'
import { useCurrentCard, useSessionActions } from '@/stores/useReviewSessionStore'

export function SessionHeader() {
  const router      = useRouter()
  const currentCard = useCurrentCard()
  const { endSession } = useSessionActions()

  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(currentCard?.deckId ?? ''),
    queryFn:  () => getDeckAction(currentCard!.deckId),
    enabled:  currentCard?.deckId !== undefined,
    staleTime: 1000 * 60 * 30,
  })

  function handleEnd() {
    endSession()
    router.push('/review')
  }

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 h-14 shrink-0 border-b border-neutral-200 bg-neutral-50">
      <span className="text-sm font-medium text-neutral-600 truncate">
        {deck?.name ?? 'Review Session'}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleEnd}
        aria-label="End session"
        className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-800"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
        End Session
      </Button>
    </header>
  )
}
