'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Toast, useToast } from '@/components/ui/Toast'
import { queryKeys } from '@/lib/api/queryKeys'
import { listDecksAction } from '@/lib/actions/decks.actions'
import { State } from '@fsrs-japanese/shared-types'

import { CardsSearchBar } from './cards-search-bar'
import { SavedViewPills, type SavedViewKey } from './saved-view-pills'
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
import { CardsQualityBars, type CardQualityIssue } from './cards-quality-bars'
import { useCardsDevState } from './cards-dev-panel'

const DEFAULT_FILTERS: CardsFilters = {
  deckId: 'all',
  jlpt:   'all',
  status: 'all',
}

const DEFAULT_PAGE_SIZE: CardsPageSize = 25

export function CardsBrowserView(): React.JSX.Element {
  const [search,    setSearch]    = useState('')
  const [filters,   setFilters]   = useState<CardsFilters>(DEFAULT_FILTERS)
  const [savedView, setSavedView] = useState<SavedViewKey | null>(null)
  const { toast, showToast, dismissToast } = useToast()
  const [pageSize,  setPageSize]  = useState<CardsPageSize>(DEFAULT_PAGE_SIZE)
  const [pageIndex, setPageIndex] = useState(0)
  const [qualityOpen, setQualityOpen] = useState(false)

  // Per-issue card-health counts. Hidden behind a toggle so the table-first
  // browser stays calm by default. Currently empty — when the per-card
  // mistake-quality pipeline ships server-side, this state hydrates from
  // a fresh API hook. The CardsQualityBars empty state ("Every card has
  // its support fields filled in.") reads as a positive in the meantime.
  const qualityIssues: ReadonlyArray<CardQualityIssue> = useMemo(() => [], [])

  // Reset to first page whenever inputs that change the visible set change.
  useEffect(() => { setPageIndex(0) }, [search, filters, savedView, pageSize])

  // ── Decks list (for the deck filter picker). ─────────────────────────
  const { data: decksList } = useQuery({
    queryKey: queryKeys.decks.list(),
    queryFn:  () => listDecksAction(),
  })
  const liveDecks: readonly DeckOption[] = useMemo(
    () => (decksList?.items ?? []).map((d) => ({ id: d.id, name: d.name })),
    [decksList],
  )

  // ── Dev panel + fixture rows. ────────────────────────────────────────
  const { state: devState, panel: devPanel } = useCardsDevState()

  // When a fixture is active, swap the deck-filter dropdown source to
  // the fixture's deck list so the dropdown maps to renderable data.
  const decks: readonly DeckOption[] = devState.fixture === 'off' ? liveDecks : devState.decks

  // Apply search + filters to the source rows (fixture data today; will
  // be the server's pre-filtered result set once the cross-deck endpoint
  // is wired). All filter logic runs client-side here, which is fine for
  // ~120 rows; remove the in-memory filter once filters are server-applied.
  const filteredRows: readonly CardsResultRow[] = useMemo(() => {
    let result = devState.rows.slice()

    const q = search.trim().toLowerCase()
    if (q.length > 0) {
      result = result.filter((r) =>
        r.word.toLowerCase().includes(q) ||
        r.reading.toLowerCase().includes(q) ||
        r.meaning.toLowerCase().includes(q),
      )
    }
    if (filters.deckId !== 'all') {
      result = result.filter((r) => r.deckId === filters.deckId)
    }
    if (filters.jlpt === 'beyond') {
      // "Beyond JLPT" matches cards with no inferable level (null) or the
      // explicit 'beyond_jlpt' enum value the schema reserves for native /
      // domain-specific vocabulary outside the JLPT canon.
      result = result.filter((r) => r.jlptLevel === null || r.jlptLevel === 'beyond_jlpt')
    } else if (filters.jlpt !== 'all') {
      result = result.filter((r) => r.jlptLevel === filters.jlpt)
    }
    if (filters.status !== 'all') {
      const status = filters.status
      result = result.filter((r) => matchesStatus(r, status))
    }

    return result
  }, [devState.rows, search, filters])

  // Slice for the visible page. Client-side today; when the cross-deck
  // endpoint lands, swap this for the server's paginated result.
  const totalCount = filteredRows.length
  const visibleRows = useMemo(() => {
    const start = pageIndex * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, pageIndex, pageSize])

  const rows = visibleRows
  const loading = devState.loading

  // ── Helpers ──────────────────────────────────────────────────────────
  function handleRowAction(_cardId: string, action: CardRowAction): void {
    switch (action) {
      case 'edit':
        showToast('Card editing is coming. The /cards/[cardId]/edit route is pending.')
        return
      case 'add-copy':
        showToast('Adding a copy to another deck is coming. The endpoint is pending.')
        return
      case 'move':
        showToast('Move card is coming. The /cards/:id/move endpoint is pending.')
        return
      case 'delete':
        showToast('Delete card is coming. A confirmation dialog will land with the endpoint.')
        return
    }
  }

  function handleSavedView(next: SavedViewKey | null): void {
    setSavedView(next)
    if (next !== null) {
      showToast('Saved views are coming. The backend search endpoint is pending.')
    }
  }
  function handleFilterChange(next: CardsFilters): void {
    setFilters(next)
    setSavedView(null)
  }
  function handleMoreFilters(): void {
    showToast('More filters are coming. The has-audio / has-image / has-mnemonic dimensions are pending.')
  }

  const filtersActive = search.length > 0 ||
    filters.deckId !== 'all' || filters.jlpt !== 'all' ||
    filters.status !== 'all'

  // ── Render ───────────────────────────────────────────────────────────
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
            <SavedViewPills active={savedView} onSelect={handleSavedView} />
            <CardsFilterRow
              filters={filters}
              decks={decks}
              onChange={handleFilterChange}
              onMoreClick={handleMoreFilters}
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
              {filtersActive && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setFilters(DEFAULT_FILTERS)
                      setSavedView(null)
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
            {!filtersActive && totalCount === 0 && !loading ? (
              <DefaultEmptyState onPickRecent={() => handleSavedView('recent')} />
            ) : (
              <>
                <CardsResultsTable
                  rows={rows}
                  onRowAction={handleRowAction}
                  loading={loading}
                />
                {!loading && totalCount > 0 && (
                  <CardsPagination
                    pageIndex={pageIndex}
                    pageSize={pageSize}
                    totalCount={totalCount}
                    onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
                    onNext={() => setPageIndex((i) => i + 1)}
                    onPageSizeChange={setPageSize}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

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

// ─── Sub-views ──────────────────────────────────────────────────────────

function DefaultEmptyState({ onPickRecent }: { onPickRecent: () => void }): React.JSX.Element {
  return (
    <div className="rounded-[2px] border border-soft-hairline bg-warm-paper-raised">
      <span aria-hidden="true" className="pointer-events-none block h-[2px] w-full bg-inari-vermillion" />
      <div className="px-6 py-16 text-center sm:py-20">
        <p className="text-base font-medium text-sumi-ink">Start a search or pick a saved view.</p>
        <p className="mx-auto mt-1.5 max-w-[42ch] text-sm text-faded-sumi">
          Type to find cards across every deck, or jump straight to a curated subset.
        </p>
        <div className="mt-5">
          <button
            type="button"
            onClick={onPickRecent}
            className="ui-motion-colors inline-flex h-9 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 text-sm font-medium text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            See recently added
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Maps a row's combined FSRS state + suspended bit onto the user-facing
 * status filter dimension. Suspended-as-a-state takes precedence so
 * `status=suspended` matches exactly that subset.
 */
function matchesStatus(row: CardsResultRow, status: Exclude<CardsFilters['status'], 'all'>): boolean {
  if (status === 'suspended') return row.isSuspended
  if (row.isSuspended) return false
  switch (status) {
    case 'new':      return row.state === State.New
    case 'learning': return row.state === State.Learning || row.state === State.Relearning
    case 'review':   return row.state === State.Review
  }
}

