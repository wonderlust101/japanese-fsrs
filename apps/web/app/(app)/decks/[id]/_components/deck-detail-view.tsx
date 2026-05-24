'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWordFields,
  getSentenceFrontBack,
  type ApiCardListItem,
  type CardSortField,
  type CardSortDir,
} from '@fsrs-japanese/shared-types'

import {
  CardsResultsTable,
  type CardsResultRow,
  type CardRowAction,
} from '@/app/(app)/cards/_components/cards-results-table'
import { CardsCountLine } from '@/app/(app)/cards/_components/cards-count-line'
import { CardsBulkBar } from '@/app/(app)/cards/_components/cards-bulk-bar'
import { naturalSortDirFor } from '@/app/(app)/cards/_components/cards-filter-state'
import {
  useBulkDeleteCardsMutation,
  useBulkMoveCardsMutation,
  useBulkSuspendCardsMutation,
} from '@/lib/api/cards'

import { PageFrame } from '@/app/(app)/_components/page-frame'
import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarActions } from '@/app/(app)/_components/top-bar-actions'
import { TopBarBackLink } from '@/app/(app)/_components/top-bar-back-link'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageLoader } from '@/components/ui/TomoLoader'
import { Dialog } from '@/components/ui/Dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast, useToast } from '@/components/ui/Toast'
import { IconMore, IconEdit, IconHide, IconReveal, IconDelete } from '@/components/icons/chrome-marks'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckWithStatsAction, deleteDeckAction } from '@/lib/actions/decks.actions'
import { listCardsCrossDeckAction, deleteCardAction, moveCardAction, copyCardAction } from '@/lib/actions/cards.actions'
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
import { useDeckDetailDevState } from '@/dev/panels/deck-detail'

