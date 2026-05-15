'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiDeck, ApiDeckWithStats } from '@fsrs-japanese/shared-types'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Button } from '@/components/ui/Button'
import { IconPlus } from '@/components/icons/chrome-marks'
import { deleteDeckAction, getDeckAction, listDecksAction } from '@/lib/actions/decks.actions'
import { queryKeys } from '@/lib/api/queryKeys'
import { inferDeckLevel } from '@/lib/deck-level'

import { CreateDeckDialog } from './create-deck-dialog'
import { DeckCard } from './deck-card'
import { DeckCardSkeleton } from './deck-skeleton'
import {
  DeleteDeckDialog,
  EditDeckOptionsDialog,
  RenameDeckDialog,
} from './deck-dialogs'
import { DecksCurateBar } from './decks-curate-bar'
import { DecksHeader, type HeaderVariant } from './decks-header'
import { DecksPagination } from './decks-pagination'
import { DecksUtilityRow } from './decks-utility-row'
import { SectionMarker } from './section-marker'
import {
  useArchiveSet,
  useLocalNameOverrides,
  useStudyOrder,
  useViewPrefs,
  type DecksSortKey,
} from './use-deck-prefs'

const PAGE_SIZE = 12

type Toast = { kind: 'info' | 'error'; message: string; key: number }
type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'rename'; deck: ApiDeck }
  | { kind: 'delete'; deck: ApiDeck }
  | { kind: 'edit';   deck: ApiDeck }
  | { kind: 'create' }

interface DragState {
  draggedId:    string
  draggedIndex: number
  overIndex:    number | null
  pointerY:     number
}

// ─── Component ────────────────────────────────────────────────────────────

