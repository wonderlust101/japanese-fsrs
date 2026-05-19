'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// useCallback used by wireItemById
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast, useToast } from '@/components/ui/Toast'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
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
  type CardMissingField,
  type CardSortField,
  type PitchPattern,
} from '@fsrs-japanese/shared-types'

import { CardsSearchBar } from './cards-search-bar'
import { SavedViewPills } from './saved-view-pills'
import { useSavedViews } from './saved-views-storage'
import { CardsBulkBar } from './cards-bulk-bar'
import { MoveCardDialog } from '@/app/(app)/decks/[id]/_components/move-card-dialog'
import {
  CardsFilterRow,
  type CardsFilters,
  type DeckOption,
} from './cards-filter-row'
import {
  CardsResultsTable,
  type CardsResultRow,
  type CardRowAction,
} from './cards-results-table'
import { CardsPagination, type CardsPageSize } from './cards-pagination'
import { CardsQualityBars, type CardQualityIssue, type CardQualityIssueKind } from './cards-quality-bars'
import {
  MoreFiltersPopover,
  DEFAULT_MORE_FILTERS,
  countMoreFilters,
  type MoreFiltersValue,
} from './more-filters-popover'
import { useCardsDevState } from './cards-dev-panel'

const DEFAULT_FILTERS: CardsFilters = {
  deckId: 'all',
  jlpt:   'all',
  status: 'all',
}

const DEFAULT_PAGE_SIZE: CardsPageSize = 25

// URL `?missing=` accepts the bare field name (matches the quality-bar
// links — `ROUTE_BY_KIND` in cards-quality-bars.tsx). Migration 20260624
// added the 'pitch' and 'audio' tokens; the set is kept in sync here.
const MISSING_FIELDS: ReadonlySet<CardMissingField> = new Set([
  'reading', 'meaning', 'example', 'mnemonic', 'picture', 'nuance',
  'pitch', 'audio',
])

function parseMissingFromQuery(raw: string | null): CardMissingField | undefined {
  if (raw === null) return undefined
  return MISSING_FIELDS.has(raw as CardMissingField) ? (raw as CardMissingField) : undefined
}

// URL `?present=` and `?pitchPattern=` seed the More-filters popover on
// mount only — same one-way pattern as `?missing=`. Unknown values are
// silently dropped (tolerant parse).
const PRESENT_TOKENS: ReadonlySet<'picture' | 'pitch' | 'audio'> = new Set([
  'picture', 'pitch', 'audio',
])
const PATTERN_TOKENS: ReadonlySet<PitchPattern> = new Set([
  'heiban', 'atamadaka', 'nakadaka', 'odaka',
])

function parseMoreFromQuery(
  presentRaw: string | null,
  patternRaw: string | null,
): MoreFiltersValue {
  const next: MoreFiltersValue = { ...DEFAULT_MORE_FILTERS }
  if (presentRaw !== null && PRESENT_TOKENS.has(presentRaw as 'picture' | 'pitch' | 'audio')) {
    if (presentRaw === 'pitch')   next.pitch = 'has'
    if (presentRaw === 'picture') next.image = 'has'
    if (presentRaw === 'audio')   next.audio = 'has'
  }
  if (patternRaw !== null && PATTERN_TOKENS.has(patternRaw as PitchPattern)) {
    next.pitch = 'has'           // pattern requires has-pitch
    next.pitchPattern = patternRaw as PitchPattern
  }
  return next
}