import { CardListPagination, type CardPageSize } from './card-list-pagination'
import { DeckCardToolbar, type StatusFilter } from './deck-card-toolbar'
import { DeckSnapshotRibbon } from './deck-snapshot-ribbon'
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
  useDeckDetailDevState()
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const queryClient  = useQueryClient()

  // Local archive + name override state (shared with Decks page via localStorage).
  const archiveSet    = useArchiveSet()
  const nameOverrides = useLocalNameOverrides()
  const isArchived    = archiveSet.isArchived(deckId)
  const displayName   = nameOverrides.nameFor(deckId, deckName)

  // ── URL-canonical filter state ───────────────────────────────────────
  // status / search / page live in the URL so the filtered view is
  // deep-linkable and survives reload. Mirrors cards-browser-view: the URL
  // is the single source of truth (derived via useMemo), not a duplicated
  // useState that would race router.replace. `pageSize` stays local — it's a
  // viewing preference, not part of the view definition.
  const urlState    = useMemo(() => parseDeckCardsUrl((k) => searchParams.get(k)), [searchParams])
  const status      = urlState.status
  const searchValue = urlState.search
  const sort        = urlState.sort
  const sortDir     = urlState.sortDir
  const pageIndex   = urlState.page - 1   // 0-indexed for internal use

  const [pageSize,     setPageSize]     = useState<CardPageSize>(DEFAULT_PAGE_SIZE)
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>({ kind: 'none' })
  // Bulk-select state for mass editing. Tracked by card id, local (never in the
  // URL). Cleared whenever the result set itself changes (below); flipping pages
  // keeps the selection since it's id-based, not row-position based.
  const [selected,     setSelected]     = useState<ReadonlySet<string>>(() => new Set())
  const { toast, showToast, dismissToast } = useToast()

  // Single writer for the URL state. Accepts a partial patch merged onto the
  // current state. Resets to page 1 whenever a field that changes the result
  // set or its order (status / search / sort) changes, so the user never lands
  // on a stale page; page-only navigation passes through unchanged.
  function updateUrlState(patch: Partial<DeckCardsUrlState>): void {
    const current: DeckCardsUrlState = { status, search: searchValue, sort, sortDir, page: pageIndex + 1 }
    const next = { ...current, ...patch }
    const onlyPageChanged =
      next.status === current.status && next.search === current.search &&
      next.sort === current.sort && next.sortDir === current.sortDir
    const finalNext = onlyPageChanged ? next : { ...next, page: 1 }
    const qs = serializeDeckCardsUrl(finalNext).toString()
    router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Deck header stats.
  const { data: deck, isLoading: deckLoading } = useQuery({
    queryKey: queryKeys.decks.detail(deckId),
    queryFn:  () => getDeckWithStatsAction(deckId),
  })

  // Card list — offset-paginated against the cross-deck endpoint with
  // `deckId` as the scope filter so the toolbar's search input becomes a
  // real backend search instead of a client-side filter over already-
  // loaded pages. Resets when status / page size / search changes (all
  // part of the query key). Converted from cursor + useInfiniteQuery to
  // offset + plain useQuery in 20260630000003 so the cards page could
  // adopt random-page jump; this view inherits the simpler model since
  // its prev/next semantics map cleanly to offset.
  const trimmedSearch = searchValue.trim()
  const {
    data,
    refetch,
    isFetching: isCardsFetching,
    isLoading:  cardsLoading,
    isError:    cardsError,
  } = useQuery({
    queryKey: [...queryKeys.cards.byDeck(deckId), status, pageSize, trimmedSearch, sort, sortDir, pageIndex],
    queryFn:  () => listCardsCrossDeckAction({
      deckId,
      limit:  pageSize,
      sort,
      ...(pageIndex > 0                ? { offset: pageIndex * pageSize } : {}),
      ...(status         !== 'all'     ? { status }                 : {}),
      ...(trimmedSearch.length > 0     ? { search: trimmedSearch }  : {}),
      ...(sortDir !== null             ? { sortDir }                : {}),
    }),
    placeholderData: keepPreviousData,
  })

  const visibleCards = data?.items ?? []

  // Pagination affordance state.
  const hasPrev = pageIndex > 0
  const hasNext = (data?.hasMore ?? false) === true

  const cardCount        = deck?.cardCount ?? 0
  const totalMatching    = data?.totalCount ?? visibleCards.length
  const isCardListEmpty  = !cardsLoading && cardCount === 0
  const filteredEmpty    = !cardsLoading && cardCount > 0 && visibleCards.length === 0
  const selectedStatusLabel = STATUS_LABEL[status]

  // ── Bulk selection ────────────────────────────────────────────────────
  const visibleIds = useMemo(() => visibleCards.map((c) => c.id), [visibleCards])

  // Drop the selection whenever the result set itself changes (filter / search
  // / sort / page size). Page navigation is intentionally excluded: selection
  // is id-keyed, so paging keeps prior picks. Mirrors cards-browser-view.
  useEffect(() => {
    setSelected(new Set())
  }, [status, trimmedSearch, sort, sortDir, pageSize])

  function toggleSelection(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }
  function toggleAllVisible(): void {
    setSelected((prev) => {
      const allChecked = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      const next = new Set(prev)
      for (const id of visibleIds) { if (allChecked) next.delete(id); else next.add(id) }
      return next
    })
  }
  function clearSelection(): void { setSelected(new Set()) }

  // ── Bulk mutations (shared hooks; invalidate cards.* + decks.*) ────────
  const bulkMoveMutation    = useBulkMoveCardsMutation()
  const bulkSuspendMutation = useBulkSuspendCardsMutation()
  const bulkDeleteMutation  = useBulkDeleteCardsMutation()
  const [bulkMoveOpen,   setBulkMoveOpen]   = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  function reportBulkResult(label: string, result: { succeeded: readonly string[]; failed: readonly { id: string; error: string }[] }): void {
    const ok = result.succeeded.length
    const no = result.failed.length
    if (no === 0) showToast(`${label}: ${ok} ${ok === 1 ? 'card' : 'cards'} updated.`)
    else          showToast(`${label}: ${ok} updated, ${no} failed.`, 'error')
  }

  function handleBulkMoveConfirm(_card: ApiCardListItem, targetDeckId: string): void {
    bulkMoveMutation.mutate({ ids: [...selected], targetDeckId }, {
      onSuccess: (result) => { reportBulkResult('Move', result); clearSelection(); setBulkMoveOpen(false) },
      onError:   (err) => showToast(err.message || 'Failed to move cards.', 'error'),
    })
  }
  function handleBulkSuspend(): void {
    bulkSuspendMutation.mutate([...selected], {
      onSuccess: (result) => { reportBulkResult('Suspend', result); clearSelection() },
      onError:   (err) => showToast(err.message || 'Failed to suspend cards.', 'error'),
    })
  }
  function handleBulkDeleteConfirm(): void {
    bulkDeleteMutation.mutate([...selected], {
      onSuccess: (result) => { reportBulkResult('Delete', result); clearSelection(); setBulkDeleteOpen(false) },
      onError:   (err) => showToast(err.message || 'Failed to delete cards.', 'error'),
    })
  }

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

  // ── Card-copy mutation ────────────────────────────────────────────────
  // Cloning leaves the source card untouched, so this mutation only refreshes
  // the target deck's caches plus the shared decks list and review queue (the
  // copy lands in state=0 and is due immediately).
  const copyCardMutation = useMutation({
    mutationFn: ({ cardId, targetDeckId }: { cardId: string; targetDeckId: string }) =>
      copyCardAction(cardId, targetDeckId),
    onSuccess: (_data, { targetDeckId }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.cards.byDeck(targetDeckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.detail(targetDeckId) })
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.list() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.due() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.reviews.forecast() })
    },
  })

  function handlePageSizeChange(next: CardPageSize): void {
    setPageSize(next)
    // Changing page size changes how the result set paginates, so jump back
    // to page 1 (pageSize itself is local, not a URL param).
    updateUrlState({ page: 1 })
  }

  function handleNextPage(): void {
    if (hasNext && !isCardsFetching) {
      updateUrlState({ page: pageIndex + 2 })
    }
  }

  function handlePrevPage(): void {
    updateUrlState({ page: Math.max(1, pageIndex) })
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
      // The `premadeDecks.subscriptions` invalidation that lived here was
      // removed in Backend Completion Plan Stage 4 (copy model): the
      // subscription concept is gone, and "decks I copied from premade"
      // is now a client-side filter on the decks list (already invalidated
      // via decks.all() above).
      router.push('/decks')
    },
  })

  function handleArchive(): void {
    archiveSet.archive(deckId)
    showToast(`Archived "${truncate(displayName, 28)}". You can restore it from this page or the Decks list.`)
  }

  function handleRestore(): void {
    archiveSet.restore(deckId)
    showToast(`Restored "${truncate(displayName, 28)}".`)
  }

  // ── Render ────────────────────────────────────────────────────────────
  const studyHref = `/review/setup?deck=${encodeURIComponent(deckId)}`
  // Study is unavailable when the deck has no cards, or when it's archived
  // (archive sets the deck aside; you restore it before studying again).
  const studyDisabled       = isCardListEmpty || isArchived
  const studyDisabledReason = isArchived
    ? 'Restore this deck to study it.'
    : 'Add a card to study this deck.'

  if (deckLoading || cardsLoading) {
    return (
      <>
        <TopBar>
          <TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
          <TopBarTitle kanji="束" label={displayName} />
        </TopBar>
        <PageLoader />
      </>
    )
  }

  return (
    <>
      <TopBar>
        <TopBarBackLink href="/decks" ariaLabel="Back to Decks" />
        <TopBarTitle kanji="束" label={displayName} />

        <TopBarActions>
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
              className="ui-motion-colors flex h-8 w-8 shrink-0 items-center justify-center rounded-xs text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
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
        </TopBarActions>
      </TopBar>

      <PageFrame>

          {/* ── Page hero + primary action ─────────────────────────────
              Header and the Study CTA are grouped into one grid child with a
              tight internal gap, so the page's larger inter-section rhythm
              only opens up *around* the pair — the button sits close under
              the title instead of floating in a full grid gap. The CTA is
              left-aligned on the reading edge and desktop-only (phones use the
              sticky bottom bar). */}
          <div className="flex flex-col gap-4">
            <PageHeader
              kanji="棚"
              label="Decks"
              title={displayName}
              {...(deck?.description !== null && deck?.description !== undefined && deck.description.length > 0
                ? { subtitle: deck.description }
                : {})}
            />
            <div className="hidden justify-start sm:flex">
              <StudyDeckCta
                href={studyHref}
                disabled={studyDisabled}
                reason={studyDisabledReason}
                size="lg"
              />
            </div>
          </div>

          {/* ── Snapshot ledger ────────────────────────────────────────
              Full-width rule-bounded stat line. Sits between the header and
              the toolbar so the card list below keeps the entire content
              column — the old sidebar placement narrowed the list.

              Negative top margin neutralises most of the page grid's
              inter-section gap so the ledger sits as close under the Study
              CTA as the CTA sits under the title (a balanced `gap-4` band on
              both sides of the button). */}
          <div className="-mt-4 lg:-mt-6">
            <DeckSnapshotRibbon deck={deck} loading={deckLoading} />
            {isArchived && (
              <p className="mt-4 text-xs text-faded-sumi">
                Archived on this device. It's set aside from your Decks list and daily review queue. Restore it to study again.
              </p>
            )}
          </div>

          {/* ── Cards ──────────────────────────────────────────────────
              Deck-level actions (rename, archive, delete, open in Cards) live
              in the top-bar overflow menu, so this view is just the card list. */}
          <section aria-label="Cards in this deck" className="min-w-0">
              <DeckCardToolbar
                status={status}
                onStatusChange={(next) => updateUrlState({ status: next })}
                searchValue={searchValue}
                onSearchChange={(next) => updateUrlState({ search: next })}
              />

              {/* Count + sort line. Same control the Cards browser uses, so the
                  count, sort axis, and direction toggle read as one sentence. */}
              {!isCardListEmpty && !cardsError && (
                <div className="mt-4">
                  <CardsCountLine
                    totalCount={totalMatching}
                    sort={sort}
                    sortDir={sortDir}
                    onPickSort={(nextSort) => updateUrlState({ sort: nextSort, sortDir: null })}
                    onToggleSortDir={() => {
                      const natural = naturalSortDirFor(sort)
                      const current = sortDir ?? natural
                      const flipped: CardSortDir = current === 'asc' ? 'desc' : 'asc'
                      updateUrlState({ sortDir: flipped === natural ? null : flipped })
                    }}
                  />
                </div>
              )}

              <div className="mt-4">
                {cardsError ? (
                  <CardListErrorState onRetry={() => void refetch()} />
                ) : isCardListEmpty ? (
                  <EmptyDeckState deckId={deckId} />
                ) : filteredEmpty ? (
                  <NoMatchState
                    searchValue={searchValue}
                    selectedStatusLabel={selectedStatusLabel}
                    onClearSearch={() => updateUrlState({ search: '' })}
                  />
                ) : (
                  <CardsResultsTable
                    rows={visibleCards.map((card) => apiCardToRow(card, deckId, displayName))}
                    onRowAction={(cardId, action) => {
                      const card = visibleCards.find((c) => c.id === cardId)
                      if (card === undefined) return
                      handleCardRowAction(action, card)
                    }}
                    selectedIds={selected}
                    onToggleSelection={toggleSelection}
                    onToggleAllVisible={toggleAllVisible}
                    cardHrefSuffix="?from=decks"
                  />
                )}
              </div>

              {/* Pagination footer — visible whenever there's at least one
                  card to paginate (search runs through the same endpoint
                  now, so paging works the same way with or without it). */}
              {!cardsLoading && !cardsError && cardCount > 0 && (
                <CardListPagination
                  pageIndex={pageIndex}
                  pageSize={pageSize}
                  pageItemCount={visibleCards.length}
                  hasPrev={hasPrev}
                  hasNext={hasNext}
                  isFetchingNext={isCardsFetching && !cardsLoading}
                  totalCount={data?.totalCount}
                  onPrev={handlePrevPage}
                  onNext={handleNextPage}
                  onPageSizeChange={handlePageSizeChange}
                />
              )}
          </section>
      </PageFrame>

      {/* ── Mobile-only sticky Study CTA ───────────────────────────────────
          The header's Study button lives in PageHeader.rightSlot, which is
          hidden below sm. Phones get the primary action here instead so it's
          always reachable while scrolling the card list. Solid paper bar (no
          glass blur), top hairline, safe-area aware. Disabled (rendered
          without a Link) when the deck is empty or archived. Hidden while a
          bulk selection is active so the bulk bar owns the bottom edge. */}
      {selected.size === 0 && (
        <div
          className="fixed inset-x-0 bottom-0 z-[var(--z-bar)] border-t border-soft-hairline bg-cool-paper-base px-4 pt-3 sm:hidden"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
        >
          <StudyDeckCta href={studyHref} disabled={studyDisabled} reason={studyDisabledReason} full />
        </div>
      )}

      {/* ── Bulk-action bar ────────────────────────────────────────────────
          Appears once one or more cards are selected. Sticky to the bottom of
          the app scroll container (the layout <main>), spanning the content
          column. Move / Suspend / Delete mirror the Cards browser; Delete is
          gated behind a confirmation dialog. */}
      {selected.size > 0 && (
        <CardsBulkBar
          selectedCount={selected.size}
          onMove={() => setBulkMoveOpen(true)}
          onSuspend={handleBulkSuspend}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />
      )}

      {/* ── Dialogs ────────────────────────────────────────────────────── */}
      <RenameDeckDialog
        open={activeDialog.kind === 'rename'}
        deck={deck ?? null}
        currentName={displayName}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
        onError={(msg) => showToast(msg)}
        onSuccess={(name) => showToast(`Renamed to "${truncate(name, 28)}".`)}
      />

      <DeleteDeckDialog
        open={activeDialog.kind === 'delete'}
        deck={deck ?? null}
        cardCount={cardCount}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onError={(msg) => showToast(msg)}
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
              showToast('Card deleted.')
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
                showToast('Card moved.')
              },
            },
          )
        }}
      />

      <MoveCardDialog
        card={activeDialog.kind === 'add-card' ? activeDialog.card : null}
        currentDeckId={deckId}
        variant="add"
        isSubmitting={copyCardMutation.isPending}
        errorMessage={copyCardMutation.isError ? (copyCardMutation.error?.message ?? 'Unknown error') : null}
        onCancel={() => {
          setActiveDialog({ kind: 'none' })
          copyCardMutation.reset()
        }}
        onConfirm={(target, targetDeckId) => {
          copyCardMutation.mutate(
            { cardId: target.id, targetDeckId },
            {
              onSuccess: () => {
                setActiveDialog({ kind: 'none' })
                showToast('Copy added to deck.')
              },
            },
          )
        }}
      />

      {/* Bulk move — reuses MoveCardDialog with a synthetic "N cards" card.
          Every selected card lives in this deck, so the source is deckId. */}
      <MoveCardDialog
        card={bulkMoveOpen ? bulkMoveSyntheticCard(selected.size) : null}
        currentDeckId={deckId}
        variant="move"
        isSubmitting={bulkMoveMutation.isPending}
        errorMessage={bulkMoveMutation.error?.message ?? null}
        onCancel={() => setBulkMoveOpen(false)}
        onConfirm={handleBulkMoveConfirm}
      />

      <BulkDeleteCardsDialog
        open={bulkDeleteOpen}
        count={selected.size}
        isSubmitting={bulkDeleteMutation.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
      />

      {/* The deleteMutation from this view is kept for backwards-compatibility
          with prior tests / hooks, but the dialog above owns the user flow. */}
      {deleteMutation.isError && null}

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

// ── Sub-views ───────────────────────────────────────────────────────────

/**
 * Primary "Study deck" action, shared by the desktop header slot and the
 * mobile sticky bar. When disabled it renders a bare button (no `<Link>`):
 * the Button sets `pointer-events-none` while disabled, so wrapping it in an
 * anchor would let the parent link still navigate. The `reason` surfaces as a
 * hover title; the page's archived notice / empty state carry it in-flow for
 * touch and screen-reader users.
 */
function StudyDeckCta({
  href,
  disabled,
  reason,
  full = false,
  size = 'md',
}: {
  href:      string
  disabled:  boolean
  reason:    string
  full?:     boolean
  size?:     'md' | 'lg'
}): React.JSX.Element {
  const button = (
    <Button size={size} disabled={disabled} className={full ? 'w-full' : ''}>
      Study deck
    </Button>
  )
  if (disabled) {
    return <span title={reason} className={full ? 'block' : 'inline-block'}>{button}</span>
  }
  return <Link href={href} className={full ? 'block' : ''}>{button}</Link>
}

function BulkDeleteCardsDialog({
  open,
  count,
  isSubmitting,
  onCancel,
  onConfirm,
}: {
  open:         boolean
  count:        number
  isSubmitting: boolean
  onCancel:     () => void
  onConfirm:    () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onClose={onCancel} title={`Delete ${count} ${count === 1 ? 'card' : 'cards'}?`}>
      <p className="mb-5 text-sm text-faded-sumi">
        Their review history will be removed permanently. This cannot be undone.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="button" variant="danger" loading={isSubmitting} onClick={onConfirm}>
          Delete {count === 1 ? 'card' : 'cards'}
        </Button>
      </div>
    </Dialog>
  )
}

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
    <EmptyState kanji="空" title="This deck is empty">
      <p className="max-w-measure-tight text-sm text-faded-sumi">
        Add your first card to start studying, or browse premade starter decks.
      </p>
      <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
        <Link href={`/add?deck=${encodeURIComponent(deckId)}`}>
          <Button size="md">Add Japanese</Button>
        </Link>
        <Link href="/decks/premade">
          <Button size="md" variant="secondary">Browse premade decks</Button>
        </Link>
      </div>
    </EmptyState>
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
    <EmptyState kanji="空" density="quiet">
      <p className="max-w-measure-tight text-sm text-faded-sumi">
        {searchValue.length > 0 ? (
          <>
            No cards match <span className="font-medium text-sumi-ink">'{searchValue}'</span>.{' '}
            <button
              type="button"
              onClick={onClearSearch}
              className="text-sumi-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Clear search
            </button>
            .
          </>
        ) : (
          <>No {selectedStatusLabel.toLowerCase()} cards in this deck.</>
        )}
      </p>
    </EmptyState>
  )
}

function CardListErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <EmptyState density="quiet" role="alert">
      <div>
        <p className="text-sm font-medium text-sumi-ink">Couldn't load this deck's cards.</p>
        <p className="mt-1 max-w-measure-tight text-sm text-faded-sumi">
          The list tried to read from the server and didn't get a reply. Try again in a moment.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </EmptyState>
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

// ── URL-canonical filter state ──────────────────────────────────────────
// Three deep-linkable params on the deck route: `status`, `q` (search), and
// `page` (1-indexed). Defaults (All / empty / page 1) are omitted from the URL
// so a clean deck link stays clean. `pageSize` is intentionally absent — it's
// a viewing preference held in local state, matching cards-browser-view.

interface DeckCardsUrlState {
  status:  StatusFilter
  search:  string
  /** Sort axis. Default 'recent' (newest added first). */
  sort:    CardSortField
  /** Explicit direction override, or null to mean "the axis's natural default." */
  sortDir: CardSortDir | null
  page:    number
}

const STATUS_VALUES: readonly StatusFilter[] = ['all', 'new', 'learning', 'review', 'suspended']
const SORT_VALUES:   readonly CardSortField[] = ['recent', 'due', 'lapses']
const DEFAULT_SORT:  CardSortField = 'recent'

function parseDeckCardsUrl(get: (key: string) => string | null): DeckCardsUrlState {
  const rawStatus = get('status')
  const status = rawStatus !== null && (STATUS_VALUES as readonly string[]).includes(rawStatus)
    ? (rawStatus as StatusFilter)
    : 'all'

  const search = get('q') ?? ''

  const rawSort = get('sort')
  const sort = rawSort !== null && (SORT_VALUES as readonly string[]).includes(rawSort)
    ? (rawSort as CardSortField)
    : DEFAULT_SORT

  const rawDir = get('dir')
  const sortDir: CardSortDir | null = rawDir === 'asc' || rawDir === 'desc' ? rawDir : null

  const rawPage = Number(get('page'))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1

  return { status, search, sort, sortDir, page }
}

