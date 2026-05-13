'use client'

import { useState }                                from 'react'
import Link                                        from 'next/link'
import { useRouter }                               from 'next/navigation'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { TopBar }                   from '@/app/(app)/_components/top-bar'
import { Button }                   from '@/components/ui/Button'
import { Dialog }                   from '@/components/ui/Dialog'
import { JlptPill, Pill, PillGroup } from '@/components/ui/Pill'
import { queryKeys }                from '@/lib/api/queryKeys'
import { getDeckWithStatsAction, deleteDeckAction } from '@/lib/actions/decks.actions'
import { listCardsAction }          from '@/lib/actions/cards.actions'
import { inferDeckLevel }           from '@/lib/deck-level'
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

const STATUS_FILTER_MARK: Record<StatusFilter, string> = {
  all:       '•',
  new:       '+',
  learning:  '◐',
  review:    '↻',
  suspended: '×',
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  deckId:   string
  deckName: string
}

export function DeckDetailView({ deckId, deckName }: Props): React.JSX.Element {
  const router      = useRouter()
  const queryClient = useQueryClient()
  const [status,      setStatus]      = useState<StatusFilter>('all')
  const [deleteOpen,  setDeleteOpen]  = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => deleteDeckAction(deckId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      // Deck deletion cascades to all its cards (or unsubscribes premade
      // forks); both paths can change the review queue contents.
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.premadeDecks.subscriptions() })
      router.push('/decks')
    },
  })

  // Deck header stats
  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — cursor-paginated, resets when status tab changes.
  // The `as string | undefined` on initialPageParam widens `undefined` so
  // TanStack infers the pageParam type as `string | undefined` rather than
  // just `undefined`.
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
      ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      status,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const cards    = data?.pages.flatMap((p) => p.items) ?? []
  const progress = deck && deck.cardCount > 0
    ? Math.round(((deck.cardCount - deck.newCount) / deck.cardCount) * 100)
    : 0
  const selectedStatusLabel = STATUS_TABS.find((tab) => tab.value === status)?.label.toLowerCase() ?? status

  const createdDate = deck?.createdAt
    ? new Date(deck.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null
  const deckLevel = inferDeckLevel({
    name: deck?.name ?? deckName,
    ...(deck?.description === undefined ? {} : { description: deck.description }),
  })

  return (
    <>
      <TopBar>
        <Link
          href="/decks"
          className="flex items-center gap-1 text-sm text-faded-sumi hover:text-sumi-ink transition-colors shrink-0"
        >
          ← <span className="max-w-32 truncate">Decks</span>
        </Link>
        <span className="text-faded-sumi shrink-0" aria-hidden="true">|</span>
        <span className="flex-1 text-base font-semibold text-sumi-ink truncate">{deckName}</span>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="text-faded-sumi hover:text-faded-sumi transition-colors px-1"
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
              {deckLevel !== null && (
                <JlptPill level={deckLevel} size="sm" />
              )}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-faded-sumi">
                {deck ? (
                  <>
                    <span>{deck.cardCount} cards</span>
                    <span aria-hidden="true">·</span>
                    <span className={deck.dueCount > 0 ? 'text-error font-medium' : ''}>
                      {deck.dueCount} due today
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{progress}% learned</span>
                    {createdDate && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Since {createdDate}</span>
                      </>
                    )}
                  </>
                ) : (
                  <span className="h-4 w-48 bg-cream-inset rounded animate-pulse inline-block" />
                )}
              </div>
            </div>

            <Link href={`/review?deckId=${deckId}`}>
              <Button size="sm">▶ Start reviews</Button>
            </Link>
          </div>
        </section>

        {/* ── Filter tabs + Add Card ───────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <PillGroup compact>
            {STATUS_TABS.map((tab) => (
              <Pill
                key={tab.value}
                variant="interactive"
                size="lg"
                selected={status === tab.value}
                mark={STATUS_FILTER_MARK[tab.value]}
                onClick={() => setStatus(tab.value)}
                ariaLabel={`Filter cards by ${tab.label}`}
              >
                {tab.label}
              </Pill>
            ))}
          </PillGroup>

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
            <li className="py-16 text-center text-sm text-faded-sumi">
              {status === 'all'
                ? 'No cards yet. '
                : `No ${selectedStatusLabel} cards. `}
              <Link href={`/decks/${deckId}/add-card`} className="text-inari-vermillion hover:underline">
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

      {/* ── Delete confirmation dialog ─────────────────────────────────── */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete Deck">
        <p className="text-sm text-faded-sumi mb-5">
          Permanently delete{' '}
          <span className="font-semibold text-sumi-ink">"{deckName}"</span>
          {' '}and all its cards? This cannot be undone.
        </p>
        {deleteMutation.isError && (
          <p role="alert" className="text-sm text-error mb-3">
            {deleteMutation.error?.message ?? 'Unknown error'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setDeleteOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            loading={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate()}
          >
            Delete Deck
          </Button>
        </div>
      </Dialog>
    </>
  )
}