export function DeckListView(): React.JSX.Element {
  const queryClient = useQueryClient()

  // ── Data ──────────────────────────────────────────────────────────────
  const { data, isLoading, isError } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
  })
  const allDecks: ApiDeck[] = useMemo(() => data?.items ?? [], [data])

  const knownIds = useMemo(() => allDecks.map((d) => d.id), [allDecks])

  // Subscribe to per-deck details so "Most due first" sort and the priority
  // sub-line have access to dueCount. Shares cache with each DeckCard's own
  // useQuery, so this doesn't fire extra requests.
  const detailResults = useQueries({
    queries: allDecks.map((deck) => ({
      queryKey: queryKeys.decks.detail(deck.id),
      queryFn:  () => getDeckAction(deck.id),
    })),
  })
  const dueByDeckId = useMemo(() => {
    const map = new Map<string, number>()
    allDecks.forEach((deck, i) => {
      const result = detailResults[i]
      const stats  = result?.data as ApiDeckWithStats | null | undefined
      if (stats != null) map.set(deck.id, stats.dueCount ?? 0)
    })
    return map
  }, [allDecks, detailResults])

  // ── Persistent state (localStorage) ───────────────────────────────────
  const { prefs, setSort, setTypeFilter, setShowArchived } = useViewPrefs()
  const studyOrder = useStudyOrder(knownIds)
  const archiveSet = useArchiveSet()
  const nameOverrides = useLocalNameOverrides()

  // ── Local UI state ────────────────────────────────────────────────────
  const [searchInputValue, setSearchInputValue] = useState('')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [page,             setPage]             = useState(1)
  const [curateMode,       setCurateMode]       = useState(false)
  const [selectedIds,      setSelectedIds]      = useState<ReadonlySet<string>>(new Set())
  const [dragState,        setDragState]        = useState<DragState | null>(null)
  const [activeDialog,     setActiveDialog]     = useState<ActiveDialog>({ kind: 'none' })
  const [toast,            setToast]            = useState<Toast | null>(null)

  const utilityRowRef = useRef<HTMLElement | null>(null)

  // Debounce the search filter so each keystroke doesn't recompute the list.
  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInputValue.trim()), 180)
    return () => window.clearTimeout(id)
  }, [searchInputValue])

  // Reset to first page whenever filter/sort/search/archive changes.
  useEffect(() => { setPage(1) }, [prefs.sort, prefs.typeFilter, prefs.showArchived, searchQuery])

  // Auto-dismiss toasts.
  useEffect(() => {
    if (toast === null) return
    const id = window.setTimeout(() => setToast(null), 3200)
    return () => window.clearTimeout(id)
  }, [toast])

  function showToast(message: string, kind: Toast['kind'] = 'info'): void {
    setToast({ message, kind, key: Date.now() })
  }

  // ── Derived data ──────────────────────────────────────────────────────

  // Each non-archived deck has a stable slot index, 1-based. Archived decks
  // get null and are excluded from the queue.
  const slotByDeckId = useMemo(() => {
    const map = new Map<string, number>()
    let slot = 1
    for (const deckId of studyOrder.resolvedOrder) {
      if (archiveSet.isArchived(deckId)) continue
      map.set(deckId, slot++)
    }
    return map
  }, [studyOrder.resolvedOrder, archiveSet])

  // Map of deck-id → resolved display name (applies any local rename override).
  const displayNameOf = useCallback(
    (deck: ApiDeck) => nameOverrides.nameFor(deck.id, deck.name),
    [nameOverrides],
  )

  // Effective list after filtering by type / archived / search.
  const filteredDecks: ApiDeck[] = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return allDecks.filter((deck) => {
      const archived = archiveSet.isArchived(deck.id)
      if (prefs.showArchived !== archived) return false
      if (prefs.typeFilter !== 'all' && deck.deckType !== prefs.typeFilter) return false
      if (q.length > 0) {
        const haystack = `${displayNameOf(deck)} ${deck.description ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allDecks, prefs.typeFilter, prefs.showArchived, searchQuery, archiveSet, displayNameOf])

  // Sort the filtered list according to the chosen sort. Study order uses the
  // resolved order's index; non-study sorts use the deck's own metadata.
  const sortedDecks: ApiDeck[] = useMemo(() => {
    const list = [...filteredDecks]
    list.sort((a, b) => compareDecks(a, b, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf))
    return list
  }, [filteredDecks, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf])

  const totalCount = sortedDecks.length
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageStart  = (safePage - 1) * PAGE_SIZE
  const pageEnd    = Math.min(pageStart + PAGE_SIZE, totalCount)
  const visibleDecks = useMemo(() => sortedDecks.slice(pageStart, pageEnd), [sortedDecks, pageStart, pageEnd])

  // Drag-to-reorder only operates in V1 (the vertical-list baseline). The
  // variations carry their own layout topologies, some of which can't host a
  // single-axis drag reliably; their kebab menus expose Move up / Move down
  // / Set as priority as accessible alternatives.
  const canReorder = prefs.sort === 'study-order' && !prefs.showArchived
  const archivedCount  = useMemo(
    () => allDecks.filter((d) => archiveSet.isArchived(d.id)).length,
    [allDecks, archiveSet],
  )
  const activeCount = allDecks.length - archivedCount

  const priorityDeckId   = studyOrder.priorityDeckId
  const priorityDeckName = useMemo(() => {
    if (priorityDeckId === null) return null
    if (archiveSet.isArchived(priorityDeckId)) return null
    const deck = allDecks.find((d) => d.id === priorityDeckId)
    return deck === undefined ? null : displayNameOf(deck)
  }, [priorityDeckId, allDecks, archiveSet, displayNameOf])

  // ── Header variant ────────────────────────────────────────────────────
  const headerVariant: HeaderVariant = useMemo(() => {
    if (isLoading) return { kind: 'loading' }
    if (isError)   return { kind: 'error' }
    if (allDecks.length === 0) return { kind: 'empty' }
    if (searchQuery.length > 0) {
      return { kind: 'search', query: searchQuery, matchedCount: totalCount, totalCount: allDecks.length }
    }
    return { kind: 'default', activeCount, archivedCount, priorityDeckName }
  }, [isLoading, isError, allDecks.length, searchQuery, totalCount, activeCount, archivedCount, priorityDeckName])

  // ── Drag-to-reorder pointer state machine ─────────────────────────────
  const handleDragHandleDown = useCallback(
    (deckId: string, viewIndex: number) =>
      (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!canReorder) return
        event.preventDefault()
        // Use pointer capture on the document body via window listeners. We don't
        // capture on the handle itself because the handle is small and the user
        // will drag well beyond its bounds.
        setDragState({
          draggedId:    deckId,
          draggedIndex: viewIndex,
          overIndex:    viewIndex,
          pointerY:     event.clientY,
        })
      },
    [canReorder],
  )

  useEffect(() => {
    if (dragState === null) return

    function onMove(event: PointerEvent): void {
      const els = Array.from(document.querySelectorAll<HTMLElement>('[data-deck-id]'))
      let bestIndex = 0
      let bestDistance = Infinity
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        if (el === undefined) continue
        const rect = el.getBoundingClientRect()
        const mid = rect.top + rect.height / 2
        const distance = Math.abs(event.clientY - mid)
        if (distance < bestDistance) {
          bestDistance = distance
          bestIndex = i
        }
      }
      setDragState((prev) => (prev === null ? null : { ...prev, overIndex: bestIndex, pointerY: event.clientY }))
    }

    function onUp(): void {
      setDragState((prev) => {
        if (prev === null) return null
        if (prev.overIndex === null || prev.overIndex === prev.draggedIndex) return null
        // Translate viewIndex (within visibleDecks) into a position within the
        // resolved studyOrder. Then commit the new study order.
        const fromVisible = visibleDecks[prev.draggedIndex]
        const toVisible   = visibleDecks[prev.overIndex]
        if (fromVisible === undefined || toVisible === undefined) return null

        const order = [...studyOrder.resolvedOrder]
        const fromIdx = order.indexOf(fromVisible.id)
        const toIdx   = order.indexOf(toVisible.id)
        if (fromIdx === -1 || toIdx === -1) return null

        const moved = order.splice(fromIdx, 1)[0]
        if (moved !== undefined) {
          order.splice(toIdx, 0, moved)
          studyOrder.setOrder(order)
        }
        return null
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragState, visibleDecks, studyOrder])

  // ── Curate-mode lifecycle ─────────────────────────────────────────────
  useEffect(() => {
    if (!curateMode) setSelectedIds(new Set())
  }, [curateMode])

  function toggleSelected(deckId: string): void {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(deckId)) next.delete(deckId)
      else next.add(deckId)
      return next
    })
  }

  // ── Action handlers ───────────────────────────────────────────────────
  function handleSetAsPriority(deckId: string, deckName: string): void {
    if (archiveSet.isArchived(deckId)) {
      archiveSet.restore(deckId)
    }
    studyOrder.setAsPriority(deckId)
    showToast(`Pinned "${truncate(deckName, 28)}" as priority.`)
  }

  function handleArchive(deckId: string, deckName: string): void {
    archiveSet.archive(deckId)
    showToast(`Archived "${truncate(deckName, 28)}".`)
  }

  function handleRestore(deckId: string, deckName: string): void {
    archiveSet.restore(deckId)
    showToast(`Restored "${truncate(deckName, 28)}".`)
  }

  function handleCopy(): void {
    showToast('Copy is coming soon. Renames, deletes, and archives work now.')
  }

  function handleBulkArchive(): void {
    const ids = [...selectedIds]
    archiveSet.archiveMany(ids)
    showToast(`Archived ${ids.length} deck${ids.length === 1 ? '' : 's'}.`)
    setCurateMode(false)
  }

  function handleBulkCopy(): void {
    showToast('Copy is coming soon. Renames, deletes, and archives work now.')
  }

  function handleBulkDelete(): void {
    // Sequentially delete; collect failures into a single toast.
    const ids = [...selectedIds]
    setCurateMode(false)
    setActiveDialog({ kind: 'none' })
    void Promise.allSettled(
      ids.map((id) => deleteDeckAction(id)),
    ).then((results) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
      const failures = results.filter((r) => r.status === 'rejected').length
      if (failures === 0) {
        showToast(`Deleted ${ids.length} deck${ids.length === 1 ? '' : 's'}.`)
      } else if (failures === ids.length) {
        showToast(`Couldn't delete ${ids.length} deck${ids.length === 1 ? '' : 's'}.`, 'error')
      } else {
        showToast(`Deleted ${ids.length - failures}. ${failures} failed.`, 'error')
      }
    })
  }

  function handleBulkMoveToTop(): void {
    const ids = [...selectedIds]
    studyOrder.moveToTop(ids)
    showToast(`Moved ${ids.length} deck${ids.length === 1 ? '' : 's'} to the top of the study order.`)
    setCurateMode(false)
  }

  // ── Render ────────────────────────────────────────────────────────────

  const showCurateMode = curateMode && allDecks.length > 0

  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-sumi-ink">Library</h1>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setActiveDialog({ kind: 'create' })}
          leadingIcon={<IconPlus className="h-3.5 w-3.5" />}
        >
          New deck
        </Button>
      </TopBar>

      {/* Page background tone shift in curate mode. The tonal step is the
          quiet signal that "you are editing the list now." */}
      <div
        className={[
          'ui-motion-colors min-h-screen pb-32',
          showCurateMode ? 'bg-cool-paper-shade' : 'bg-cool-paper-base',
        ].join(' ')}
      >
        <div className="relative mx-auto max-w-[64rem] px-4 sm:px-6 lg:px-8">
          {/* Page-scope ornaments that frame the page as a printed
              register: a 2px vermillion top rule across the full page
              width, and a 1px vermillion left margin rule running
              floor-to-ceiling. */}
          <span
            aria-hidden="true"
            className="block h-[2px] w-full bg-inari-vermillion"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 bottom-0 w-px bg-inari-vermillion"
          />

          {/* Section title — the editorial header with mono eyebrow,
              Bricolage title, status sub-line, all inside a tinted
              Cool Paper Shade panel. */}
          <DecksHeader variant={headerVariant} />

          {/* Section marker for the utility row */}
          {!(headerVariant.kind === 'empty') && (
            <div className="mt-2 mb-1.5">
              <SectionMarker label="Filter" />
            </div>
          )}

          {/* Shared utility row */}
          {!(headerVariant.kind === 'empty') && (
            <section ref={(node) => { utilityRowRef.current = node }}>
              <DecksUtilityRow
                sort={prefs.sort}
                typeFilter={prefs.typeFilter}
                showArchived={prefs.showArchived}
                searchQuery={searchInputValue}
                curateActive={curateMode}
                onSort={setSort}
                onTypeFilter={setTypeFilter}
                onShowArchived={setShowArchived}
                onSearchQuery={setSearchInputValue}
                onCurate={() => setCurateMode((v) => !v)}
              />
            </section>
          )}

          {/* Section marker for the deck list */}
          {!isLoading && !isError && allDecks.length > 0 && (
            <div className="mt-3 mb-2">
              <SectionMarker label="Decks" />
            </div>
          )}

          {/* List area */}
          <section aria-label="Deck list" className="mt-3 space-y-2">
            {isLoading && (
              <>
                <DeckCardSkeleton index={0} />
                <DeckCardSkeleton index={1} />
                <DeckCardSkeleton index={2} />
              </>
            )}

            {!isLoading && isError && <ErrorState />}

            {!isLoading && !isError && allDecks.length === 0 && (
              <EmptyState onCreate={() => setActiveDialog({ kind: 'create' })} />
            )}

            {!isLoading && !isError && allDecks.length > 0 && visibleDecks.length === 0 && (
              <NoMatchesState
                query={searchQuery}
                showArchived={prefs.showArchived}
                typeFilter={prefs.typeFilter}
              />
            )}

            {!isLoading && !isError && visibleDecks.map((deck, viewIndex) => {
              const isPriority = !archiveSet.isArchived(deck.id) && deck.id === priorityDeckId
              const slotIndex  = slotByDeckId.get(deck.id) ?? null
              const isArchived = archiveSet.isArchived(deck.id)
              const isDragging  = dragState?.draggedId === deck.id
              const isDropTarget = dragState?.overIndex === viewIndex && dragState?.draggedId !== deck.id
              const orderIndex = studyOrder.resolvedOrder.indexOf(deck.id)

              return (
                <DeckCard
                  key={deck.id}
                  deck={deck}
                  displayName={displayNameOf(deck)}
                  slotIndex={isArchived ? null : slotIndex}
                  viewIndex={viewIndex}
                  isPriority={isPriority}
                  isArchived={isArchived}
                  curateMode={curateMode}
                  selected={selectedIds.has(deck.id)}
                  dragEnabled={canReorder && curateMode}
                  isDragging={isDragging}
                  isDropTarget={isDropTarget}
                  canMoveUp={!isArchived && orderIndex > 0}
                  canMoveDown={!isArchived && orderIndex >= 0 && orderIndex < studyOrder.resolvedOrder.length - 1}
                  onToggleSelect={() => toggleSelected(deck.id)}
                  onSetAsPriority={() => handleSetAsPriority(deck.id, displayNameOf(deck))}
                  onRename={() => setActiveDialog({ kind: 'rename', deck })}
                  onCopy={handleCopy}
                  onEditOptions={() => setActiveDialog({ kind: 'edit', deck })}
                  onArchive={() => handleArchive(deck.id, displayNameOf(deck))}
                  onRestore={() => handleRestore(deck.id, displayNameOf(deck))}
                  onDelete={() => setActiveDialog({ kind: 'delete', deck })}
                  onMoveUp={() => studyOrder.moveUp(deck.id)}
                  onMoveDown={() => studyOrder.moveDown(deck.id)}
                  onDragHandleDown={handleDragHandleDown(deck.id, viewIndex)}
                />
              )
            })}
          </section>

          {/* Pagination. Renders for every variant; all V2-V6 keep V1's
              vertical-list layout and the orchestrator's pagination chrome
              fits naturally below their list area. */}
          {!isLoading && !isError && visibleDecks.length > 0 && (
            <DecksPagination
              page={safePage}
              pageSize={PAGE_SIZE}
              totalCount={totalCount}
              scrollTargetEl={utilityRowRef as React.RefObject<HTMLElement | null>}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      {/* Curate bar (sticky bottom) */}
      {showCurateMode && (
        <DecksCurateBar
          selectedCount={selectedIds.size}
          totalCount={allDecks.length}
          canReorder={canReorder}
          onDone={() => setCurateMode(false)}
          onMoveToTop={handleBulkMoveToTop}
          onArchive={handleBulkArchive}
          onCopy={handleBulkCopy}
          onDelete={() => handleBulkDelete()}
        />
      )}

      {/* Dialogs */}
      <CreateDeckDialog
        open={activeDialog.kind === 'create'}
        onClose={() => setActiveDialog({ kind: 'none' })}
      />

      <RenameDeckDialog
        open={activeDialog.kind === 'rename'}
        deck={activeDialog.kind === 'rename' ? activeDialog.deck : null}
        currentName={
          activeDialog.kind === 'rename'
            ? displayNameOf(activeDialog.deck)
            : ''
        }
        onClose={() => setActiveDialog({ kind: 'none' })}
        onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
        onError={(msg) => showToast(msg, 'error')}
        onSuccess={(name) => showToast(`Renamed to "${truncate(name, 28)}".`)}
      />

      <DeleteDeckDialog
        open={activeDialog.kind === 'delete'}
        deck={activeDialog.kind === 'delete' ? activeDialog.deck : null}
        cardCount={activeDialog.kind === 'delete' ? activeDialog.deck.cardCount : 0}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onError={(msg) => showToast(msg, 'error')}
        onSuccess={(name) => {
          // Clear any local override and archive bit for the deleted deck.
          if (activeDialog.kind === 'delete') {
            nameOverrides.setNameOverride(activeDialog.deck.id, null)
            archiveSet.restore(activeDialog.deck.id)
          }
          showToast(`Deleted "${truncate(name, 28)}".`)
        }}
      />

      <EditDeckOptionsDialog
        open={activeDialog.kind === 'edit'}
        deck={activeDialog.kind === 'edit' ? activeDialog.deck : null}
        isArchived={activeDialog.kind === 'edit' ? archiveSet.isArchived(activeDialog.deck.id) : false}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onLocalRename={(id, name) => nameOverrides.setNameOverride(id, name)}
        onArchive={(id) => archiveSet.archive(id)}
        onRestore={(id) => archiveSet.restore(id)}
        onError={(msg) => showToast(msg, 'error')}
        onSuccess={(msg) => showToast(msg)}
      />

      {/* Toast */}
      {toast !== null && (
        <ToastView key={toast.key} toast={toast} onDismiss={() => setToast(null)} />
      )}

    </>
  )
}

