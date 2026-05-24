'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ApiDeck } from '@fsrs-japanese/shared-types'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarActions } from '@/app/(app)/_components/top-bar-actions'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { Button } from '@/components/ui/Button'
import { EmptyState as EmptyStatePanel } from '@/components/ui/EmptyState'
import { Toast, useToast } from '@/components/ui/Toast'
import { IconPlus } from '@/components/icons/chrome-marks'
import { deleteDeckAction, listDecksAction } from '@/lib/actions/decks.actions'
import { useCopyDeck } from '@/lib/api/decks'
import { queryKeys } from '@/lib/api/queryKeys'
import { inferDeckLevel } from '@/lib/deck-level'

import { BulkDeleteDecksDialog } from './bulk-delete-decks-dialog'
import { CreateDeckDialog } from './create-deck-dialog'
import { DeckCard } from './deck-card'
import { PageLoader } from '@/components/ui/TomoLoader'
import {
  DeleteDeckDialog,
  EditDeckOptionsDialog,
  RenameDeckDialog,
} from './deck-dialogs'
import { DecksCurateBar } from './decks-curate-bar'
import { DecksHeader, type HeaderVariant } from './decks-header'
import { DecksPagination, type DecksPageSize } from './decks-pagination'
import { DecksTabs } from './decks-tabs'
import { DecksUtilityRow } from './decks-utility-row'
import { MatureExplainer } from './mature-explainer'
import { useDeckStatsMap } from './use-deck-stats-map'
import {
  useArchiveSet,
  useLocalNameOverrides,
  useStudyOrder,
  useViewPrefs,
  type DecksSortKey,
} from './use-deck-prefs'

import { useDecksDevState } from '@/dev/panels/decks'

// Default page size on first load. Users can pick from
// DECKS_PAGE_SIZE_OPTIONS via the per-page selector in the footer.
const DEFAULT_DECKS_PAGE_SIZE: DecksPageSize = 12

