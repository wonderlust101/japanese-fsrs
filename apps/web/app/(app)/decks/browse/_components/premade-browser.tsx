'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import {
  usePremadeDecks,
  useMySubscriptions,
  useSubscribeToPremadeDeck,
  useUnsubscribeFromPremadeDeck,
} from '@/lib/api/premade'
import { PremadeDeckCard } from './premade-deck-card'
import { Snackbar } from './snackbar'
import type { PremadeDeckRow } from '@/lib/actions/premade.actions'

type Filter = 'all' | 'vocabulary' | 'grammar' | 'kanji'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',        label: 'All' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'grammar',    label: 'Grammar' },
  { id: 'kanji',      label: 'Kanji' },
]

const SECTION_LABEL: Record<PremadeDeckRow['deckType'], string> = {
  vocabulary: 'Vocabulary',
  grammar:    'Grammar',
  kanji:      'Kanji',
  mixed:      'Mixed',
}

interface SnackbarState {
  message:  string
  deckId:   string
  premadeId: string
}

export function PremadeBrowser(): React.JSX.Element {
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [snack,  setSnack]  = useState<SnackbarState | null>(null)

  const { data: decks = [],         isLoading } = usePremadeDecks()
  const { data: subscriptions = [] }            = useMySubscriptions()
  const subscribe   = useSubscribeToPremadeDeck()
  const unsubscribe = useUnsubscribeFromPremadeDeck()

  const subscribedMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const s of subscriptions) m.set(s.premadeDeckId, s.deckId)
    return m
  }, [subscriptions])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return decks.filter((d) => {
      if (filter !== 'all' && d.deckType !== filter) return false
      if (s.length > 0) {
        const haystack = `${d.name} ${d.description ?? ''}`.toLowerCase()
        if (!haystack.includes(s)) return false
      }
      return true
    })
  }, [decks, filter, search])

  const grouped = useMemo(() => {
    const groups = new Map<PremadeDeckRow['deckType'], PremadeDeckRow[]>()
    for (const d of filtered) {
      const arr = groups.get(d.deckType) ?? []
      arr.push(d)
      groups.set(d.deckType, arr)
    }
    return [...groups.entries()]
  }, [filtered])

  function handleSubscribe(deck: PremadeDeckRow): void {
    subscribe.mutate(deck.id, {
      onSuccess: (res) => {
        setSnack({
          message:   res.alreadyExisted
            ? `Already in your library: "${deck.name}"`
            : `Added "${deck.name}" to your library`,
          deckId:    res.deckId,
          premadeId: deck.id,
        })
      },
    })
  }

  function handleUndo(): void {
    if (snack === null) return
    unsubscribe.mutate(snack.premadeId)
    setSnack(null)
  }

  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-neutral-900">Browse Premade Decks</h1>
        <Link
          href="/decks"
          className="text-sm text-neutral-500 hover:text-neutral-700 transition-colors"
        >
          ← My Decks
        </Link>
      </TopBar>

      <div className="px-4 lg:px-6 py-4 max-w-[1100px] mx-auto space-y-4">
        {/* Search + filters */}
        <div className="space-y-3">
          <input
            type="search"
            placeholder="Search premade decks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 px-3 rounded-[var(--radius-md)] border border-neutral-300 bg-white text-sm text-neutral-900 focus:outline-none focus-visible:ring-3 focus-visible:ring-primary-200"
          />
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                aria-pressed={filter === f.id}
                className={[
                  'h-8 px-3 rounded-full text-sm font-medium transition-colors',
                  filter === f.id
                    ? 'bg-primary-500 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                ].join(' ')}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-[var(--radius-lg)] bg-neutral-100 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty result */}
        {!isLoading && filtered.length === 0 && (
          <p className="py-12 text-center text-sm text-neutral-500">
            No decks match those filters.
          </p>
        )}

        {/* Grouped grid */}
        {!isLoading && grouped.map(([type, list]) => (
          <section key={type} className="space-y-2">
            <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider pt-2">
              {SECTION_LABEL[type]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((deck) => (
                <PremadeDeckCard
                  key={deck.id}
                  deck={deck}
                  forkedDeckId={subscribedMap.get(deck.id) ?? null}
                  onSubscribe={() => handleSubscribe(deck)}
                  isSubscribing={subscribe.isPending && subscribe.variables === deck.id}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {snack !== null && (
        <Snackbar
          message={snack.message}
          actions={[
            { label: 'Open',     href: `/decks/${snack.deckId}` },
            { label: 'Undo',     onClick: handleUndo },
            { label: 'Dismiss',  onClick: () => setSnack(null) },
          ]}
          onTimeout={() => setSnack(null)}
        />
      )}
    </>
  )
}
