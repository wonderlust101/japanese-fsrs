'use client'

import { useState }  from 'react'
import Link          from 'next/link'
import { useQuery }  from '@tanstack/react-query'

import { TopBar }             from '@/app/(app)/_components/top-bar'
import { Button }             from '@/components/ui/button'
import { DeckCard }           from './deck-card'
import { DeckCardSkeleton }   from './deck-skeleton'
import { CreateDeckDialog }   from './create-deck-dialog'
import { listDecksAction }    from '@/lib/actions/decks.actions'

export function DeckListView() {
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: decks, isLoading } = useQuery({
    queryKey: ['decks'],
    queryFn:  listDecksAction,
  })

  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-neutral-900">My Decks</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>+ New Deck</Button>
      </TopBar>
      <CreateDeckDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />

      <div className="p-4 lg:p-6 max-w-[960px] mx-auto space-y-3">
        {isLoading && (
          Array.from({ length: 3 }).map((_, i) => <DeckCardSkeleton key={i} />)
        )}

        {!isLoading && decks?.length === 0 && <EmptyState />}

        {decks?.map((deck, index) => (
          <DeckCard key={deck.id} deck={deck} index={index} />
        ))}
      </div>
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100">
        <svg
          width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5"
          strokeLinecap="round" strokeLinejoin="round"
          className="text-neutral-400" aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-neutral-700">No decks yet</p>
      <p className="text-sm text-neutral-500 max-w-xs">
        Browse our premade decks to start studying in seconds, or create your own.
      </p>
      <Link href="/decks/browse">
        <Button variant="secondary" size="sm">Browse Premade Decks</Button>
      </Link>
    </div>
  )
}
