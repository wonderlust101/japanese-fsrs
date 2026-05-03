'use client'

import { useState }                                from 'react'
import Link                                        from 'next/link'
import { useQuery, useInfiniteQuery }              from '@tanstack/react-query'

import { TopBar }                   from '@/app/(app)/_components/top-bar'
import { Button }                   from '@/components/ui/button'
import { cn }                       from '@/lib/utils'
import { queryKeys }                from '@/lib/api/queryKeys'
import { getDeckWithStatsAction }   from '@/lib/actions/decks.actions'
import { listCardsAction }          from '@/lib/actions/cards.actions'
import { CardListItem }             from './card-list-item'
import { CardListItemSkeleton }     from './card-list-skeleton'

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'new' | 'learning' | 'review' | 'suspended'

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All'       },
  { value: 'new',       label: 'New'       },
  { value: 'learning',  label: 'Learning'  },
  { value: 'review',    label: 'Review'    },
  { value: 'suspended', label: 'Suspended' },
]

const DECK_TYPE_BADGE: Record<string, string> = {
  vocabulary: 'bg-primary-100 text-primary-700',
  grammar:    'bg-success-100 text-success-700',
  kanji:      'bg-warning-100 text-warning-700',
  mixed:      'bg-neutral-100 text-neutral-600',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  deckId:   string
  deckName: string
}

export function DeckDetailView({ deckId, deckName }: Props) {
  const [status, setStatus] = useState<StatusFilter>('all')

  // Deck header stats
  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — cursor-paginated, resets when status tab changes
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey:         [...queryKeys.cards.byDeck(deckId), status],
    queryFn:          ({ pageParam }) => listCardsAction(deckId, {
      limit:  50,
      ...(pageParam !== undefined ? { cursor: pageParam as string } : {}),
      status,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const cards   = data?.pages.flatMap((p) => p.items) ?? []
  const progress = deck !== null && deck !== undefined && deck.cardCount > 0
    ? Math.round(((deck.cardCount - deck.newCount) / deck.cardCount) * 100)
    : 0

  const createdDate = deck?.createdAt !== undefined
    ? new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null

  return (
    <>
      <TopBar>
        <Link
          href="/decks"
          className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 transition-colors shrink-0"
        >
          ← <span className="max-w-32 truncate">Decks</span>
        </Link>
        <span className="text-neutral-300 shrink-0" aria-hidden="true">|</span>
        <span className="flex-1 text-base font-semibold text-neutral-900 truncate">{deckName}</span>
        <button
          type="button"
          className="text-neutral-400 hover:text-neutral-600 transition-colors px-1"
          aria-label="Deck options"
        >
          ···
        </button>
      </TopBar>

      <div className="max-w-[960px] mx-auto px-4 lg:px-6 py-6 space-y-5">

        {/* ── Deck header ─────────────────────────────────────────────── */}
        <section className="bg-[var(--color-surface-raised)] rounded-[var(--radius-lg)] shadow-[var(--shadow-card)] p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              {deck !== undefined && deck !== null && (
                <span className={cn(
                  'inline-block text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                  DECK_TYPE_BADGE[deck.deckType] ?? 'bg-neutral-100 text-neutral-600',
                )}>
                  {deck.deckType}
                </span>
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-600">
                {deck !== undefined && deck !== null ? (
                  <>
                    <span>{deck.cardCount} cards</span>
                    <span aria-hidden="true">·</span>
                    <span className={deck.dueCount > 0 ? 'text-danger-600 font-medium' : ''}>
                      {deck.dueCount} due today
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{progress}% learned</span>
                    {createdDate !== null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Since {createdDate}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="h-4 w-48 bg-neutral-100 rounded animate-pulse inline-block" />
                )}
              </div>
            </div>

            <Link href={`/review?deckId=${deckId}`}>
              <Button size="sm">▶ Start Review</Button>
            </Link>
          </div>
        </section>

        {/* ── Filter tabs + Add Card ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={cn(
                  'px-3 py-1.5 rounded-[var(--radius-md)] text-sm font-medium transition-colors',
                  status === tab.value
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-neutral-500 hover:bg-neutral-100',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link href={`/decks/${deckId}/add-card`}>
            <Button size="sm" variant="secondary">+ Add Card</Button>
          </Link>
        </div>

        {/* ── Card list ───────────────────────────────────────────────── */}
        <ul className="space-y-2">
          {isLoading && Array.from({ length: 5 }).map((_, i) => (
            <CardListItemSkeleton key={i} />
          ))}

          {!isLoading && cards.length === 0 && (
            <li className="py-16 text-center text-sm text-neutral-500">
              {status === 'all'
                ? 'No cards yet. '
                : `No ${status} cards. `}
              <Link href={`/decks/${deckId}/add-card`} className="text-primary-600 hover:underline">
                Add a card
              </Link>
            </li>
          )}

          {cards.map((card) => (
            <CardListItem key={card.id} card={card} deckId={deckId} />
          ))}
        </ul>

        {/* ── Load more ───────────────────────────────────────────────── */}
        {hasNextPage && (
          <div className="flex justify-center pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { void fetchNextPage() }}
              loading={isFetchingNextPage}
            >
              Load more
            </Button>
          </div>
        )}

      </div>
    </>
  )
}
