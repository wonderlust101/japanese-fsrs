'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getWordFields, getSentenceFrontBack, type ApiCardListItem } from '@fsrs-japanese/shared-types'

import {
  CardsResultsTable,
  type CardsResultRow,
  type CardRowAction,
} from '@/app/(app)/cards/_components/cards-results-table'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { IconMore, IconEdit, IconHide, IconReveal, IconDelete } from '@/components/icons/chrome-marks'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckWithStatsAction, deleteDeckAction } from '@/lib/actions/decks.actions'
import { listCardsAction, deleteCardAction, moveCardAction } from '@/lib/actions/cards.actions'
import {
  DecksMenu,
  MenuItem,
  MenuSeparator,
} from '@/app/(app)/decks/_components/decks-menu'
import {
  DeleteDeckDialog,
  RenameDeckDialog,
} from '@/app/(app)/decks/_components/deck-dialogs'
import {
  useArchiveSet,
  useLocalNameOverrides,
} from '@/app/(app)/decks/_components/use-deck-prefs'

import { CardListPagination, type CardPageSize } from './card-list-pagination'
import { DeckCardToolbar, type StatusFilter } from './deck-card-toolbar'
import { DeckOptionsPanel } from './deck-options-panel'
import { DeckStatsAside } from './deck-stats-aside'
import { MoveCardDialog } from './move-card-dialog'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  deckId:   string
  deckName: string
}

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'rename' }
  | { kind: 'delete' }
  | { kind: 'delete-card'; card: ApiCardListItem }
  | { kind: 'move-card';   card: ApiCardListItem }
  | { kind: 'add-card';    card: ApiCardListItem }

const DEFAULT_PAGE_SIZE: CardPageSize = 25

// ─── Component ────────────────────────────────────────────────────────────────