// Translate the popover's tri-state UI shape into the action's
// positive/negative params.
//
// As of migration 20260624000001 the backend accepts both `missingField`
// and `presentField` simultaneously (cross-dimension combinations like
// "has picture AND missing audio" are legitimate). The two params still
// each carry a single token, so within a direction the popover's
// vertical precedence (pitch > audio > image) picks the winning token
// when multiple dimensions sit on the same side.
//
// The URL-seeded `existingMissing` (from ?missing=) is the fallback
// only when the popover's negative direction is at defaults — i.e. no
// in-popover override on any missing dimension.
function presenceToActionParams(
  more: MoreFiltersValue,
  existingMissing: CardMissingField | undefined,
): {
  missingField?: CardMissingField
  presentField?: 'picture' | 'pitch' | 'audio'
  pitchPattern?: PitchPattern
} {
  let presentField: 'picture' | 'pitch' | 'audio' | undefined
  if (more.image === 'has') presentField = 'picture'
  if (more.audio === 'has') presentField = 'audio'
  if (more.pitch === 'has') presentField = 'pitch'

  let missingField: CardMissingField | undefined
  if (more.image === 'missing') missingField = 'picture'
  if (more.audio === 'missing') missingField = 'audio'
  if (more.pitch === 'missing') missingField = 'pitch'

  // Fall back to the URL-seeded `?missing=` value only when the popover
  // hasn't picked a missing direction. Suppress the seed if it would
  // contradict a positive selection on the same dimension (the popover
  // is the more recent user signal).
  if (missingField === undefined && existingMissing !== undefined) {
    const contradiction =
      (presentField === 'picture' && existingMissing === 'picture') ||
      (presentField === 'audio'   && existingMissing === 'audio')   ||
      (presentField === 'pitch'   && existingMissing === 'pitch')
    if (!contradiction) missingField = existingMissing
  }

  const out: { missingField?: CardMissingField; presentField?: 'picture' | 'pitch' | 'audio'; pitchPattern?: PitchPattern } = {}
  if (missingField !== undefined) out.missingField = missingField
  if (presentField !== undefined) out.presentField = presentField
  if (presentField === 'pitch' && more.pitchPattern !== null) out.pitchPattern = more.pitchPattern
  return out
}