// ── Sub-views ────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <div className="mt-2 rounded-[2px] border border-soft-hairline bg-cream-inset/60 p-8 text-center sm:p-12">
      <p className="text-base font-medium text-sumi-ink">No decks yet</p>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-sm text-faded-sumi">
        Find a curated premade deck to begin, or create your own.
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Link href="/decks">
          <Button size="md">Find a deck</Button>
        </Link>
        <Button size="md" variant="ghost" onClick={onCreate}>
          Create your own deck
        </Button>
      </div>
    </div>
  )
}

function NoMatchesState({
  query,
  showArchived,
  typeFilter,
}: {
  query:        string
  showArchived: boolean
  typeFilter:   string
}): React.JSX.Element {
  let body: React.ReactNode
  if (query.length > 0) {
    body = (
      <>
        No decks match <span className="text-sumi-ink/85">'{query}'</span>. Try a different term.
      </>
    )
  } else if (showArchived) {
    body = 'No archived decks yet. Archive a deck from its options menu to hide it from the queue.'
  } else if (typeFilter !== 'all') {
    body = `No ${typeFilter} decks. Adjust the Type filter to see more.`
  } else {
    body = 'No decks in this view.'
  }

  return (
    <div className="mt-2 rounded-[2px] border border-soft-hairline bg-cream-inset/45 p-6 text-center">
      <p className="text-sm text-faded-sumi">{body}</p>
    </div>
  )
}