function serializeDeckCardsUrl(state: DeckCardsUrlState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.status !== 'all')         params.set('status', state.status)
  if (state.search.trim().length > 0) params.set('q', state.search)
  if (state.sort !== DEFAULT_SORT)    params.set('sort', state.sort)
  if (state.sortDir !== null)         params.set('dir', state.sortDir)
  if (state.page > 1)                 params.set('page', String(state.page))
  return params
}

/**
 * Synthetic single-card payload so the bulk Move flow can reuse MoveCardDialog
 * (which is built around one card). Only the display label matters here; the
 * actual ids come from the live selection set at confirm time.
 */
function bulkMoveSyntheticCard(count: number): ApiCardListItem {
  return {
    id:          'bulk',
    fieldsData:  { word: `${count} ${count === 1 ? 'card' : 'cards'}`, reading: '', meaning: '' },
    layoutType:  'vocabulary',
    jlptLevel:   null,
    state:       0 as ApiCardListItem['state'],
    isSuspended: false,
    due:         new Date().toISOString(),
  }
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
    jlptLevel:   card.jlptLevel,
    partOfSpeech: wordFields?.partOfSpeech ?? null,
    state:       card.state,
    isSuspended: card.isSuspended,
    lapses:      0,
    due:         card.due,
  }
}