export function CardsBrowserView(): React.JSX.Element {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const [search,    setSearch]    = useState('')
  const [filters,   setFilters]   = useState<CardsFilters>(DEFAULT_FILTERS)
  const [pageSize,  setPageSize]  = useState<CardsPageSize>(DEFAULT_PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [selected, setSelected]   = useState<ReadonlySet<string>>(() => new Set())

  // URL-derived missing-field filter — read once on mount. The quality bars
  // deep-link with `?missing=audio` etc.; persisting bidirectionally would
  // tangle browser history with filter state. The `searchParams` reference
  // is intentionally captured at first render — subsequent navigation
  // wouldn't change the relevant query key in this view.
  const [missingField, setMissingField] = useState<CardMissingField | undefined>(undefined)
  useEffect(() => {
    setMissingField(parseMissingFromQuery(searchParams.get('missing')))
  }, [searchParams])

  // More-filters popover state. URL-seeded once on mount (mirroring the
  // ?missing= read-once pattern at line 89). Subsequent in-popover edits
  // do not push to the URL.
  const [moreFilters,     setMoreFilters]     = useState<MoreFiltersValue>(DEFAULT_MORE_FILTERS)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    setMoreFilters(parseMoreFromQuery(
      searchParams.get('present'),
      searchParams.get('pitchPattern'),
    ))
  }, [searchParams])

  const { toast, showToast, dismissToast } = useToast()
  const { views: savedViews, activeId: activeViewId, setActiveId: setActiveViewId, byId: viewById } = useSavedViews()

  // Sort follows the active view's recipe, default 'recent'.
  const sortFromActiveView: CardSortField = useMemo(() => {
    if (activeViewId === null) return 'recent'
    return viewById(activeViewId)?.recipe.sort ?? 'recent'
  }, [activeViewId, viewById])

  // ── Decks list (for the deck filter picker). ─────────────────────────
  const { data: decksList } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
  })
  const liveDecks: readonly DeckOption[] = useMemo(
    () => (decksList?.items ?? []).map((d) => ({ id: d.id, name: d.name })),
    [decksList],
  )

  // ── Dev panel + fixture rows (dev affordance only). ──────────────────
  const { state: devState, panel: devPanel } = useCardsDevState()
  const usingFixture = devState.fixture !== 'off'
  const decks: readonly DeckOption[] = usingFixture ? devState.decks : liveDecks

  // ── Cross-deck list query. ───────────────────────────────────────────
  const queryOpts = useMemo<CrossDeckCardsActionOptions>(() => {
    const opts: CrossDeckCardsActionOptions = {
      limit: pageSize,
      sort:  sortFromActiveView,
    }
    if (search.trim().length > 0)    opts.search    = search.trim()
    if (filters.deckId !== 'all')    opts.deckId    = filters.deckId
    if (filters.jlpt !== 'all')      opts.jlptLevel = filters.jlpt as NonNullable<CrossDeckCardsActionOptions['jlptLevel']>
    if (filters.status !== 'all')    opts.status    = filters.status as NonNullable<CrossDeckCardsActionOptions['status']>

    // Translate popover state + URL-seeded ?missing= into the action's
    // mutually-exclusive missing/present split. The popover's explicit
    // state takes precedence over the URL seed for the same dimension.
    const morePart = presenceToActionParams(moreFilters, missingField)
    if (morePart.missingField !== undefined) opts.missingField = morePart.missingField
    if (morePart.presentField !== undefined) opts.presentField = morePart.presentField
    if (morePart.pitchPattern !== undefined) opts.pitchPattern = morePart.pitchPattern

    // Apply the active view's recipe on top of the filter row — but the
    // user's explicit filter row takes precedence over the view recipe so
    // a saved view doesn't lock the user out of overriding it.
    if (activeViewId !== null) {
      const recipe = viewById(activeViewId)?.recipe
      if (recipe !== undefined) {
        if (recipe.status       !== undefined && filters.status === 'all')                       opts.status       = recipe.status
        if (recipe.missingField !== undefined && opts.missingField === undefined)                opts.missingField = recipe.missingField
        if (recipe.presentField !== undefined && opts.presentField === undefined)                opts.presentField = recipe.presentField
        if (recipe.pitchPattern !== undefined && opts.pitchPattern === undefined && opts.presentField === 'pitch') opts.pitchPattern = recipe.pitchPattern
        if (recipe.search       !== undefined && search.trim().length === 0)                     opts.search       = recipe.search
      }
    }
    return opts
  }, [search, filters, pageSize, sortFromActiveView, missingField, moreFilters, activeViewId, viewById])

  const liveQuery       = useCardsCrossDeckQuery(queryOpts)
  const qualityQuery    = useCardQualityIssuesQuery()

  // ── Data sources: live or fixtures. ──────────────────────────────────
  const rows: readonly CardsResultRow[] = useMemo(() => {
    if (usingFixture) return devState.rows

    const items = liveQuery.data?.items ?? []
    return items.map(toResultRow)
  }, [usingFixture, devState.rows, liveQuery.data])

  const totalCount = usingFixture ? devState.rows.length : (liveQuery.data?.totalCount ?? 0)
  const loading    = usingFixture ? devState.loading    : liveQuery.isLoading

  // Reset selection + page when the search / filter set changes.
  useEffect(() => {
    setSelected(new Set())
    setPageIndex(0)
  }, [search, filters, pageSize, activeViewId, missingField, moreFilters])

  // ── Quality issues — map snake_case backend kinds to the bar component's enum. ─
  const qualityIssues: ReadonlyArray<CardQualityIssue> = useMemo(() => {
    if (qualityQuery.data === undefined) return []
    return qualityQuery.data.map((i) => ({
      kind:  i.issueType as CardQualityIssueKind,
      count: i.count,
    }))
  }, [qualityQuery.data])

  // ── Row action wiring. ───────────────────────────────────────────────
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

  // Lookup the original wire item by id. Falls back to undefined for the
  // dev fixture path (no wire item exists for synthetic rows).
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
      // Dev fixture rows have no backing wire item — surface a hint
      // instead of attempting a mutation against a fake id.
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
      onError: (err) => {
        showToast(err.message || 'Failed to delete card.', 'error')
      },
    })
  }

  function handleMoveConfirm(card: ApiCardListItem, targetDeckId: string): void {
    moveMutation.mutate({ cardId: card.id, targetDeckId }, {
      onSuccess: () => {
        showToast('Card moved.', 'info')
        setMoveTarget(null)
      },
      onError: (err) => showToast(err.message || 'Failed to move card.', 'error'),
    })
  }

  function handleCopyConfirm(card: ApiCardListItem, targetDeckId: string): void {
    copyMutation.mutate({ cardId: card.id, targetDeckId }, {
      onSuccess: () => {
        showToast('Copy added to the deck.', 'info')
        setCopyTarget(null)
      },
      onError: (err) => showToast(err.message || 'Failed to copy card.', 'error'),
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
      onError: (err) => showToast(err.message || 'Failed to move cards.', 'error'),
    })
  }

  function handleBulkSuspend(): void {
    const ids = [...selected]
    bulkSuspendMutation.mutate(ids, {
      onSuccess: (result) => { reportBulkResult('Suspend', result); clearSelection() },
      onError:   (err) => showToast(err.message || 'Failed to suspend cards.', 'error'),
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
      onError: (err) => showToast(err.message || 'Failed to delete cards.', 'error'),
    })
  }

  // ── Pagination. ──────────────────────────────────────────────────────
  function handlePrev(): void {
    setPageIndex((i) => Math.max(0, i - 1))
  }
  function handleNext(): void {
    if (liveQuery.data?.hasMore === true || usingFixture) {
      setPageIndex((i) => i + 1)
    }
  }

  function handleSavedView(next: string | null): void {
    setActiveViewId(next)
  }
  function handleFilterChange(next: CardsFilters): void {
    setFilters(next)
    setActiveViewId(null)
  }
  function handleMoreFilters(): void {
    setMoreFiltersOpen((v) => !v)
  }
  function handleMoreFiltersApply(next: MoreFiltersValue): void {
    setMoreFilters(next)
    setActiveViewId(null)
    setMoreFiltersOpen(false)
  }

  const moreFilterCount = countMoreFilters(moreFilters)
  const filtersActive = search.length > 0
    || filters.deckId !== 'all' || filters.jlpt !== 'all' || filters.status !== 'all'
    || missingField !== undefined
    || moreFilterCount > 0
    || activeViewId !== null

  // First-deck-id helper for the bulk Move dialog ("current deck" prop).
  // For a cross-deck bulk, "current deck" is meaningless; pass the first
  // selected card's deck so the picker excludes at least one realistic
  // destination. Empty selection → empty string (dialog renders normally).
  const bulkMoveCurrentDeckId = useMemo(() => {
    const firstId = [...selected][0]
    if (firstId === undefined) return ''
    return rows.find((r) => r.id === firstId)?.deckId ?? ''
  }, [selected, rows])

  return (
    <>
      <TopBar>
        <h1 className="flex-1 text-base font-semibold text-sumi-ink">Cards</h1>
      </TopBar>

      <div className="min-h-screen bg-cool-paper-base pb-16">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16">

          {/* ── Page header ───────────────────────────────────────── */}
          <div className="pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8">
            <PageHeader
              kanji="字"
              label="Cards"
              title="All cards"
              subtitle="Search every card across every deck. Filter, select, and tag in bulk."
            />
          </div>

          {/* ── Controls cluster: search + saved views + filters ── */}
          <div className="space-y-4">
            <CardsSearchBar value={search} onChange={setSearch} />
            <SavedViewPills active={activeViewId} onSelect={handleSavedView} views={savedViews} />
            <CardsFilterRow
              filters={filters}
              decks={decks}
              onChange={handleFilterChange}
              onMoreClick={handleMoreFilters}
              moreTriggerRef={moreTriggerRef}
              moreFilterCount={moreFilterCount}
              moreOpen={moreFiltersOpen}
            />
            <MoreFiltersPopover
              open={moreFiltersOpen}
              anchorRef={moreTriggerRef}
              value={moreFilters}
              onApply={handleMoreFiltersApply}
              onClose={() => setMoreFiltersOpen(false)}
            />
          </div>

          {/* ── Card quality (toggle) ─────────────────────────────── */}
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setQualityOpen((v) => !v)}
              aria-expanded={qualityOpen}
              aria-controls="cards-quality-panel"
              className="inline-flex items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi transition-colors hover:border-sumi-ink hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              <span
                lang="ja"
                aria-hidden="true"
                className="font-display text-sm leading-none translate-y-[0.05em] text-inari-vermillion"
              >
                欠
              </span>
              <span>{qualityOpen ? 'Hide card quality' : 'Card quality'}</span>
            </button>
            {qualityOpen && (
              <div id="cards-quality-panel" className="mt-3">
                <CardsQualityBars issues={qualityIssues} />
              </div>
            )}
          </div>

          {/* ── Result count + clear ──────────────────────────────── */}
          <div className="mt-6 flex items-baseline justify-between gap-3">
            <p className="font-mono text-xs text-faded-sumi tabular-nums">
              <span className="text-sumi-ink">{totalCount}</span>
              {' '}{totalCount === 1 ? 'card' : 'cards'}
              {missingField !== undefined && (
                <>
                  {' '}
                  <span className="rounded-[1px] bg-cream-inset px-1.5 py-0.5 text-faded-sumi">missing {missingField}</span>
                </>
              )}
              {filtersActive && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setFilters(DEFAULT_FILTERS)
                      setActiveViewId(null)
                      setMissingField(undefined)
                    }}
                    className="ml-2 underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
                  >
                    Clear all filters
                  </button>
                </>
              )}
            </p>
          </div>

          {/* ── Results ──────────────────────────────────────────── */}
          <div className="mt-3">
            <CardsResultsTable
              rows={rows}
              onRowAction={handleRowAction}
              loading={loading}
              selectedIds={selected}
              onToggleSelection={toggleSelection}
              onToggleAllVisible={toggleAllVisible}
            />
            {!loading && totalCount > 0 && (
              <CardsPagination
                pageIndex={pageIndex}
                pageSize={pageSize}
                totalCount={totalCount}
                onPrev={handlePrev}
                onNext={handleNext}
                onPageSizeChange={setPageSize}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky bulk-actions bar. ──────────────────────────────────── */}
      {selected.size > 0 && (
        <CardsBulkBar
          selectedCount={selected.size}
          onAddTag={() => showToast('Inline tag editor lands in the next pass; use the kebab for now.', 'info')}
          onMove={() => setBulkMoveOpen(true)}
          onSuspend={handleBulkSuspend}
          onDelete={() => setBulkDeleteOpen(true)}
          onClear={clearSelection}
        />
      )}

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

      {/* Bulk move uses the same dialog with a synthetic card placeholder. */}
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

      {devPanel}
    </>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Maps a wire-format cross-deck card into the shape the results table renders.
 * Word / reading / meaning / partOfSpeech are projected out of `fieldsData`
 * via the shared-types narrowing helper.
 */
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
    tags:         item.tags,
    state:        item.state,
    isSuspended:  item.isSuspended,
    lapses:       item.lapses,
    due:          item.due,
  }
}

/** Minimal `ApiCardListItem`-shaped placeholder for the bulk-move dialog so
 *  it shows a sensible header without needing a real card. */
function bulkMoveSyntheticCard(count: number): ApiCardListItem {
  return {
    id:          'bulk',
    fieldsData:  { word: `${count} cards`, reading: '', meaning: '' },
    layoutType:  'vocabulary',
    jlptLevel:   null,
    state:       0 as ApiCardListItem['state'],
    isSuspended: false,
    due:         new Date().toISOString(),
    tags:        [],
  }
}

// ─── Confirm-delete dialog (local; mirrors BulkDeleteDecksDialog pattern) ───

function ConfirmDeleteDialog({
  open,
  title,
  description,
  isSubmitting,
  onCancel,
  onConfirm,
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
