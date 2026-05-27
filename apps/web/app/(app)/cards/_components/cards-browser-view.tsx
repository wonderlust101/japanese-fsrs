'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { PageHeader, PAGE_HEADER_PADDING } from '@/components/ui/PageHeader'
import { Toast, useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ModuleError } from '@/components/ui/ModuleError'
import { PageLoader } from '@/components/ui/TomoLoader'
import { queryKeys } from '@/lib/api/queryKeys'
import { listDecksAction } from '@/lib/actions/decks.actions'
import {
  useBulkDeleteCardsMutation,
  useBulkMoveCardsMutation,
  useBulkSuspendCardsMutation,
  useCardQualityIssuesQuery,
  useCardsCrossDeckQuery,
  useCopyCardMutation,
  useDeleteCardMutation,
  useMoveCardMutation,
} from '@/lib/api/cards'
import type { CrossDeckCardsActionOptions } from '@/lib/actions/cards.actions'
import {
  getWordFields,
  type ApiCardListItem,
  type ApiCrossDeckCardListItem,
} from '@fsrs-japanese/shared-types'

import { CardsToolbar, type DeckOption } from './cards-toolbar'
import { CardsActiveChips } from './cards-active-chips'
import { CardsCountLine } from './cards-count-line'
import { CardsFilterSheet } from './cards-filter-sheet'
import {
  DEFAULT_FILTER_STATE,
  chipsFromState,
  effectiveSortDir,
  hasAnyFilter,
  mergeViewRecipe,
  naturalSortDirFor,
  parseFiltersFromURL,
  serializeFiltersToURL,
  stateMatchesRecipe,
  type CardsFilterState,
} from './cards-filter-state'
import {
  findViewById,
  useSavedViewPersistence,
} from './saved-views-storage'
import type { CardQualityIssue, CardQualityIssueKind } from './cards-quality-data'
import { CardsBulkBar } from './cards-bulk-bar'
import { MoveCardDialog } from '@/app/(app)/decks/[id]/_components/move-card-dialog'
import {
  CardsResultsTable,
  type CardsResultRow,
  type CardRowAction,
} from './cards-results-table'
import { CardsPagination, type CardsPageSize } from './cards-pagination'
import { useCardsDevState } from '@/dev/panels/cards'

const DEFAULT_PAGE_SIZE: CardsPageSize = 25

