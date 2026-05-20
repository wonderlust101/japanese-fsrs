'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  getWordFields,
  getSentenceFrontBack,
  type ApiCardListItem,
} from '@fsrs-japanese/shared-types'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast, useToast } from '@/components/ui/Toast'
import { IconSearch } from '@/components/icons/chrome-marks'
import { CardsResultsTable, type CardsResultRow } from '@/app/(app)/cards/_components/cards-results-table'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckWithStatsAction } from '@/lib/actions/decks.actions'
import { listCardsCrossDeckAction } from '@/lib/actions/cards.actions'
import { useCopyPremadeDeck } from '@/lib/api/premade'

import {
  CardListPagination,
  type CardPageSize,
} from '../../_components/card-list-pagination'

const DEFAULT_PAGE_SIZE: CardPageSize = 25

interface Props {
  deckId:   string
  deckName: string
}

/**
 * Deck preview surface. Reuses the regular deck-detail chrome — PageHeader,
 * search, CardsResultsTable, pagination — but strips every surface that
 * exposes personal stats or editing: the TopBar kebab, the "Study deck" CTA,
 * per-row kebab, FSRS status pill, due date, snapshot aside, and Options
 * panel. The single deck-level action is "Add to my library", which copies
 * the underlying premade source so the learner ends up with a fresh deck
 * to study from.
 *
 * Reached via the premade catalogue's "View deck" action for any premade
 * entry the user has already copied. Routed at `/decks/[id]/preview`.
 */