function ErrorState(): React.JSX.Element {
  return (
    <div className="mt-2 rounded-[2px] border border-soft-hairline bg-cream-inset/55 p-6 text-center">
      <p className="text-sm font-medium text-sumi-ink">Couldn't load your decks.</p>
      <p className="mt-1 text-sm text-faded-sumi">
        The library tried to read from the server and didn't get a reply. Refresh the page or try again in a moment.
      </p>
      <div className="mt-4">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => window.location.reload()}
        >
          Try again
        </Button>
      </div>
    </div>
  )
}

function ToastView({
  toast,
  onDismiss,
}: {
  toast:     Toast
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onDismiss}
      className={[
        'fixed bottom-4 right-4 z-30 max-w-[28rem] rounded-[2px] border bg-warm-paper-raised px-3.5 py-2.5 text-sm shadow-[var(--shadow-card)]',
        'animate-page-enter cursor-pointer',
        toast.kind === 'error'
          ? 'border-inari-vermillion/40 text-inari-vermillion-deep'
          : 'border-soft-hairline text-sumi-ink',
      ].join(' ')}
    >
      {toast.message}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function compareDecks(
  a:              ApiDeck,
  b:              ApiDeck,
  sort:           DecksSortKey,
  slotById:       Map<string, number>,
  dueById:        Map<string, number>,
  displayNameOf:  (deck: ApiDeck) => string,
): number {
  switch (sort) {
    case 'study-order': {
      const ai = slotById.get(a.id) ?? Number.MAX_SAFE_INTEGER
      const bi = slotById.get(b.id) ?? Number.MAX_SAFE_INTEGER
      return ai - bi
    }
    case 'alphabetical':
      return displayNameOf(a).localeCompare(displayNameOf(b), 'en', { sensitivity: 'base' })
    case 'recently-reviewed':
      // Higher updatedAt comes first. The list endpoint guarantees ISO strings.
      return b.updatedAt.localeCompare(a.updatedAt)
    case 'most-due-first': {
      const ad = dueById.get(a.id) ?? 0
      const bd = dueById.get(b.id) ?? 0
      if (ad !== bd) return bd - ad
      return displayNameOf(a).localeCompare(displayNameOf(b))
    }
    case 'jlpt-level': {
      const order: Record<string, number> = { N5: 1, N4: 2, N3: 3, N2: 4, N1: 5, beyond_jlpt: 6, kana: 0 }
      const aLevel = inferDeckLevel(a) ?? ''
      const bLevel = inferDeckLevel(b) ?? ''
      const ai = order[aLevel] ?? 99
      const bi = order[bLevel] ?? 99
      if (ai !== bi) return ai - bi
      return displayNameOf(a).localeCompare(displayNameOf(b))
    }
  }
}

function truncate(name: string, max: number): string {
  if (name.length <= max) return name
  return name.slice(0, max - 1).trimEnd() + '…'
}
