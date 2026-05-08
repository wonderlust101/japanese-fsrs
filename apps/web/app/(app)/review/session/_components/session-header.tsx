'use client'

import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'

import { Button }          from '@/components/ui/Button'
import { queryKeys }       from '@/lib/api/queryKeys'
import { getDeckAction }   from '@/lib/actions/decks.actions'
import { useCurrentCard, useSessionActions } from '@/stores/useReviewSessionStore'

export function SessionHeader(): React.JSX.Element {
  const router      = useRouter()
  const currentCard = useCurrentCard()
  const { endSession } = useSessionActions()

  const deckId = currentCard?.deckId ?? ''
  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckAction(deckId),
    enabled:  deckId !== '',
    staleTime: 1000 * 60 * 30,
  })

  function handleEnd() {
    endSession()
    router.push('/review')
  }

  return (
    <header className="flex items-center justify-between px-4 lg:px-6 h-14 shrink-0 border-b border-soft-hairline bg-warm-paper-base">
      <span className="text-sm font-medium text-faded-sumi truncate">
        {deck?.name ?? 'Review Session'}
      </span>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleEnd}
        aria-label="End session"
        className="flex items-center gap-1.5 text-faded-sumi hover:text-sumi-ink"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
        End Session
      </Button>
    </header>
  )
}