export function DeckDetailView({ deckId, deckName }: Props): React.JSX.Element {
  const router      = useRouter()
  const queryClient = useQueryClient()

  // Local archive + name override state (shared with Decks page via localStorage).
  const archiveSet    = useArchiveSet()
  const nameOverrides = useLocalNameOverrides()
  const isArchived    = archiveSet.isArchived(deckId)
  const displayName   = nameOverrides.nameFor(deckId, deckName)

  // Page-local UI state.
  const [status,        setStatus]        = useState<StatusFilter>('all')
  const [searchValue,   setSearchValue]   = useState('')
  const [pageSize,      setPageSize]      = useState<CardPageSize>(DEFAULT_PAGE_SIZE)
  const [pageIndex,     setPageIndex]     = useState(0)
  const [activeDialog,  setActiveDialog]  = useState<ActiveDialog>({ kind: 'none' })
  const [toast,         setToast]         = useState<string | null>(null)

  // Reset to page 1 whenever the inputs that change the visible set change.
  useEffect(() => { setPageIndex(0) }, [status, searchValue, pageSize])

  // Deck header stats.
  const { data: deck, isLoading: deckLoading } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — cursor-paginated; resets when the status tab or page size
  // changes (both are part of the query key).
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: cardsLoading,
    isError:   cardsError,
  } = useInfiniteQuery({
    queryKey: [...queryKeys.cards.byDeck(deckId), status, pageSize],
    queryFn:  ({ pageParam }) => listCardsAction(deckId, {
      limit:  pageSize,
      ...(pageParam !== undefined ? { cursor: pageParam } : {}),
      status,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const allLoadedCards = data?.pages.flatMap((p) => p.items) ?? []

  // Client-side filter over loaded pages. The list API has no `q` parameter
  // yet, so search applies to whatever the user has paginated through.
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

  // When search is active, show every loaded match without paginating (the
  // user is looking for a needle, not browsing). Otherwise, slice the fetched
  // pages by the current pageIndex × pageSize.
  const visibleCards = useMemo(() => {
    if (searchActive) return matchedCards
    const start = pageIndex * pageSize
    return allLoadedCards.slice(start, start + pageSize)
  }, [searchActive, matchedCards, allLoadedCards, pageIndex, pageSize])

  // Pagination affordance state.
  const hasPrev      = !searchActive && pageIndex > 0
  const canGoNextLocally = (pageIndex + 1) * pageSize < allLoadedCards.length
  const hasNext      = !searchActive && (canGoNextLocally || hasNextPage)

  const cardCount        = deck?.cardCount ?? 0
  const dueCount         = deck?.dueCount  ?? 0
  const isCardListEmpty  = !cardsLoading && cardCount === 0
  const filteredEmpty    = !cardsLoading && cardCount > 0 && visibleCards.length === 0
  const selectedStatusLabel = STATUS_LABEL[status]

  // ── Card-delete mutation ──────────────────────────────────────────────
  const deleteCardMutation = useMutation({
    mutationFn: (cardId: string) => deleteCardAction(cardId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
    },
  })

  // ── Card-move mutation ────────────────────────────────────────────────
  // Backend endpoint POST /api/v1/cards/:id/move is pending. Frontend is
  // wired and will surface server errors gracefully until the endpoint ships.
  const moveCardMutation = useMutation({
    mutationFn: ({ cardId, targetDeckId }: { cardId: string; targetDeckId: string }) =>
      moveCardAction(cardId, targetDeckId),
    onSuccess: (_data, { targetDeckId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(deckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
    },
  })

  function handlePageSizeChange(next: CardPageSize): void {
    setPageSize(next)
    // pageIndex reset is handled by the effect above.
  }

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

  // Maps a Cards-table row action back onto Deck Detail's existing
  // dialog/setActiveDialog vocabulary so the new menu reuses the
  // already-wired Move / Add-copy / Delete dialogs without forking a
  // parallel surface.
  function handleCardRowAction(action: CardRowAction, card: ApiCardListItem): void {
    switch (action) {
      case 'edit':
        router.push(`/cards/${card.id}?from=decks`)
        return
      case 'add-copy':
        setActiveDialog({ kind: 'add-card', card })
        return
      case 'move':
        setActiveDialog({ kind: 'move-card', card })
        return
      case 'delete':
        setActiveDialog({ kind: 'delete-card', card })
        return
    }
  }

  // ── Mutations ─────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: () => deleteDeckAction(deckId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.premadeDecks.subscriptions() })
      router.push('/decks')
    },
  })

  function handleArchive(): void {
    archiveSet.archive(deckId)
    setToast(`Archived "${truncate(displayName, 28)}". You can restore it from this page or the Decks list.`)
  }

  function handleRestore(): void {
    archiveSet.restore(deckId)
    setToast(`Restored "${truncate(displayName, 28)}".`)
  }

  // ── Render ────────────────────────────────────────────────────────────
  const studyHref = `/review/setup?deck=${encodeURIComponent(deckId)}`
  const openInCardsHref = `/cards?deck=${encodeURIComponent(deckId)}`

  return (
    <>
      <TopBar>
        <Link
          href="/decks"
          className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink"
        >
          <span aria-hidden="true">←</span>
          <span className="max-w-32 truncate">Decks</span>
        </Link>
        <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
        <span className="flex-1 truncate text-base font-semibold text-sumi-ink">{displayName}</span>

        <DecksMenu
          align="end"
          menuClassName="min-w-[12rem]"
          renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={onClick}
              onKeyDown={onKeyDown}
              aria-haspopup="menu"
              aria-expanded={ariaExpanded}
              aria-label="Deck options"
              className="ui-motion-colors flex h-8 w-8 shrink-0 items-center justify-center rounded-[2px] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              <IconMore className="h-4 w-4" />
            </button>
          )}
          renderItems={({ close }) => (
            <>
              <MenuItem
                leading={<IconEdit className="h-3.5 w-3.5" />}
                onClick={() => { setActiveDialog({ kind: 'rename' }); close() }}
              >
                Rename
              </MenuItem>
              <Link href={openInCardsHref}>
                <MenuItem onClick={close}>Open cards in Cards</MenuItem>
              </Link>
              <MenuSeparator />
              {isArchived ? (
                <MenuItem
                  leading={<IconReveal className="h-3.5 w-3.5" />}
                  onClick={() => { handleRestore(); close() }}
                >
                  Restore
                </MenuItem>
              ) : (
                <MenuItem
                  leading={<IconHide className="h-3.5 w-3.5" />}
                  onClick={() => { handleArchive(); close() }}
                >
                  Archive
                </MenuItem>
              )}
              <MenuItem
                leading={<IconDelete className="h-3.5 w-3.5" />}
                onClick={() => { setActiveDialog({ kind: 'delete' }); close() }}
                danger
              >
                Delete
              </MenuItem>
            </>
          )}
        />
      </TopBar>

      <div className="min-h-screen bg-cool-paper-base pb-32">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16">

          {/* ── Page hero ──────────────────────────────────────────────── */}
          <div className="pt-6 pb-4 sm:pt-8 sm:pb-5 lg:pt-10 lg:pb-6">
            <PageHeader
              kanji="棚"
              label="Decks"
              title={displayName}
              {...(deck?.description !== null && deck?.description !== undefined && deck.description.length > 0
                ? { subtitle: deck.description }
                : {})}
              rightSlot={
                <Link href={studyHref}>
                  <Button size="md" disabled={isCardListEmpty}>
                    Study deck
                  </Button>
                </Link>
              }
            />
          </div>

          {/* ── Stacked layout: cards primary, snapshot below ─────────── */}
          <div className="space-y-10">

            {/* ── Cards (primary) ────────────────────────────────────── */}
            <main className="min-w-0">
              <DeckCardToolbar
                status={status}
                onStatusChange={setStatus}
                searchValue={searchValue}
                onSearchChange={setSearchValue}
              />

              <div className="mt-4">
                {cardsError ? (
                  <ul aria-label="Cards in this deck">
                    <CardListErrorState onRetry={() => void fetchNextPage()} />
                  </ul>
                ) : isCardListEmpty ? (
                  <ul aria-label="Cards in this deck">
                    <EmptyDeckState deckId={deckId} />
                  </ul>
                ) : filteredEmpty ? (
                  <ul aria-label="Cards in this deck">
                    <NoMatchState
                      searchValue={searchValue}
                      selectedStatusLabel={selectedStatusLabel}
                      onClearSearch={() => setSearchValue('')}
                    />
                  </ul>
                ) : (
                  <CardsResultsTable
                    rows={visibleCards.map((card) => apiCardToRow(card, deckId, displayName))}
                    onRowAction={(cardId, action) => {
                      const card = visibleCards.find((c) => c.id === cardId)
                      if (card === undefined) return
                      handleCardRowAction(action, card)
                    }}
                    loading={cardsLoading}
                    cardHrefSuffix="?from=decks"
                  />
                )}
              </div>

              {/* Pagination footer — only when not in search mode, the deck
                  has at least one card, and the list isn't loading. */}
              {!cardsLoading && !cardsError && !searchActive && cardCount > 0 && (
                <CardListPagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  pageItemCount={visibleCards.length}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  isFetchingNext={isFetchingNextPage}
                  onPrev={handlePrevPage}
                  onNext={handleNextPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}

              {/* Search mode: surface a tiny match summary so the user knows
                  pagination is suspended while filtering. */}
              {searchActive && !cardsLoading && !cardsError && cardCount > 0 && (
                <p className="mt-4 border-t border-soft-hairline pt-3 text-xs text-faded-sumi">
                  Showing <span className="text-sumi-ink">{matchedCards.length}</span>{' '}
                  {matchedCards.length === 1 ? 'match' : 'matches'} from loaded cards. Pagination resumes when you clear the search.
                </p>
              )}
            </main>

            {/* ── Snapshot (moved below for now) ─────────────────────── */}
            <aside aria-label="Deck overview">
              <DeckStatsAside deck={deck} loading={deckLoading} />
              {isArchived && (
                <div className="mt-4 rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-3 text-xs text-faded-sumi">
                  This deck is archived on this device. It's hidden from the Decks list and the daily review queue until you restore it.
                </div>
              )}
            </aside>

            {/* ── Options ────────────────────────────────────────────── */}
            <div>
              <DeckOptionsPanel
                deckId={deckId}
                isArchived={isArchived}
                onRename={() => setActiveDialog({ kind: 'rename' })}
                onArchive={handleArchive}
                onRestore={handleRestore}
                onDelete={() => setActiveDialog({ kind: 'delete' })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <RenameDeckDialog
        open={activeDialog.kind === 'rename'}
        deck={deck ?? null}
        currentName={displayName}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
        onError={(msg) => setToast(msg)}
        onSuccess={(name) => setToast(`Renamed to "${truncate(name, 28)}".`)}
      />

      <DeleteDeckDialog
        open={activeDialog.kind === 'delete'}
        deck={deck ?? null}
        cardCount={cardCount}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onError={(msg) => setToast(msg)}
        onSuccess={() => {
          // Deck deletion cascades; clear local rename + archive bits.
          nameOverrides.setNameOverride(deckId, null)
          archiveSet.restore(deckId)
          // Server invalidations + redirect are handled by the dialog's
          // mutation. We just provide a toast for consistency with the rest
          // of the app.
        }}
      />

      <CardDeleteDialog
        target={activeDialog.kind === 'delete-card' ? activeDialog.card : null}
        isDeleting={deleteCardMutation.isPending}
        errorMessage={deleteCardMutation.isError ? (deleteCardMutation.error?.message ?? 'Unknown error') : null}
        onCancel={() => setActiveDialog({ kind: 'none' })}
        onConfirm={(card) => {
          deleteCardMutation.mutate(card.id, {
            onSuccess: () => {
              setActiveDialog({ kind: 'none' })
              setToast('Card deleted.')
            },
          })
        }}
      />

      <MoveCardDialog
        card={activeDialog.kind === 'move-card' ? activeDialog.card : null}
        currentDeckId={deckId}
        variant="move"
        isSubmitting={moveCardMutation.isPending}
        errorMessage={moveCardMutation.isError ? (moveCardMutation.error?.message ?? 'Unknown error') : null}
        onCancel={() => {
          setActiveDialog({ kind: 'none' })
          moveCardMutation.reset()
        }}
        onConfirm={(card, targetDeckId) => {
          moveCardMutation.mutate(
            { cardId: card.id, targetDeckId },
            {
              onSuccess: () => {
                setActiveDialog({ kind: 'none' })
                setToast('Card moved.')
              },
            },
          )
        }}
      />

      {/* "Add a copy" variant — the backend endpoint isn't wired yet, so the
          confirm handler is a deliberate no-op: it closes the dialog and
          surfaces a toast indicating the feature is pending. When the backend
          ships, swap onConfirm for a real mutation that POSTs to the copy
          endpoint, and treat this dialog identically to the move one. */}
      <MoveCardDialog
        card={activeDialog.kind === 'add-card' ? activeDialog.card : null}
        currentDeckId={deckId}
        variant="add"
        isSubmitting={false}
        errorMessage={null}
        onCancel={() => setActiveDialog({ kind: 'none' })}
        onConfirm={() => {
          setActiveDialog({ kind: 'none' })
          setToast('Adding a copy to another deck is coming. The endpoint is pending.')
        }}
      />

      {/* The deleteMutation from this view is kept for backwards-compatibility
          with prior tests / hooks, but the dialog above owns the user flow. */}
      {deleteMutation.isError && null}

      {toast !== null && (
        <Toast message={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Reading dueCount keeps lint happy when stats live in the sidebar. */}
      <span hidden aria-hidden="true">{dueCount}</span>
    </>
  )
}

// ── Sub-views ───────────────────────────────────────────────────────────

function CardDeleteDialog({
  target,
  isDeleting,
  errorMessage,
  onCancel,
  onConfirm,
}: {
  target:       ApiCardListItem | null
  isDeleting:   boolean
  errorMessage: string | null
  onCancel:     () => void
  onConfirm:    (card: ApiCardListItem) => void
}): React.JSX.Element {
  const word = useMemo(() => {
    if (target === null) return ''
    const wordFields = getWordFields(target)
    const sentence   = getSentenceFrontBack(target)
    return wordFields?.word ?? sentence?.front ?? 'this card'
  }, [target])

  return (
    <Dialog open={target !== null} onClose={onCancel} title="Delete card">
      <p className="mb-5 text-sm text-faded-sumi">
        Permanently delete{' '}
        <span lang="ja" className="font-semibold text-sumi-ink">{word}</span>{' '}
        from this deck? This cannot be undone.
      </p>
      {errorMessage !== null && (
        <p role="alert" className="mb-3 text-sm text-inari-vermillion-deep">{errorMessage}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          loading={isDeleting}
          onClick={() => { if (target !== null) onConfirm(target) }}
        >
          Delete card
        </Button>
      </div>
    </Dialog>
  )
}

function EmptyDeckState({ deckId }: { deckId: string }): React.JSX.Element {
  return (
    <li className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-8 text-center sm:p-12">
      <p className="text-base font-medium text-sumi-ink">This deck has no cards yet.</p>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-sm text-faded-sumi">
        Add a card to start studying, or browse premade starter decks.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link href={`/add?deck=${encodeURIComponent(deckId)}`}>
          <Button size="md">Add Japanese</Button>
        </Link>
        <Link href="/decks/premade">
          <Button size="md" variant="secondary">Browse premade decks</Button>
        </Link>
      </div>
    </li>
  )
}

function NoMatchState({
  searchValue,
  selectedStatusLabel,
  onClearSearch,
}: {
  searchValue:          string
  selectedStatusLabel:  string
  onClearSearch:        () => void
}): React.JSX.Element {
  return (
    <li className="rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-6 text-center">
      <p className="text-sm text-faded-sumi">
        {searchValue.length > 0 ? (
          <>
            No loaded cards match <span className="text-sumi-ink/85">'{searchValue}'</span>.{' '}
            <button
              type="button"
              onClick={onClearSearch}
              className="text-sumi-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Clear search
            </button>
            , or load more cards below.
          </>
        ) : (
          <>No {selectedStatusLabel.toLowerCase()} cards in this deck.</>
        )}
      </p>
    </li>
  )
}

function CardListErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <li className="rounded-[2px] border border-soft-hairline bg-cream-inset/55 p-6 text-center">
      <p className="text-sm font-medium text-sumi-ink">Couldn't load this deck's cards.</p>
      <p className="mt-1 text-sm text-faded-sumi">
        The list tried to read from the server and didn't get a reply. Try again in a moment.
      </p>
      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </li>
  )
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className="ui-motion-colors fixed bottom-4 right-4 z-30 max-w-[28rem] cursor-pointer rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3.5 py-2.5 text-sm text-sumi-ink shadow-[var(--shadow-card)] animate-page-enter"
    >
      {message}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<StatusFilter, string> = {
  all:       'All',
  new:       'New',
  learning:  'Learning',
  review:    'Review',
  suspended: 'Suspended',
}

function truncate(name: string, max: number): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1).trimEnd() + '…'
}

/**
 * Maps the deck-list shape onto the Cards browser table's row shape
 * so the two pages can share the same rendering primitive. Sentence
 * cards fall back to front/back text for the headword/meaning so the
 * row still says *something* useful even though the table is tuned
 * for vocabulary cards. `lapses` defaults to 0 because
 * `ApiCardListItem` doesn't yet pick that column — the health badge
 * will activate on this page once `lapses` is added to the picked
 * schema (the backend service already projects it).
 */
function apiCardToRow(card: ApiCardListItem, deckId: string, deckName: string): CardsResultRow {
  const wordFields = getWordFields(card)
  const sentence   = getSentenceFrontBack(card)
  return {
    id:          card.id,
    word:        wordFields?.word    ?? sentence?.front ?? '—',
    reading:     wordFields?.reading ?? '',
    meaning:     wordFields?.meaning ?? sentence?.back  ?? '',
    deckId,
    deckName,
    cardType:    card.cardType,
    jlptLevel:   card.jlptLevel,
    partOfSpeech: wordFields?.partOfSpeech ?? null,
    tags:        card.tags,
    state:       card.state,
    isSuspended: card.isSuspended,
    lapses:      0,
    due:         card.due,
  }
}