export function DeckPreviewView({ deckId, deckName }: Props): React.JSX.Element {
  const router = useRouter()
  const { toast, showToast, dismissToast } = useToast()
  const copyMutation = useCopyPremadeDeck()

  const [searchValue, setSearchValue] = useState('')
  const [pageSize, setPageSize]       = useState<CardPageSize>(DEFAULT_PAGE_SIZE)
  const [pageIndex, setPageIndex]     = useState(0)

  // Deck metadata. Drives the attribution chip and the empty/error states.
  // Reused query key so a fresh detail-page fetch hydrates this view too.
  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — pulls from the cross-deck endpoint with `deckId` as the
  // scope filter so the search input becomes a real backend search.
  // Status filter intentionally omitted — read-only mode doesn't expose
  // the FSRS status pill, so a filter on it would be confusing. Key
  // intentionally distinct from the deck-detail page's so a search-
  // filtered cache there doesn't accidentally satisfy this query.
  const trimmedSearch = searchValue.trim()
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: cardsLoading,
    isError:   cardsError,
  } = useInfiniteQuery({
    queryKey: [...queryKeys.cards.byDeck(deckId), 'preview', pageSize, trimmedSearch],
    queryFn:  ({ pageParam }) => listCardsCrossDeckAction({
      deckId,
      limit:  pageSize,
      ...(pageParam      !== undefined ? { cursor: pageParam }     : {}),
      ...(trimmedSearch.length > 0     ? { search: trimmedSearch } : {}),
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const allLoadedCards = data?.pages.flatMap((p) => p.items) ?? []

  const searchActive = trimmedSearch.length > 0
  const visibleCards = useMemo(() => {
    const start = pageIndex * pageSize
    return allLoadedCards.slice(start, start + pageSize)
  }, [allLoadedCards, pageIndex, pageSize])

  const hasPrev          = pageIndex > 0
  const canGoNextLocally = (pageIndex + 1) * pageSize < allLoadedCards.length
  const hasNext          = canGoNextLocally || hasNextPage
  const cardCount        = deck?.cardCount ?? 0
  const isCardListEmpty  = !cardsLoading && cardCount === 0
  const filteredEmpty    = !cardsLoading && cardCount > 0 && visibleCards.length === 0
  const sourcePremadeId  = deck?.sourcePremadeId ?? null

  function handleNextPage(): void {
    if (canGoNextLocally) {
      setPageIndex((i) => i + 1)
      return
    }
    if (hasNextPage && !isFetchingNextPage) {
      void fetchNextPage().then(() => setPageIndex((i) => i + 1))
    }
  }

  function handlePrevPage(): void {
    setPageIndex((i) => Math.max(0, i - 1))
  }

  // Adds another copy of the underlying premade source, mirroring the
  // catalogue's "Add another copy" affordance. The CTA only renders when
  // `sourcePremadeId !== null` (see rightSlot below), so the mutation has a
  // real id to work with; the guard here is defensive against stale clicks
  // after the deck row is unloaded.
  function handleAddToLibrary(): void {
    if (sourcePremadeId === null || copyMutation.isPending) return
    copyMutation.mutate(sourcePremadeId, {
      onSuccess: (result) => {
        showToast(
          `Added ${result.cardCount} ${result.cardCount === 1 ? 'card' : 'cards'} to your library.`,
        )
        router.push(`/decks/${result.deckId}/preview`)
      },
      onError: (err) => {
        showToast(
          err.message || 'Could not add this deck. Try again in a moment.',
          'error',
        )
      },
    })
  }

  return (
    <>
      <TopBar>
        <Link
          href="/decks"
          className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <span aria-hidden="true">←</span>
          <span className="max-w-32 truncate">Decks</span>
        </Link>
        <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
        <span className="flex-1 truncate text-base font-semibold text-sumi-ink">
          {deckName}
        </span>
      </TopBar>

      <div className="min-h-screen bg-cool-paper-base pb-32">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="pt-6 pb-4 sm:pt-8 sm:pb-5 lg:pt-10 lg:pb-6">
            <PageHeader
              kanji="棚"
              label="Deck preview"
              title={deckName}
              {...(deck?.description !== null && deck?.description !== undefined && deck.description.length > 0
                ? { subtitle: deck.description }
                : {})}
              rightSlot={
                sourcePremadeId !== null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleAddToLibrary}
                    loading={copyMutation.isPending}
                    aria-label={`Add ${deckName} to your library`}
                  >
                    Add to my library
                  </Button>
                ) : undefined
              }
            />
          </div>

          <div className="space-y-6">
            <main className="min-w-0">
              <SearchOnlyToolbar
                value={searchValue}
                onChange={setSearchValue}
              />

              <div className="mt-4">
                {cardsError ? (
                  <PreviewMessage
                    title="Couldn't load this deck's cards."
                    body="The list tried to read from the server and didn't get a reply. Try again in a moment."
                    action={
                      <Button size="sm" variant="secondary" onClick={() => void fetchNextPage()}>
                        Try again
                      </Button>
                    }
                  />
                ) : isCardListEmpty ? (
                  <PreviewMessage
                    title="This deck has no cards yet."
                    body="Cards added to the source deck will appear here."
                  />
                ) : filteredEmpty ? (
                  <PreviewMessage
                    title={searchActive
                      ? `No cards match '${searchValue}'.`
                      : 'No cards to show.'}
                    body={searchActive
                      ? 'Try a different search term, or clear the search.'
                      : 'Try loading more cards.'}
                    action={searchActive ? (
                      <Button size="sm" variant="secondary" onClick={() => setSearchValue('')}>
                        Clear search
                      </Button>
                    ) : undefined}
                  />
                ) : (
                  <CardsResultsTable
                    rows={visibleCards.map((card) => apiCardToRow(card, deckId, deckName))}
                    loading={cardsLoading}
                    readOnly
                    cardHrefSuffix="?from=preview"
                  />
                )}
              </div>

              {!cardsLoading && !cardsError && cardCount > 0 && (
                <CardListPagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  pageItemCount={visibleCards.length}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  isFetchingNext={isFetchingNextPage}
                  totalCount={data?.pages[0]?.totalCount}
                  onPrev={handlePrevPage}
                  onNext={handleNextPage}
                  onPageSizeChange={(next) => {
                    setPageSize(next)
                    setPageIndex(0)
                  }}
                />
              )}
            </main>
          </div>
        </div>
      </div>

      {toast !== null && (
        <Toast
          key={toast.key}
          message={toast.message}
          kind={toast.kind}
          onDismiss={dismissToast}
        />
      )}
    </>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────

interface SearchOnlyToolbarProps {
  value:    string
  onChange: (next: string) => void
}

/**
 * Search-only toolbar — the deck-detail page's status-filter pills are
 * suppressed in read-only mode because the FSRS status pill they map to
 * doesn't render here. Keeps the affordance the user expects (filter
 * the loaded cards by word/meaning/reading) without exposing personal
 * state dimensions.
 */
function SearchOnlyToolbar({
  value,
  onChange,
}: SearchOnlyToolbarProps): React.JSX.Element {
  return (
    <section
      aria-label="Card filters"
      className="flex flex-col gap-3 border-b border-soft-hairline pb-4 sm:flex-row sm:items-center sm:justify-end"
    >
      <div className="relative w-full sm:max-w-[20rem]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faded-sumi"
        >
          <IconSearch className="h-3.5 w-3.5" />
        </span>
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search this deck"
          aria-label="Search this deck by word, reading, or meaning"
          className={[
            'ui-motion-colors h-9 w-full rounded-[2px] border border-soft-hairline bg-cream-inset pl-8 pr-3 text-sm text-sumi-ink placeholder:text-faded-sumi',
            'hover:border-faded-sumi',
            'focus:outline focus:outline-1 focus:outline-sumi-ink focus:outline-offset-2',
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none',
          ].join(' ')}
        />
      </div>
    </section>
  )
}

interface PreviewMessageProps {
  title:   string
  body:    string
  action?: React.ReactNode
}

function PreviewMessage({ title, body, action }: PreviewMessageProps): React.JSX.Element {
  return (
    <div
      role="status"
      className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-6 text-center sm:p-8"
    >
      <p className="text-sm font-medium text-sumi-ink">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[42ch] text-sm text-faded-sumi">{body}</p>
      {action !== undefined && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function apiCardToRow(card: ApiCardListItem, deckId: string, deckName: string): CardsResultRow {
  const wordFields = getWordFields(card)
  const sentence   = getSentenceFrontBack(card)
  return {
    id:           card.id,
    word:         wordFields?.word    ?? sentence?.front ?? '—',
    reading:      wordFields?.reading ?? '',
    meaning:      wordFields?.meaning ?? sentence?.back  ?? '',
    deckId,
    deckName,
    jlptLevel:    card.jlptLevel,
    partOfSpeech: wordFields?.partOfSpeech ?? null,
    tags:         card.tags,
    state:        card.state,
    isSuspended:  card.isSuspended,
    lapses:       0,
    due:          card.due,
  }
}