type ActiveDialog =
  | { kind: 'none' }
  | { kind: 'rename'; deck: ApiDeck }
  | { kind: 'delete'; deck: ApiDeck }
  | { kind: 'edit';   deck: ApiDeck }
  | { kind: 'create' }
  | { kind: 'bulk-delete' }

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
  const dev = useDecksDevState()
  const { data, isLoading: queryLoading, isError: queryError } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
  })
  const isError   = dev.forcedState === 'error'   ? true : queryError
  const allDecks: ApiDeck[] = useMemo(
    () => dev.forcedState === 'empty' ? [] : (data?.items ?? []),
    [data, dev.forcedState],
  )

  const knownIds = useMemo(() => allDecks.map((d) => d.id), [allDecks])

  // Subscribe to per-deck stats. The `combine` option inside the hook
  // produces stable `Map` references so the memos below don't churn
  // every render. Shares cache with each DeckCard's own useQuery.
  const { dueByDeckId, matureByDeckId, pending: detailsPending } = useDeckStatsMap(allDecks)
  const isLoading = dev.forcedState === 'loading' ? true : (queryLoading || detailsPending)

  function isFullyMature(deckId: string): boolean {
    const m = matureByDeckId.get(deckId)
    if (m === undefined) return false
    return m.total > 0 && m.mature >= m.total
  }

  // ── Persistent state ──────────────────────────────────────────────────
  // View prefs + study order still live in localStorage (no backend
  // representation yet). Archive state migrated to the server in 2026-05-19;
  // `useArchiveSet` is now a thin wrapper around `useDecks` + the
  // archive/unarchive mutations.
  const { prefs, setSort, setTypeFilter, setView } = useViewPrefs()
  const studyOrder = useStudyOrder(knownIds)
  const archiveSet = useArchiveSet()
  const nameOverrides = useLocalNameOverrides()

  const copyMutation = useCopyDeck()

  // ── Local UI state ────────────────────────────────────────────────────
  const [searchInputValue, setSearchInputValue] = useState('')
  const [searchQuery,      setSearchQuery]      = useState('')
  const [page,             setPage]             = useState(1)
  const [pageSize,         setPageSize]         = useState<DecksPageSize>(DEFAULT_DECKS_PAGE_SIZE)
  const [curateMode,       setCurateMode]       = useState(false)
  const [selectedIds,      setSelectedIds]      = useState<ReadonlySet<string>>(new Set())
  const [dragState,        setDragState]        = useState<DragState | null>(null)
  const [activeDialog,     setActiveDialog]     = useState<ActiveDialog>({ kind: 'none' })
  const [liveMessage,      setLiveMessage]      = useState('')
  const { toast, showToast, dismissToast } = useToast()

  // Polite announcer for ordering changes (pointer-drag, kebab move-up/down,
  // bulk move-to-top). Appending a zero-width space when the message repeats
  // forces SRs to re-announce identical text on consecutive moves.
  const announceOrder = useCallback((message: string) => {
    setLiveMessage((prev) => (prev === message ? `${message}​` : message))
  }, [])

  // Announce the new position of `deckId` against the resolved study order
  // *after* it's been mutated. Caller passes the post-mutation order so the
  // index reflects the user-visible state.
  const announceMove = useCallback(
    (deckId: string, deckName: string, postOrder: ReadonlyArray<string>) => {
      const idx = postOrder.indexOf(deckId)
      if (idx === -1) return
      announceOrder(`Moved ${deckName} to position ${idx + 1} of ${postOrder.length}.`)
    },
    [announceOrder],
  )

  const utilityRowRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const id = window.setTimeout(() => setSearchQuery(searchInputValue.trim()), 180)
    return () => window.clearTimeout(id)
  }, [searchInputValue])

  useEffect(() => { setPage(1) }, [prefs.sort, prefs.typeFilter, prefs.view, searchQuery, pageSize])

  // ── Derived data ──────────────────────────────────────────────────────

  const slotByDeckId = useMemo(() => {
    const map = new Map<string, number>()
    let slot = 1
    for (const deckId of studyOrder.resolvedOrder) {
      if (archiveSet.isArchived(deckId)) continue
      map.set(deckId, slot++)
    }
    return map
  }, [studyOrder.resolvedOrder, archiveSet])

  const displayNameOf = useCallback(
    (deck: ApiDeck) => nameOverrides.nameFor(deck.id, deck.name),
    [nameOverrides],
  )

  const filteredDecks: ApiDeck[] = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return allDecks.filter((deck) => {
      const archived = archiveSet.isArchived(deck.id)
      // Tab filter: Active = non-archived; Mature = non-archived AND fully mature;
      // Archived = archived only. Mature is a sub-filter on Active.
      switch (prefs.view) {
        case 'active':
          if (archived) return false
          break
        case 'mature':
          if (archived) return false
          if (!isFullyMature(deck.id)) return false
          break
        case 'archived':
          if (!archived) return false
          break
      }
      if (prefs.typeFilter !== 'all' && deck.deckType !== prefs.typeFilter) return false
      if (q.length > 0) {
        const haystack = `${displayNameOf(deck)} ${deck.description ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [allDecks, prefs.typeFilter, prefs.view, searchQuery, archiveSet, displayNameOf, matureByDeckId])

  const sortedDecks: ApiDeck[] = useMemo(() => {
    const list = [...filteredDecks]
    list.sort((a, b) => compareDecks(a, b, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf))
    return list
  }, [filteredDecks, prefs.sort, slotByDeckId, dueByDeckId, displayNameOf])

  const totalCount = sortedDecks.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safePage   = Math.min(page, totalPages)
  const pageStart  = (safePage - 1) * pageSize
  const pageEnd    = Math.min(pageStart + pageSize, totalCount)
  const visibleDecks = useMemo(() => sortedDecks.slice(pageStart, pageEnd), [sortedDecks, pageStart, pageEnd])

  // Drag-to-reorder is enabled in study-order sort on the active-decks view.
  // Reordering only makes sense while looking at the live study queue — not
  // when viewing the mature or archived subsets.
  const canReorder = prefs.sort === 'study-order' && prefs.view === 'active'

  const archivedCount = useMemo(
    () => allDecks.filter((d) => archiveSet.isArchived(d.id)).length,
    [allDecks, archiveSet],
  )
  const activeCount = allDecks.length - archivedCount

  // Mature-tab population: non-archived decks at 100% mature. Hidden from the
  // count until stats arrive — same behavior as the filter itself.
  const matureTabCount = useMemo(() => {
    let n = 0
    allDecks.forEach((d) => {
      if (archiveSet.isArchived(d.id)) return
      if (isFullyMature(d.id)) n += 1
    })
    return n
  }, [allDecks, archiveSet, matureByDeckId])

  // Roll up due workload across all active decks for the header status line.
  const { totalDueCount, decksWithDueCount } = useMemo(() => {
    let total = 0
    let decks = 0
    allDecks.forEach((d) => {
      if (archiveSet.isArchived(d.id)) return
      const due = dueByDeckId.get(d.id) ?? 0
      if (due > 0) decks += 1
      total += due
    })
    return { totalDueCount: total, decksWithDueCount: decks }
  }, [allDecks, archiveSet, dueByDeckId])

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
    return {
      kind: 'default',
      activeCount,
      archivedCount,
      priorityDeckName,
      totalDueCount,
      decksWithDueCount,
    }
  }, [isLoading, isError, allDecks.length, searchQuery, totalCount, activeCount, archivedCount, priorityDeckName, totalDueCount, decksWithDueCount])

  // ── Drag-to-reorder pointer state machine ─────────────────────────────
  const handleDragHandleDown = useCallback(
    (deckId: string, viewIndex: number) =>
      (event: React.PointerEvent<HTMLButtonElement>) => {
        if (!canReorder) return
        event.preventDefault()
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

    // Snapshot row centerlines once at drag start. Recompute on scroll
    // and resize while the drag is active. Doing this work per pointermove
    // (querySelectorAll + N × getBoundingClientRect) was the page's hottest
    // path on long lists; the per-move work is now a numeric scan.
    let midpoints: number[] = []
    function snapshot(): void {
      const els = document.querySelectorAll<HTMLElement>('[data-deck-id]')
      midpoints = new Array(els.length)
      for (let i = 0; i < els.length; i++) {
        const el = els[i]
        if (el === undefined) continue
        const rect = el.getBoundingClientRect()
        midpoints[i] = rect.top + rect.height / 2
      }
    }
    snapshot()

    // Coalesce pointermove into a single rAF tick so we never do more work
    // than the display can paint. Latest clientY wins.
    let pending = false
    let latestY = dragState.pointerY
    function onMove(event: PointerEvent): void {
      latestY = event.clientY
      if (pending) return
      pending = true
      requestAnimationFrame(() => {
        pending = false
        let bestIndex = 0
        let bestDistance = Infinity
        for (let i = 0; i < midpoints.length; i++) {
          const mid = midpoints[i]
          if (mid === undefined) continue
          const distance = Math.abs(latestY - mid)
          if (distance < bestDistance) {
            bestDistance = distance
            bestIndex = i
          }
        }
        setDragState((prev) => (prev === null ? null : { ...prev, overIndex: bestIndex, pointerY: latestY }))
      })
    }

    function onUp(): void {
      setDragState((prev) => {
        if (prev === null) return null
        if (prev.overIndex === null || prev.overIndex === prev.draggedIndex) return null
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
          announceMove(fromVisible.id, displayNameOf(fromVisible), order)
        }
        return null
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    window.addEventListener('scroll', snapshot, { passive: true })
    window.addEventListener('resize', snapshot)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      window.removeEventListener('scroll', snapshot)
      window.removeEventListener('resize', snapshot)
    }
  }, [dragState, visibleDecks, studyOrder, announceMove, displayNameOf])

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
    // Capture priority status BEFORE mutating; archive demotes the priority
    // deck silently, so the toast carries the warning instead of a modal.
    const wasPriority = deckId === priorityDeckId
    archiveSet.archive(deckId)
    const suffix = wasPriority ? ' (your priority deck)' : ''
    showToast(
      `Archived "${truncate(deckName, 28)}"${suffix}.`,
      'info',
      { label: 'Undo', onClick: () => archiveSet.restore(deckId) },
    )
  }

  function handleRestore(deckId: string, deckName: string): void {
    archiveSet.restore(deckId)
    showToast(
      `Restored "${truncate(deckName, 28)}".`,
      'info',
      { label: 'Undo', onClick: () => archiveSet.archive(deckId) },
    )
  }

  function handleCopy(deckId: string, deckName: string): void {
    copyMutation.mutate(deckId, {
      onSuccess: () => {
        showToast(`Copied "${truncate(deckName, 28)}".`)
      },
      onError: (err) => {
        showToast(err.message || `Couldn't copy "${truncate(deckName, 28)}".`, 'error')
      },
    })
  }

  function handleBulkArchive(): void {
    const ids = [...selectedIds]
    // Capture priority inclusion BEFORE mutating; mirrors the single-row
    // archive flow so power users get the same safety net (warning copy
    // + Undo) when curate-mode bulk-archive happens to include slot 01.
    const includesPriority = priorityDeckId !== null && ids.includes(priorityDeckId)
    archiveSet.archiveMany(ids)
    const suffix = includesPriority ? ' (including your priority deck)' : ''
    showToast(
      `Archived ${ids.length} deck${ids.length === 1 ? '' : 's'}${suffix}.`,
      'info',
      { label: 'Undo', onClick: () => { for (const id of ids) archiveSet.restore(id) } },
    )
    setCurateMode(false)
  }

  function handleBulkCopy(): void {
    const ids = [...selectedIds]
    setCurateMode(false)
    void Promise.allSettled(
      ids.map((id) => copyMutation.mutateAsync(id)),
    ).then((results) => {
      const failures = results.filter((r) => r.status === 'rejected').length
      if (failures === 0) {
        showToast(`Copied ${ids.length} deck${ids.length === 1 ? '' : 's'}.`)
      } else if (failures === ids.length) {
        showToast(`Couldn't copy ${ids.length} deck${ids.length === 1 ? '' : 's'}.`, 'error')
      } else {
        showToast(`Copied ${ids.length - failures}. ${failures} failed.`, 'error')
      }
    })
  }

  function handleBulkDelete(): void {
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
    announceOrder(`Moved ${ids.length} deck${ids.length === 1 ? '' : 's'} to the top of the study order.`)
    setCurateMode(false)
  }

  function handleMoveUp(deck: ApiDeck): void {
    studyOrder.moveUp(deck.id)
    const order = [...studyOrder.resolvedOrder]
    const idx = order.indexOf(deck.id)
    if (idx > 0) {
      const above = order[idx - 1]
      if (above !== undefined) { order[idx - 1] = deck.id; order[idx] = above }
    }
    announceMove(deck.id, displayNameOf(deck), order)
  }

  function handleMoveDown(deck: ApiDeck): void {
    studyOrder.moveDown(deck.id)
    const order = [...studyOrder.resolvedOrder]
    const idx = order.indexOf(deck.id)
    if (idx >= 0 && idx < order.length - 1) {
      const below = order[idx + 1]
      if (below !== undefined) { order[idx + 1] = deck.id; order[idx] = below }
    }
    announceMove(deck.id, displayNameOf(deck), order)
  }

  // ── Render ────────────────────────────────────────────────────────────

  const showCurateMode = curateMode && allDecks.length > 0

  if (isLoading) {
    return (
      <>
        <TopBar>
          <TopBarTitle kanji="束" label="Decks" />
        </TopBar>
        <PageLoader />
      </>
    )
  }

  return (
    <>
      <TopBar>
        <TopBarTitle kanji="束" label="Decks" />
        <TopBarActions>
          <Link
            href="/decks/premade"
            className="ui-motion-colors hidden h-8 items-center rounded-xs px-3 font-mono text-xs text-faded-sumi hover:text-sumi-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2 sm:inline-flex"
          >
            Browse premade
          </Link>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setActiveDialog({ kind: 'create' })}
            leadingIcon={<IconPlus className="h-3.5 w-3.5" />}
          >
            New deck
          </Button>
        </TopBarActions>
      </TopBar>

      <div
        className={[
          'ui-motion-colors min-h-screen pb-32',
          showCurateMode ? 'bg-cool-paper-shade' : 'bg-cool-paper-base',
        ].join(' ')}
      >
        <div className="relative mx-auto max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16">
          <DecksHeader variant={headerVariant} />

          {/* Top-level tabs and curate bar. Hidden in the empty state because
              there's nothing to sort, filter, or page through yet. */}
          {!(headerVariant.kind === 'empty') && (
            <>
              <div className="relative mt-4">
                <DecksTabs
                  view={prefs.view}
                  counts={{ active: activeCount, mature: matureTabCount, archived: archivedCount }}
                  panelId="decks-list-panel"
                  onChange={setView}
                />
                {/* First-visit teach for the Mature concept. Self-gated by
                    localStorage; renders nothing after the user dismisses. */}
                <MatureExplainer />
              </div>
              <section ref={(node) => { utilityRowRef.current = node }}>
                <DecksUtilityRow
                  sort={prefs.sort}
                  typeFilter={prefs.typeFilter}
                  searchQuery={searchInputValue}
                  curateActive={curateMode}
                  onSort={setSort}
                  onTypeFilter={setTypeFilter}
                  onSearchQuery={setSearchInputValue}
                  onCurate={() => setCurateMode((v) => !v)}
                />
              </section>
            </>
          )}

          {/* Deck list. `flex flex-col gap-y-3` (12px) was previously `flex flex-col gap-y-2`
              (8px) — the tighter spacing read as cramped against the
              richer DeckCard chrome (title, kanji eyebrow, progress
              bar, stats row). 12px lets each card breathe without
              breaking the list's visual cohesion. */}
          <section
            id="decks-list-panel"
            role="tabpanel"
            aria-label="Deck list"
            aria-labelledby={`decks-tab-${prefs.view}`}
            tabIndex={0}
            className="mt-3 flex flex-col gap-y-3 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-4"
          >
            {/* Polite announcer for reorder commits (pointer-drag, kebab
                Move up / Move down, bulk Move to top). Hidden visually,
                spoken by SRs. */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {liveMessage}
            </p>

            {!isLoading && isError && (
              <ErrorState
                onRetry={() => {
                  void queryClient.invalidateQueries({ queryKey: queryKeys.decks.all() })
                }}
              />
            )}

            {!isLoading && !isError && allDecks.length === 0 && (
              <EmptyState onCreate={() => setActiveDialog({ kind: 'create' })} />
            )}

            {!isLoading && !isError && allDecks.length > 0 && visibleDecks.length === 0 && (
              <NoMatchesState
                query={searchQuery}
                view={prefs.view}
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
                  dragEnabled={canReorder && !isArchived}
                  isDragging={isDragging}
                  isDropTarget={isDropTarget}
                  canMoveUp={!isArchived && orderIndex > 0}
                  canMoveDown={!isArchived && orderIndex >= 0 && orderIndex < studyOrder.resolvedOrder.length - 1}
                  onToggleSelect={() => toggleSelected(deck.id)}
                  onSetAsPriority={() => handleSetAsPriority(deck.id, displayNameOf(deck))}
                  onRename={() => setActiveDialog({ kind: 'rename', deck })}
                  onCopy={() => handleCopy(deck.id, displayNameOf(deck))}
                  onEditOptions={() => setActiveDialog({ kind: 'edit', deck })}
                  onArchive={() => handleArchive(deck.id, displayNameOf(deck))}
                  onRestore={() => handleRestore(deck.id, displayNameOf(deck))}
                  onDelete={() => setActiveDialog({ kind: 'delete', deck })}
                  onMoveUp={() => handleMoveUp(deck)}
                  onMoveDown={() => handleMoveDown(deck)}
                  onDragHandleDown={handleDragHandleDown(deck.id, viewIndex)}
                />
              )
            })}
          </section>

          {!isLoading && !isError && visibleDecks.length > 0 && (
            <DecksPagination
              page={safePage}
              pageSize={pageSize}
              totalCount={totalCount}
              scrollTargetEl={utilityRowRef as React.RefObject<HTMLElement | null>}
              onPickPage={setPage}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
              onPageSizeChange={setPageSize}
            />
          )}

        </div>

        {/* Curate bar lives inside the outer content wrapper so its
            sticky-bottom positioning is constrained to the main column
            width (i.e., viewport minus the desktop sidebar). Was a
            viewport-fixed overlay before, which spanned under the
            sidebar. Background tone of the wrapper is intentionally
            left alone per the request. */}
        {showCurateMode && (
          <DecksCurateBar
            selectedCount={selectedIds.size}
            totalCount={allDecks.length}
            canReorder={canReorder}
            onDone={() => setCurateMode(false)}
            onMoveToTop={handleBulkMoveToTop}
            onArchive={handleBulkArchive}
            onCopy={handleBulkCopy}
            onDelete={() => setActiveDialog({ kind: 'bulk-delete' })}
          />
        )}
      </div>

      <CreateDeckDialog
        open={activeDialog.kind === 'create'}
        onClose={() => setActiveDialog({ kind: 'none' })}
      />

      <BulkDeleteDecksDialog
        open={activeDialog.kind === 'bulk-delete'}
        selectedCount={selectedIds.size}
        onClose={() => setActiveDialog({ kind: 'none' })}
        onConfirm={() => handleBulkDelete()}
      />

      <RenameDeckDialog
        open={activeDialog.kind === 'rename'}
        deck={activeDialog.kind === 'rename' ? activeDialog.deck : null}
        currentName={activeDialog.kind === 'rename' ? displayNameOf(activeDialog.deck) : ''}
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

      {toast !== null && (
        <Toast
          key={toast.key}
          message={toast.message}
          kind={toast.kind}
          onDismiss={dismissToast}
          // 5s window when there's an Undo affordance, otherwise the
          // Toast component's default (3.2s for info, persist for error).
          {...(toast.action !== undefined ? { action: toast.action, durationMs: 5000 } : {})}
        />
      )}
    </>
  )
}

