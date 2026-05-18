'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import {
  getWordFields,
  getSentenceFrontBack,
  type ApiCardListItem,
} from '@fsrs-japanese/shared-types'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { IconSearch } from '@/components/icons/chrome-marks'
import { CardsResultsTable, type CardsResultRow } from '@/app/(app)/cards/_components/cards-results-table'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckWithStatsAction } from '@/lib/actions/decks.actions'
import { listCardsAction } from '@/lib/actions/cards.actions'

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
 * Read-only preview of a deck. Reuses the regular deck-detail chrome
 * (PageHeader, search, CardsResultsTable, pagination) but strips every
 * surface that exposes personal stats or editing — the kebab menu in
 * the TopBar, the "Study deck" CTA, per-row kebab, FSRS status pill,
 * due date, the snapshot aside, and the Options panel.
 *
 * Reached today via the premade catalogue's "View deck" action for any
 * premade entry the user has already copied into their library. Routed
 * at `/decks/[id]/preview`.
 */
export function DeckPreviewView({ deckId, deckName }: Props): React.JSX.Element {
  const [searchValue, setSearchValue] = useState('')
  const [pageSize, setPageSize]       = useState<CardPageSize>(DEFAULT_PAGE_SIZE)
  const [pageIndex, setPageIndex]     = useState(0)

  // Deck metadata. Drives the attribution chip and the empty/error states.
  // Reused query key so a fresh detail-page fetch hydrates this view too.
  const { data: deck } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — same RPC as deck-detail, no status filter (read-only mode
  // doesn't surface the FSRS status pill, so a filter on it would be
  // confusing). Key intentionally distinct from the deck-detail page's so
  // a status-filtered cache there doesn't accidentally satisfy this query.
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: cardsLoading,
    isError:   cardsError,
  } = useInfiniteQuery({
    queryKey: [...queryKeys.cards.byDeck(deckId), 'preview', pageSize],
    queryFn:  ({ pageParam }) => listCardsAction(deckId, {
      limit:  pageSize,
      ...(pageParam !== undefined ? { cursor: pageParam } : {}),
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const allLoadedCards = data?.pages.flatMap((p) => p.items) ?? []

  const matchedCards = useMemo(() => {
    const q = searchValue.trim().toLowerCase()
    if (q.length === 0) return allLoadedCards
    return allLoadedCards.filter((card) => {
      const w = getWordFields(card)
      const s = getSentenceFrontBack(card)
      const hay = [
        w?.word ?? '',
        w?.reading ?? '',
        w?.meaning ?? '',
        s?.front ?? '',
        s?.back ?? '',
      ].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [allLoadedCards, searchValue])

  const searchActive = searchValue.trim().length > 0
  const visibleCards = useMemo(() => {
    if (searchActive) return matchedCards
    const start = pageIndex * pageSize
    return allLoadedCards.slice(start, start + pageSize)
  }, [searchActive, matchedCards, allLoadedCards, pageIndex, pageSize])

  const hasPrev          = !searchActive && pageIndex > 0
  const canGoNextLocally = (pageIndex + 1) * pageSize < allLoadedCards.length
  const hasNext          = !searchActive && (canGoNextLocally || hasNextPage)
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
                <Link href={`/decks/${deckId}`}>
                  <Button size="sm" variant="secondary">
                    Open deck
                  </Button>
                </Link>
              }
            />
          </div>

          <div className="space-y-6">
            {/* Read-only banner. Distinguishes the surface from the
                editing-enabled /decks/[id] page so a learner who landed
                here from the catalogue knows why the kebab menus are
                missing. */}
            <PreviewBanner sourcePremadeId={sourcePremadeId} deckId={deckId} />

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
                      ? `No loaded cards match '${searchValue}'.`
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

              {!cardsLoading && !cardsError && !searchActive && cardCount > 0 && (
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

              {searchActive && !cardsLoading && !cardsError && cardCount > 0 && (
                <p className="mt-4 border-t border-soft-hairline pt-3 text-xs text-faded-sumi">
                  Showing <span className="text-sumi-ink">{matchedCards.length}</span>{' '}
                  {matchedCards.length === 1 ? 'match' : 'matches'} from loaded cards. Pagination resumes when you clear the search.
                </p>
              )}
            </main>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Subcomponents ───────────────────────────────────────────────────────

interface PreviewBannerProps {
  sourcePremadeId: string | null
  deckId:          string
}

function PreviewBanner({ sourcePremadeId, deckId }: PreviewBannerProps): React.JSX.Element {
  const message = sourcePremadeId !== null
    ? 'This is a read-only preview of a deck started from the premade catalogue. Open the deck to study, edit, or organise it.'
    : 'This is a read-only preview. Open the deck to study, edit, or organise it.'

  return (
    <aside
      aria-label="Read-only preview"
      className="rounded-[2px] border border-soft-hairline bg-cream-inset/55 px-4 py-3 sm:px-5 sm:py-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm leading-relaxed text-faded-sumi">
          <span
            lang="ja"
            aria-hidden="true"
            className="mr-2 font-display text-sm leading-none text-inari-vermillion"
          >
            観
          </span>
          {message}
        </p>
        <QuietLink href={`/decks/${deckId}`} tone="brand" size="sm" trailingArrow>
          Open deck
        </QuietLink>
      </div>
    </aside>
  )
}

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
          placeholder="Filter loaded cards"
          aria-label="Filter loaded cards by word, reading, or meaning"
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