export function CardsBrowserView(): React.JSX.Element {
  const router       = useRouter()
  const searchParams = useSearchParams()

  // ── URL-canonical filter state. ──────────────────────────────────────
  // The URL is the single source of truth. Filter state is DERIVED from
  // `searchParams` via useMemo, not stored in a separate React state.
  // Previously we kept both a local useState and a useEffect that
  // re-parsed from URL on change — that pattern raced with
  // `router.replace()` and caused symptoms like "sort dropdown changes
  // visually but table doesn't refetch until you reload." With a single
  // source, the chain is: user picks sort → router.replace → searchParams
  // updates → useMemo recomputes → queryOpts recomputes → TanStack
  // refetches. No race, no dual write.
  const state = useMemo<CardsFilterState>(
    () => parseFiltersFromURL((k) => searchParams.get(k)),
    [searchParams],
  )

  // Persist last-picked view id so a cold visit lands on the user's
  // preferred starting point when the URL is otherwise clean.
  const { remember: rememberView, lastActiveId } = useSavedViewPersistence()
  const hydratedOnceRef = useRef(false)
  useEffect(() => {
    if (hydratedOnceRef.current) return
    hydratedOnceRef.current = true
    if (state.viewId !== null) return
    if (lastActiveId === null) return
    if (hasAnyFilter(state)) return       // user already filtered via URL
    const view = findViewById(lastActiveId)
    if (view === undefined) return
    // Push the persisted view into the URL on hydration so the URL
    // remains the canonical state source. Avoids the previous
    // setState-based approach which fought the URL-derived state.
    const next = mergeViewRecipe({ ...state, viewId: view.id }, view.recipe)
    const params = serializeFiltersToURL(next)
    const qs = params.toString()
    router.replace(qs.length > 0 ? `/cards?${qs}` : '/cards', { scroll: false })
  }, [lastActiveId, state, router])

  const updateState = useCallback((next: CardsFilterState) => {
    // Auto-reset to page 1 whenever any field OTHER than `page`
    // changed. Filter children (toolbar pickers, chip editors) call
    // updateState with `{ ...state, jlpt: 'N3' }` patterns and would
    // otherwise keep the user pinned on a stale page index that
    // doesn't make sense against the new result set. Page-navigation
    // handlers (handlePrev/Next/PickPage) explicitly change ONLY
    // `page` and pass through unchanged.
    const onlyPageChanged =
      next.search       === state.search       &&
      next.deckId       === state.deckId       &&
      next.jlpt         === state.jlpt         &&
      next.status       === state.status       &&
      next.sort         === state.sort         &&
      next.sortDir      === state.sortDir      &&
      next.viewId       === state.viewId       &&
      next.missingField === state.missingField &&
      next.presentField === state.presentField &&
      next.pitchPattern === state.pitchPattern
    const finalNext: CardsFilterState = onlyPageChanged ? next : { ...next, page: 1 }
    // Update via the URL — searchParams change triggers the useMemo
    // above, which re-derives `state`. No local React state to keep
    // in sync separately. Single source of truth.
    const params = serializeFiltersToURL(finalNext)
    const qs = params.toString()
    router.replace(qs.length > 0 ? `/cards?${qs}` : '/cards', { scroll: false })
  }, [state, router])

  const handleSearchChange = useCallback((nextSearch: string) => {
    updateState({ ...state, search: nextSearch })
  }, [state, updateState])

  const handlePickView = useCallback((nextViewId: string | null) => {
    const view = findViewById(nextViewId)
    rememberView(nextViewId)
    if (view === undefined) {
      updateState({ ...DEFAULT_FILTER_STATE })
      return
    }
    // Picking a view resets all dimensions to the view's defaults so
    // moving between views feels like a clean transition rather than
    // accreting filters across them. Search is preserved if the user
    // already typed something on the previous view.
    const seed: CardsFilterState = {
      ...DEFAULT_FILTER_STATE,
      search: state.search,
      viewId: view.id,
    }
    updateState(mergeViewRecipe(seed, view.recipe))
  }, [state.search, updateState, rememberView])

  const handleClearAll = useCallback(() => {
    rememberView(null)
    updateState({ ...DEFAULT_FILTER_STATE })
  }, [updateState, rememberView])

  // ── Pagination + selection state. ────────────────────────────────────
  // `state.page` is the source of truth for the current page (lives in
  // URL via cards-filter-state). The cursor stack is gone since the
  // backend switched to offset pagination in 20260630000003.
  const [pageSize,  setPageSize]  = useState<CardsPageSize>(DEFAULT_PAGE_SIZE)
  const [selected,  setSelected]  = useState<ReadonlySet<string>>(() => new Set())
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const pageIndex = state.page - 1  // 0-indexed internal use only
  // Add-filter popover state lives here (lifted from CardsToolbar) so a
  // page-level F-keybinding can open the menu without prop-drilling a
  // ref through the toolbar.
  const [addFilterOpen, setAddFilterOpen] = useState(false)
  // View dropdown imperative open. The DecksMenu primitive that wraps
  // the View chip already manages its own open state, but we expose a
  // setter via a small synthetic ref so V can route a click. The
  // simplest portable approach: a ref to a hidden button-shaped trigger
  // exposed by CardsViewDropdown.
  const viewTriggerClickRef = useRef<(() => void) | null>(null)

  // ── Cards-page keyboard shortcuts (F: add filter, V: view picker).
  // Guard against inputs so typing 'f' or 'v' inside the search field
  // doesn't trip the shortcut. The HelpDialog at apps/web/components/
  // help/HelpDialog.tsx documents these bindings.
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      // Ignore modified keys (Cmd-F should still trigger browser find).
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const active = document.activeElement
      if (active instanceof HTMLElement) {
        const tag = active.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (active.isContentEditable) return
      }
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setAddFilterOpen(true)
        return
      }
      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        viewTriggerClickRef.current?.()
        return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const { toast, showToast, dismissToast } = useToast()

  // ── Decks list (for the deck filter picker). ─────────────────────────
  const { data: decksList } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
  })
  const liveDecks: ReadonlyArray<DeckOption> = useMemo(
    () => (decksList?.items ?? []).map((d) => ({ id: d.id, name: d.name })),
    [decksList],
  )

  // ── Dev panel + fixture rows. ────────────────────────────────────────
  const devState = useCardsDevState()
  const usingFixture = devState.fixture !== 'off'
  const decks: ReadonlyArray<DeckOption> = usingFixture ? devState.decks : liveDecks

  // ── Cross-deck list query options derived from URL state. ────────────
  const queryOpts = useMemo<CrossDeckCardsActionOptions>(() => {
    const opts: CrossDeckCardsActionOptions = {
      limit: pageSize,
      sort:  state.sort,
      // sortDir omitted when null (means "natural default for this
      // axis"); the action layer skips the URL param too so the
      // backend uses its per-axis default.
      ...(state.sortDir !== null ? { sortDir: state.sortDir } : {}),
    }
    // Offset pagination (replaces the cursor stack as of 20260630000003).
    // `state.page` is 1-indexed; we translate to 0-based offset rows.
    const offset = pageIndex * pageSize
    if (offset > 0) opts.offset = offset
    if (state.search.trim().length > 0)     opts.search    = state.search.trim()
    if (state.deckId !== 'all')             opts.deckId    = state.deckId
    if (state.jlpt !== 'all')               opts.jlptLevel = state.jlpt as NonNullable<CrossDeckCardsActionOptions['jlptLevel']>
    if (state.status !== 'all')             opts.status    = state.status as NonNullable<CrossDeckCardsActionOptions['status']>
    if (state.missingField !== null)        opts.missingField = state.missingField
    if (state.presentField !== null)        opts.presentField = state.presentField
    if (state.pitchPattern !== null && state.presentField === 'pitch') {
      opts.pitchPattern = state.pitchPattern
    }
    return opts
  }, [state, pageSize, pageIndex])

  const liveQuery    = useCardsCrossDeckQuery(queryOpts)
  const qualityQuery = useCardQualityIssuesQuery()

  // ── Data sources: live or fixtures. ──────────────────────────────────
  const rows: ReadonlyArray<CardsResultRow> = useMemo(() => {
    if (usingFixture) {
      const start = pageIndex * pageSize
      return devState.rows.slice(start, start + pageSize)
    }
    const items = liveQuery.data?.items ?? []
    return items.map(toResultRow)
  }, [usingFixture, devState.rows, liveQuery.data, pageIndex, pageSize])

  const totalCount  = usingFixture ? devState.rows.length : (liveQuery.data?.totalCount ?? 0)
  // Cold boot only: no data has ever loaded. With `placeholderData:
  // keepPreviousData` on the underlying hook, this stays true only on
  // the very first paint. Subsequent refetches (filter, sort, search,
  // page change) keep the prior data on screen and flip `isFetching`,
  // not `isLoading`, so the toolbar/chrome stays interactive and the
  // table shows a row-level skeleton via `isPaginating`.
  const coldBoot     = usingFixture ? devState.loading : liveQuery.isLoading
  const tableLoading = coldBoot
  // Fixture mode has no asynchronous fetch, so it never paginates
  // visibly — the table just swaps. The fixture-paging timer that
  // used to simulate a network delay was removed alongside the cursor
  // stack since the live path now uses keepPreviousData for the same
  // visual continuity.
  const isPaginating = usingFixture
    ? false
    : (liveQuery.isFetching && !liveQuery.isLoading)

  // Clear selection whenever any filter or page-size change happens.
  // Page itself is intentionally NOT in the dep list — flipping pages
  // shouldn't drop the current selection on screen (selection is
  // tracked by id, not row position). State.page changes drop into
  // the selection-stability bucket.
  useEffect(() => {
    setSelected(new Set())
  }, [
    state.search, state.deckId, state.jlpt, state.status,
    state.missingField, state.presentField, state.pitchPattern,
    state.viewId, state.sort, state.sortDir, pageSize,
  ])

  // ── Quality issues — maps backend kinds to the view-count enum. ──────
  const qualityIssues: ReadonlyArray<CardQualityIssue> = useMemo(() => {
    if (qualityQuery.data === undefined) return []
    return qualityQuery.data.map((i) => ({
      kind:  i.issueType as CardQualityIssueKind,
      count: i.count,
    }))
  }, [qualityQuery.data])

  // ── Active-view "modified" indicator. ────────────────────────────────
  const activeView = findViewById(state.viewId)
  const activeViewModified = useMemo(() => {
    if (activeView === undefined) return false
    return !stateMatchesRecipe(state, activeView.recipe)
  }, [activeView, state])

  // ── Row action wiring (unchanged behavior). ──────────────────────────
  const deleteMutation     = useDeleteCardMutation()
  const moveMutation       = useMoveCardMutation()
  const copyMutation       = useCopyCardMutation()
  const bulkMoveMutation   = useBulkMoveCardsMutation()
  const bulkSuspendMutation = useBulkSuspendCardsMutation()
  const bulkDeleteMutation = useBulkDeleteCardsMutation()

  const [confirmDelete,  setConfirmDelete]  = useState<ApiCrossDeckCardListItem | null>(null)
  const [moveTarget,     setMoveTarget]     = useState<ApiCrossDeckCardListItem | null>(null)
  const [copyTarget,     setCopyTarget]     = useState<ApiCrossDeckCardListItem | null>(null)
  const [bulkMoveOpen,   setBulkMoveOpen]   = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const wireItemById = useCallback(
    (cardId: string): ApiCrossDeckCardListItem | undefined => {
      const items = liveQuery.data?.items
      if (items === undefined) return undefined
      return items.find((i) => i.id === cardId)
    },
    [liveQuery.data],
  )

  function handleRowAction(cardId: string, action: CardRowAction): void {
    const item = wireItemById(cardId)
    if (action === 'edit') {
      router.push(`/cards/${cardId}`)
      return
    }
    if (item === undefined) {
      showToast('Dev-fixture row: real actions require live data.', 'info')
      return
    }
    switch (action) {
      case 'add-copy': setCopyTarget(item);    return
      case 'move':     setMoveTarget(item);    return
      case 'delete':   setConfirmDelete(item); return
    }
  }

  function confirmRowDelete(): void {
    if (confirmDelete === null) return
    const card = confirmDelete
    const wf   = getWordFields(card)
    const label = wf?.word ?? 'card'
    deleteMutation.mutate(card.id, {
      onSuccess: () => {
        showToast(`Deleted ${label}.`, 'info')
        setConfirmDelete(null)
      },
      onError: () => showToast("Couldn't delete that card. Please try again.", 'error'),
    })
  }

  function handleMoveConfirm(card: ApiCardListItem, targetDeckId: string): void {
    moveMutation.mutate({ cardId: card.id, targetDeckId }, {
      onSuccess: () => {
        showToast('Card moved.', 'info')
        setMoveTarget(null)
      },
      onError: () => showToast("Couldn't move that card. Please try again.", 'error'),
    })
  }

  function handleCopyConfirm(card: ApiCardListItem, targetDeckId: string): void {
    copyMutation.mutate({ cardId: card.id, targetDeckId }, {
      onSuccess: () => {
        showToast('Copy added to the deck.', 'info')
        setCopyTarget(null)
      },
      onError: () => showToast("Couldn't copy that card. Please try again.", 'error'),
    })
  }

  // ── Selection helpers. ───────────────────────────────────────────────
  const visibleIds = useMemo(() => rows.map((r) => r.id), [rows])
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
      if (allChecked) {
        const next = new Set(prev)
        for (const id of visibleIds) next.delete(id)
        return next
      }
      const next = new Set(prev)
      for (const id of visibleIds) next.add(id)
      return next
    })
  }
  function clearSelection(): void { setSelected(new Set()) }

  // ── Bulk actions. ────────────────────────────────────────────────────
  function reportBulkResult(label: string, result: { succeeded: string[]; failed: { id: string; error: string }[] }): void {
    const succeeded = result.succeeded.length
    const failed    = result.failed.length
    if (failed === 0) {
      showToast(`${label}: ${succeeded} ${succeeded === 1 ? 'card' : 'cards'} updated.`, 'info')
    } else {
      showToast(`${label}: ${succeeded} updated, ${failed} failed.`, 'error')
    }
  }

  function handleBulkMoveConfirm(_card: ApiCardListItem, targetDeckId: string): void {
    const ids = [...selected]
    bulkMoveMutation.mutate({ ids, targetDeckId }, {
      onSuccess: (result) => {
        reportBulkResult('Move', result)
        clearSelection()
        setBulkMoveOpen(false)
      },
      onError: () => showToast("Couldn't move those cards. Please try again.", 'error'),
    })
  }

  function handleBulkSuspend(): void {
    const ids = [...selected]
    bulkSuspendMutation.mutate(ids, {
      onSuccess: (result) => { reportBulkResult('Suspend', result); clearSelection() },
      onError:   () => showToast("Couldn't suspend those cards. Please try again.", 'error'),
    })
  }

  function handleBulkDeleteConfirm(): void {
    const ids = [...selected]
    bulkDeleteMutation.mutate(ids, {
      onSuccess: (result) => {
        reportBulkResult('Delete', result)
        clearSelection()
        setBulkDeleteOpen(false)
      },
      onError: () => showToast("Couldn't delete those cards. Please try again.", 'error'),
    })
  }

  // ── Pagination handlers. ─────────────────────────────────────────────
  // All three handlers mutate `state.page` via `updateState`, which
  // pushes the new page into the URL. Bounds enforcement happens here
  // so the pagination component can call them naively.
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  function handlePickPage(nextPage: number): void {
    const clamped = Math.min(Math.max(1, Math.floor(nextPage)), totalPages)
    if (clamped === state.page) return
    updateState({ ...state, page: clamped })
  }
  function handlePrev(): void {
    if (state.page <= 1) return
    updateState({ ...state, page: state.page - 1 })
  }
  function handleNext(): void {
    if (state.page >= totalPages) return
    updateState({ ...state, page: state.page + 1 })
  }
  // Page size lives in local state, not the URL. Reset to page 1 on a size
  // change so a larger window can't strand the user on an offset past the new
  // last page (e.g. page 4 at 25/page lands beyond the data at 50/page). Page 1
  // is always valid, which also removes the need to clamp here.
  function handlePageSizeChange(nextSize: CardsPageSize): void {
    setPageSize(nextSize)
    if (state.page !== 1) updateState({ ...state, page: 1 })
  }

  // First-deck-id helper for the bulk Move dialog.
  const bulkMoveCurrentDeckId = useMemo(() => {
    const firstId = [...selected][0]
    if (firstId === undefined) return ''
    return rows.find((r) => r.id === firstId)?.deckId ?? ''
  }, [selected, rows])

  const chips           = chipsFromState(state)
  const filtersActive   = hasAnyFilter(state)
  const mobileChipCount = chips.length + (state.deckId !== 'all' ? 1 : 0)
  // First-run empty state. Distinct from "filters narrowed to zero":
  // brand-new users land here with literally no cards in any deck, and
  // need orientation, not a "no results" message.
  //
  // Two ways to enter this branch:
  //   1. Live mode with literally zero cards and no filters applied.
  //   2. The dev panel's `first-run` fixture, which explicitly tests
  //      this surface without needing a real account at totalCount=0.
  // Other fixtures (`few`, `many`, etc.) continue to render the table
  // chrome since QA review wants the table for that case.
  //
  // CRITICAL: live-mode also guards against `liveQuery.isFetching`.
  // A sort-direction toggle (or any state change that invalidates
  // pagination) briefly fires a query with the new opts but the
  // pre-reset cursor; that query can return zero rows transiently
  // before the pagination-reset effect re-fetches cleanly. Without
  // this guard, the empty state mistakenly flashes during that gap.
  const firstRunEmpty = usingFixture
    ? devState.simulateFirstRun
    : (totalCount === 0 && !filtersActive && !liveQuery.isFetching)

  // Cold-boot fetch failure: the list never loaded, so there is no prior data
  // to fall back on (keepPreviousData only retains a *previous* success). Show a
  // retryable error rather than the "No cards yet" empty state, which would
  // falsely claim the account has no cards. A refetch error *after* a success
  // leaves `data` defined, so this never blanks already-visible rows.
  if (!usingFixture && liveQuery.isError && liveQuery.data === undefined) {
    return (
      <>
        <TopBar>
          <TopBarTitle kanji="札" label="Cards" />
        </TopBar>
        <div className="mx-auto w-full max-w-[1440px] px-4 pt-6 md:px-12 lg:px-16">
          <ModuleError label="your cards" onRetry={() => void liveQuery.refetch()} />
        </div>
      </>
    )
  }

  if (coldBoot) {
    return (
      <>
        <TopBar>
          <TopBarTitle kanji="札" label="Cards" />
        </TopBar>
        <PageLoader />
      </>
    )
  }

  return (
    <>
      <TopBar>
        <TopBarTitle kanji="札" label="Cards" />
      </TopBar>

      {/* Outer wrapper is a flex column so the bulk bar always sits at
          the very bottom of the page regardless of content height.
          - On a short page (e.g. 22 cards), the inner content column
            takes flex-1 and grows to fill, pushing the bar to the
            viewport bottom.
          - On a long page, content overflows and the bar sticks to
            the viewport's bottom via `position: sticky bottom-0`.
          - At absolute end of scroll, the bar's natural position IS
            the viewport bottom (because there's no padding below it).
          The previous `pb-16` is gone for the same reason: dead space
          below the bar prevented it from staying pinned at full
          scroll. The inner content column keeps its own `pb-20` for
          spacing between the table and the bar. */}
      <div className="flex min-h-screen flex-col bg-cool-paper-base">
        <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-4 pb-20 md:px-12 lg:px-16">

          {/* ── Page header ───────────────────────────────────────── */}
          <div className={PAGE_HEADER_PADDING}>
            <PageHeader
              kanji="字"
              label="Cards"
              title="All cards"
              subtitle="Every card across every deck. Pick a view, refine with chips."
            />
          </div>

          {/* ── Toolbar (one row on desktop) ──────────────────────── */}
          <CardsToolbar
            state={state}
            decks={decks}
            qualityIssues={qualityIssues}
            activeViewModified={activeViewModified}
            onSearchChange={handleSearchChange}
            onStateChange={updateState}
            onPickView={handlePickView}
            addFilterOpen={addFilterOpen}
            onAddFilterOpenChange={setAddFilterOpen}
            viewTriggerRef={viewTriggerClickRef}
            onOpenMobileSheet={() => setMobileSheetOpen(true)}
            mobileChipCount={mobileChipCount}
          />

          {/* ── Active filter chips ─────────────────────────────────
              Desktop: full interactive chip strip (click body to edit,
              ✕ to remove). Wraps to multiple lines when needed.

              Mobile: separate horizontal-scroll rail with tap-to-remove
              only. Body taps do nothing; editing routes through the
              filter sheet. The two variants share the same component
              file so the chip projection logic stays single-sourced. */}
          {chips.length > 0 && (
            <>
              <div className="mt-3 hidden sm:block">
                <CardsActiveChips
                  state={state}
                  onChange={updateState}
                  onClearAll={handleClearAll}
                  variant="desktop"
                />
              </div>
              <div className="mt-3 sm:hidden">
                <CardsActiveChips
                  state={state}
                  onChange={updateState}
                  onClearAll={handleClearAll}
                  variant="mobile"
                />
              </div>
            </>
          )}

          {firstRunEmpty ? (
            <FirstRunEmptyState />
          ) : (
            <>
              {/* ── Result count + Sort dropdown ───────────────────────
                  Sort moved here from the toolbar's Row 2 because it isn't
                  a filter; pairing it with the count it actually affects
                  matches the Linear / Vercel pattern. The "Clear all"
                  affordance lives only inside the chip strip now to avoid
                  the duplicate-control noise the critique flagged. */}
              <div className="mt-4">
                <CardsCountLine
                  totalCount={totalCount}
                  sort={state.sort}
                  sortDir={state.sortDir}
                  // Changing the sort axis resets sortDir to the per-axis
                  // natural default (encoded as null) so the user doesn't
                  // get a confusing "I picked Sort by Due but it's still
                  // descending from when I had Lapses" state.
                  onPickSort={(sort) => updateState({ ...state, sort, sortDir: null })}
                  onToggleSortDir={() => {
                    const current = effectiveSortDir(state)
                    const flipped: 'asc' | 'desc' = current === 'asc' ? 'desc' : 'asc'
                    // If the toggle lands back on the natural default,
                    // clear sortDir (so the URL stays clean and the
                    // state shows "I haven't overridden anything").
                    const natural = naturalSortDirFor(state.sort)
                    updateState({
                      ...state,
                      sortDir: flipped === natural ? null : flipped,
                    })
                  }}
                  trailingNote={
                    filtersActive && chips.length === 0 && state.search.length > 0
                      ? (
                        <>
                          {' matching '}
                          <span className="text-sumi-ink">“{state.search}”</span>
                        </>
                      )
                      : undefined
                  }
                />
              </div>

              {/* ── Results ──────────────────────────────────────────── */}
              <div className="mt-3">
                <CardsResultsTable
                  rows={rows}
                  onRowAction={handleRowAction}
                  loading={tableLoading}
                  paginating={isPaginating}
                  selectedIds={selected}
                  onToggleSelection={toggleSelection}
                  onToggleAllVisible={toggleAllVisible}
                />
                {!tableLoading && totalCount > 0 && (
                  <CardsPagination
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPickPage={handlePickPage}
                    onPrev={handlePrev}
                    onNext={handleNext}
                    onPageSizeChange={handlePageSizeChange}
                    isPaginating={isPaginating}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Sticky bulk-actions bar. ─────────────────────────────────
            Rendered inside the main content column wrapper (not as a
            top-level sibling) so its `position: sticky` finds the
            correct scroll container and the bar's width matches the
            column. This is what keeps the bar from bleeding across
            the sidebar on desktop. */}
        {selected.size > 0 && (
          <CardsBulkBar
            selectedCount={selected.size}
            onMove={() => setBulkMoveOpen(true)}
            onSuspend={handleBulkSuspend}
            onDelete={() => setBulkDeleteOpen(true)}
            onClear={clearSelection}
          />
        )}
      </div>

      {/* ── Mobile filter sheet ──────────────────────────────────────── */}
      <CardsFilterSheet
        open={mobileSheetOpen}
        state={state}
        decks={decks}
        onChange={updateState}
        onClearAll={handleClearAll}
        onClose={() => setMobileSheetOpen(false)}
      />

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      <MoveCardDialog
        card={moveTarget}
        currentDeckId={moveTarget?.deckId ?? ''}
        variant="move"
        isSubmitting={moveMutation.isPending}
        errorMessage={moveMutation.error?.message ?? null}
        onCancel={() => setMoveTarget(null)}
        onConfirm={(card, targetDeckId) => handleMoveConfirm(card, targetDeckId)}
      />
      <MoveCardDialog
        card={copyTarget}
        currentDeckId={copyTarget?.deckId ?? ''}
        variant="add"
        isSubmitting={copyMutation.isPending}
        errorMessage={copyMutation.error?.message ?? null}
        onCancel={() => setCopyTarget(null)}
        onConfirm={(card, targetDeckId) => handleCopyConfirm(card, targetDeckId)}
      />

      <MoveCardDialog
        card={bulkMoveOpen ? bulkMoveSyntheticCard(selected.size) : null}
        currentDeckId={bulkMoveCurrentDeckId}
        variant="move"
        isSubmitting={bulkMoveMutation.isPending}
        errorMessage={bulkMoveMutation.error?.message ?? null}
        onCancel={() => setBulkMoveOpen(false)}
        onConfirm={handleBulkMoveConfirm}
      />

      <ConfirmDeleteDialog
        open={confirmDelete !== null}
        title="Delete this card?"
        description={confirmDelete !== null
          ? `Delete ${getWordFields(confirmDelete)?.word ?? 'this card'}? Its review history will be removed permanently.`
          : ''}
        isSubmitting={deleteMutation.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={confirmRowDelete}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selected.size} ${selected.size === 1 ? 'card' : 'cards'}?`}
        description="Their review history will be removed permanently. This action can't be undone."
        isSubmitting={bulkDeleteMutation.isPending}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
      />

      {toast !== null && (
        <Toast
          key={toast.key}
          message={toast.message}
          kind={toast.kind}
          onDismiss={dismissToast}
          offset="above-bar"
          maxWidth="max-w-[32rem]"
        />
      )}
    </>
  )
}

// ─── First-run empty state ──────────────────────────────────────────────

function FirstRunEmptyState(): React.JSX.Element {
  return (
    <EmptyState kanji="始" title="No cards yet" className="mt-10">
      <p className="max-w-measure-tight text-sm text-faded-sumi">
        Add your first card to start practicing across every deck.
      </p>
      {/* Vermillion CTA: the empty state is one of the few surfaces on /cards
          where Tomo's brand accent is justified on a large affordance. The
          page is otherwise restrained sumi-on-paper; the red reads as a
          deliberate "first step" without breaking the neutral surface budget. */}
      <ButtonLink href="/add" variant="primary" size="md">
        Add a card
      </ButtonLink>
    </EmptyState>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

function toResultRow(item: ApiCrossDeckCardListItem): CardsResultRow {
  const wf = getWordFields(item)
  return {
    id:           item.id,
    word:         wf?.word    ?? '—',
    reading:      wf?.reading ?? '',
    meaning:      wf?.meaning ?? '',
    deckId:       item.deckId,
    deckName:     item.deckName,
    jlptLevel:    item.jlptLevel,
    partOfSpeech: wf?.partOfSpeech ?? null,
    state:        item.state,
    isSuspended:  item.isSuspended,
    lapses:       item.lapses,
    due:          item.due,
  }
}

function bulkMoveSyntheticCard(count: number): ApiCardListItem {
  return {
    id:          'bulk',
    fieldsData:  { word: `${count} cards`, reading: '', meaning: '' },
    layoutType:  'vocabulary',
    jlptLevel:   null,
    state:       0 as ApiCardListItem['state'],
    isSuspended: false,
    due:         new Date().toISOString(),
  }
}

function ConfirmDeleteDialog({
  open, title, description, isSubmitting, onCancel, onConfirm,
}: {
  open:         boolean
  title:        string
  description:  string
  isSubmitting: boolean
  onCancel:     () => void
  onConfirm:    () => void
}): React.JSX.Element {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      eyebrow={{ kanji: '削', label: 'Confirm delete' }}
    >
      <p className="text-sm text-sumi-ink/85">{description}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        <Button variant="danger" onClick={onConfirm} loading={isSubmitting}>Delete</Button>
      </div>
    </Dialog>
  )
}