// ── Sub-views ────────────────────────────────────────────────────────────

function EmptyState({ onCreate }: { onCreate: () => void }): React.JSX.Element {
  return (
    <EmptyStatePanel kanji="空" title="Your library is empty." className="mt-10">
      <p className="max-w-measure-tight text-sm text-faded-sumi">
        A few minutes a day adds up. Start with a premade deck if you're not sure where to begin.
      </p>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
        <Button size="md" onClick={onCreate}>Build my own deck</Button>
        <Link href="/decks/premade" className="inline-flex">
          <Button size="md" variant="secondary" className="w-full sm:w-auto">
            Browse premade decks
          </Button>
        </Link>
      </div>
    </EmptyStatePanel>
  )
}

function NoMatchesState({
  query,
  view,
  typeFilter,
}: {
  query:      string
  view:       'active' | 'mature' | 'archived'
  typeFilter: string
}): React.JSX.Element {
  let body: React.ReactNode
  if (query.length > 0) {
    body = (
      <>
        No decks match <span className="text-sumi-ink/85">'{query}'</span>. Try a different term.
      </>
    )
  } else if (view === 'archived') {
    body = 'No archived decks yet. Archive a deck from its options menu to hide it from the queue.'
  } else if (view === 'mature') {
    body = 'No fully-mature decks yet. A deck becomes mature once every card has reached a 21-day interval.'
  } else if (typeFilter !== 'all') {
    body = `No ${typeFilter} decks. Adjust the Type filter to see more.`
  } else {
    body = 'No decks in this view.'
  }

  // Kanji eyebrow gives the empty state the same brand vocabulary the
  // cards page uses (空 for filtered-zero, 始 for first-run). 棚 ("tana",
  // shelf) is the natural kanji for "decks" — it's literally the noun
  // for the rack/shelf objects of the same shape. Keeps the visual
  // dialect consistent between sibling pages.
  return (
    <div className="mt-2 rounded-xs border border-soft-hairline bg-cream-inset/45 p-6 text-center">
      <span
        lang="ja"
        aria-hidden="true"
        className="font-display text-numeral leading-none text-inari-vermillion/75"
      >
        棚
      </span>
      <h2 className="mt-3 text-sm font-normal text-faded-sumi">{body}</h2>
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div className="mt-2 rounded-xs border border-soft-hairline bg-cream-inset/55 p-6 text-center">
      <h2 className="text-sm font-medium text-sumi-ink">Couldn't load your decks.</h2>
      <p className="mt-1 text-sm text-faded-sumi">
        The library tried to read from the server and didn't get a reply. Try again in a moment.
      </p>
      <div className="mt-4">
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function compareDecks(
  a:              ApiDeck,
  b:              ApiDeck,
  sort:           DecksSortKey,
  slotById:       ReadonlyMap<string, number>,
  dueById:        ReadonlyMap<string, number>,
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
