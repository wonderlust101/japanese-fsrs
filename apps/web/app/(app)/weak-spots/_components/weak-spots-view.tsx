'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { PageHeader, PAGE_HEADER_PADDING } from '@/components/ui/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PageLoader } from '@/components/ui/TomoLoader'
import { Toast, useToast } from '@/components/ui/Toast'
import {
  useDiagnoseWeakSpotMutation,
  useWeakSpotDetailQuery,
  useWeakSpotsQuery,
  useReopenWeakSpotMutation,
  useResolveWeakSpotMutation,
} from '@/lib/api/weak-spots'
import type { ListLeechesOptions } from '@/lib/actions/weak-spots.actions'
import type { ApiWeakSpotListItem, ApiWeakSpotListResponse } from '@fsrs-japanese/shared-types'

import { CardsPagination, type CardsPageSize } from '@/app/(app)/cards/_components/cards-pagination'

import { WeakSpotDetailsDialog } from './weak-spot-details-dialog'
import { WeakSpotListItem } from './weak-spot-list-item'
import { WeakSpotsCountLine } from './weak-spots-count-line'
import { WeakSpotsEmpty } from './weak-spots-empty'
import { WeakSpotsFilterRow } from './weak-spots-filter-row'
import { useLeechesDevState } from '@/dev/panels/insights-weak-spots'
import { INITIAL_WEAK_SPOT_FILTERS, WEAK_SPOT_DRILL_ENABLED, type WeakSpotFilters } from './weak-spots-types'
import { parseWeakSpotFiltersFromURL, serializeWeakSpotFiltersToURL } from './weak-spots-filter-state'

const DEFAULT_PAGE_SIZE: CardsPageSize = 25

// Page chrome matches the Cards/Decks browser exactly: a single bottom pad on
// the inner container (no second pad on the shell), and `w-full` before the
// max-width clamp. Header padding reuses the shared PAGE_HEADER_PADDING token
// rather than a local copy so the three Study surfaces stay in lockstep.
const PAGE_SHELL_CLASS     = 'min-h-screen bg-cool-paper-base'
const PAGE_CONTAINER_CLASS = 'mx-auto w-full max-w-[1440px] px-4 pt-4 pb-20 md:px-12 lg:px-16'

// ─── View ────────────────────────────────────────────────────────────────────

/**
 * Container for /weak-spots. Built on the Mistakes view's editorial
 * scaffolding so the two surfaces feel like the same family:
 *   - TopBar with the section title (no back link — it's a top-level
 *     Study surface reached from the sidebar).
 *   - PageHeader with the 弱 kanji ornament.
 *   - Filter row.
 *   - List body (or empty state).
 *   - Detail dialog driven by URL-less `selectedId` state.
 *
 * Data flow: live data wins by default; dev fixtures override only when the
 * fixture panel selects something other than `off`. Forced states ('loading'
 * / 'error') short-circuit the view entirely so the dev panel can preview
 * those branches without a live API. Pattern matches `MistakesView`.
 */
export function WeakSpotsView(): React.JSX.Element {
  const dev = useLeechesDevState()
  // Filter/sort/search state lives in the URL (mirrors the Cards browser) so a
  // narrowed view is shareable and deep-linkable. `filters` derives from the
  // query string; `setFilters` writes back via router.replace (scroll:false, no
  // history clutter), which re-runs the useMemo on the next render.
  const router       = useRouter()
  const searchParams = useSearchParams()
  const filters = useMemo<WeakSpotFilters>(
    () => parseWeakSpotFiltersFromURL((k) => searchParams.get(k)),
    [searchParams],
  )
  const setFilters = useCallback((next: WeakSpotFilters): void => {
    const qs = serializeWeakSpotFiltersToURL(next).toString()
    router.replace(qs.length > 0 ? `/weak-spots?${qs}` : '/weak-spots', { scroll: false })
  }, [router])

  // ── Pagination (offset model, mirrors the Cards browser). ────────────────
  // `page` is 1-indexed and session-local (the filters themselves persist to
  // localStorage; the page index does not — a cold visit always lands on
  // page 1). Any filter or sort change resets to page 1 so the user is never
  // pinned to a stale page index against a freshly narrowed result set; the
  // change handlers below do the reset inline (rather than via an effect) so
  // there's no transient fetch at the old offset.
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState<CardsPageSize>(DEFAULT_PAGE_SIZE)
  const pageIndex = page - 1

  const handleFiltersChange = (next: WeakSpotFilters): void => {
    setFilters(next)
    setPage(1)
  }
  // Changing the axis resets the direction to that axis's natural default
  // (encoded as null), so switching from "Most lapses" to "Date flagged"
  // doesn't carry an unexpected ascending flip — mirrors the Cards count line.
  const handlePickSort = (sort: WeakSpotFilters['sort']): void => {
    setFilters({ ...filters, sort, sortDir: null })
    setPage(1)
  }
  // Flip the direction in place. If the flip lands back on the axis's natural
  // default, store null so the wire/state stay clean (no redundant override).
  const handleToggleSortDir = (): void => {
    const naturalAsc   = filters.sort === 'oldestUnresolved' || filters.sort === 'deckOrder'
    const effectiveAsc = filters.sortDir === 'asc' ? true : filters.sortDir === 'desc' ? false : naturalAsc
    const flippedAsc   = !effectiveAsc
    const nextDir: WeakSpotFilters['sortDir'] =
      flippedAsc === naturalAsc ? null : (flippedAsc ? 'asc' : 'desc')
    setFilters({ ...filters, sortDir: nextDir })
    setPage(1)
  }
  const handlePageSizeChange = (next: CardsPageSize): void => {
    setPageSize(next)
    setPage(1)
  }

  // Translate the UI filter shape to the wire shape (drops 'all' sentinels)
  // and add the offset window for the active page.
  const queryOpts = useMemo<ListLeechesOptions>(() => {
    const opts: ListLeechesOptions = {
      status: filters.status,
      sort:   filters.sort,
      limit:  pageSize,
    }
    if (filters.sortDir !== null) opts.sortDir = filters.sortDir
    const offset = pageIndex * pageSize
    if (offset > 0) opts.offset = offset
    if (filters.deckId    !== 'all') opts.deckId    = filters.deckId
    if (filters.jlptLevel !== 'all') opts.jlptLevel = filters.jlptLevel
    if (filters.diagnosis !== 'all') opts.diagnosis = filters.diagnosis
    if (filters.search.trim().length > 0) opts.search = filters.search.trim()
    return opts
  }, [filters, pageSize, pageIndex])

  const liveQuery = useWeakSpotsQuery(queryOpts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailQuery = useWeakSpotDetailQuery(selectedId)

  const resolveMutation  = useResolveWeakSpotMutation()
  const reopenMutation   = useReopenWeakSpotMutation()
  const diagnoseMutation = useDiagnoseWeakSpotMutation()

  const { toast, showToast, dismissToast } = useToast()

  function openWeakSpot(id: string): void {
    setSelectedId(id)
  }

  function closeDialog(): void {
    setSelectedId(null)
    // Reset the diagnose mutation's error so reopening a different weakSpot
    // doesn't inherit the prior error message.
    diagnoseMutation.reset()
  }

  function handleResolve(id: string): void {
    resolveMutation.mutate(id, {
      onSuccess: () => showToast('WeakSpot marked resolved.', 'info'),
      onError:   (err) => showToast(err.message ?? 'Couldn’t resolve this card.', 'error'),
    })
  }

  function handleReopen(id: string): void {
    reopenMutation.mutate(id, {
      onSuccess: () => showToast('WeakSpot reopened.', 'info'),
      onError:   (err) => showToast(err.message ?? 'Couldn’t reopen this card.', 'error'),
    })
  }

  function handleDiagnose(id: string): void {
    diagnoseMutation.mutate(id, {
      onError: (err) => showToast(err.message ?? 'Couldn’t diagnose this card.', 'error'),
    })
  }

  // ── Forced dev states ────────────────────────────────────────────────────
  if (dev.forcedState === 'error') {
    return (
      <PageShell>
        <WeakSpotsHeader status={filters.status} count={null} />
        <WeakSpotsFilterRow value={filters} onChange={handleFiltersChange} />
        <ErrorAlert />
      </PageShell>
    )
  }

  if (dev.forcedState === 'loading') {
    return (
      <PageShell>
        <WeakSpotsHeader status={filters.status} count={null} />
        <WeakSpotsFilterRow value={filters} onChange={handleFiltersChange} />
        <ListSkeleton />
      </PageShell>
    )
  }

  // ── Live error / loading ─────────────────────────────────────────────────
  if (dev.fixtureData === null && liveQuery.isError) {
    return (
      <PageShell>
        <WeakSpotsHeader status={filters.status} count={null} />
        <WeakSpotsFilterRow value={filters} onChange={handleFiltersChange} />
        <ErrorAlert />
      </PageShell>
    )
  }

  if (dev.fixtureData === null && liveQuery.isLoading) {
    return (
      <PageShell>
        <PageLoader />
      </PageShell>
    )
  }

  // ── Live or fixture data ─────────────────────────────────────────────────
  const data: ApiWeakSpotListResponse = dev.fixtureData ?? liveQuery.data ?? {
    items:      [],
    totalCount: 0,
  }
  const items      = data.items
  const totalCount = data.totalCount
  const isEmpty    = totalCount === 0
  // Distinguish "no weak spots at all" (the kitsune empty, keyed to status)
  // from "weak spots exist but none match the active narrowing" (a no-results
  // message with the toolbar kept visible so the user can clear). Status is
  // excluded: switching status is a tab, not a narrowing filter.
  const isNarrowed =
    filters.deckId    !== 'all' ||
    filters.jlptLevel !== 'all' ||
    filters.diagnosis !== 'all' ||
    filters.search.trim().length > 0
  // A page/filter/sort refetch keeps the previous page on screen (the query
  // uses keepPreviousData), so `isFetching && !isLoading` is the "busy"
  // signal that disables pagination controls. Fixtures never fetch.
  const isPaginating = dev.fixtureData === null && liveQuery.isFetching && !liveQuery.isLoading

  const selectedWeakSpot: ApiWeakSpotListItem | undefined = selectedId === null
    ? undefined
    : detailQuery.data ?? items.find((l) => l.id === selectedId) ?? undefined

  const diagnoseError =
    diagnoseMutation.error !== null
      ? diagnoseMutation.error.message
      : undefined

  return (
    <>
      <PageShell>
        {/* Hero + primary action, grouped exactly like the deck-detail
            header: PageHeader and the CTA share one `flex flex-col gap-4`
            child so the button sits tight under the title. The CTA only
            surfaces when there's something to drill (hidden on the resolved
            tab and when the unresolved list is empty — the WeakSpotsEmpty
            kitsune owns that state). */}
        <WeakSpotsHeader status={filters.status} count={totalCount} narrowed={isNarrowed}>
          {WEAK_SPOT_DRILL_ENABLED && filters.status === 'unresolved' && !isEmpty && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ButtonLink href="/weak-spots/drill/setup" variant="primary" size="lg">
                Drill these →
              </ButtonLink>
              <p className="font-mono text-sm text-faded-sumi">
                Practice only · review schedule unchanged
              </p>
            </div>
          )}
        </WeakSpotsHeader>

        <WeakSpotsFilterRow value={filters} onChange={handleFiltersChange} />

        {isEmpty && isNarrowed ? (
          <NoMatches onClear={() => handleFiltersChange({ ...INITIAL_WEAK_SPOT_FILTERS, status: filters.status })} />
        ) : isEmpty ? (
          <WeakSpotsEmpty variant={filters.status} />
        ) : (
          <>
            {/* Result count + Sort, paired so the ordering control sits next
                to the number it affects (the Cards-browser pattern). */}
            <div className="mt-4">
              <WeakSpotsCountLine
                totalCount={totalCount}
                status={filters.status}
                sort={filters.sort}
                sortDir={filters.sortDir}
                onPickSort={handlePickSort}
                onToggleSortDir={handleToggleSortDir}
              />
            </div>

            <div className="mt-3 overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised">
              <span aria-hidden="true" className="block h-0.5 w-full bg-inari-vermillion" />
              <ul role="list" className="flex flex-col">
                {items.map((weakSpot) => (
                  <WeakSpotListItem
                    key={weakSpot.id}
                    weakSpot={weakSpot}
                    onOpen={openWeakSpot}
                    onResolve={handleResolve}
                    onReopen={handleReopen}
                    isMutating={
                      (resolveMutation.isPending && resolveMutation.variables === weakSpot.id) ||
                      (reopenMutation.isPending  && reopenMutation.variables  === weakSpot.id)
                    }
                  />
                ))}
              </ul>
            </div>

            <CardsPagination
              pageIndex={pageIndex}
              pageSize={pageSize}
              totalCount={totalCount}
              onPickPage={(next) => setPage(next)}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
              onPageSizeChange={handlePageSizeChange}
              isPaginating={isPaginating}
            />
          </>
        )}

      </PageShell>

      <WeakSpotDetailsDialog
        open={selectedId !== null}
        onClose={closeDialog}
        weakSpot={selectedWeakSpot}
        isLoading={selectedId !== null && detailQuery.isLoading && selectedWeakSpot === undefined}
        isError={selectedId !== null && detailQuery.isError && selectedWeakSpot === undefined}
        {...(detailQuery.error !== null && { errorMessage: detailQuery.error.message })}
        onResolve={handleResolve}
        onReopen={handleReopen}
        onDiagnose={handleDiagnose}
        isResolving={resolveMutation.isPending  && resolveMutation.variables  === selectedId}
        isReopening={reopenMutation.isPending   && reopenMutation.variables   === selectedId}
        isDiagnosing={diagnoseMutation.isPending && diagnoseMutation.variables === selectedId}
        diagnoseError={diagnoseError}
      />

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

// ─── Chrome / shell ──────────────────────────────────────────────────────────

function WeakSpotsTopBar(): React.JSX.Element {
  return (
    <TopBar>
      <TopBarTitle kanji="弱" label="Weak spots" />
    </TopBar>
  )
}

interface WeakSpotsHeaderProps {
  status:    'unresolved' | 'resolved'
  count:     number | null
  /** True when a deck/JLPT/diagnosis/search narrowing is active, so the
   *  subtitle frames a zero count as "no matches" rather than "nothing
   *  flagged". */
  narrowed?: boolean
  /** Optional primary action, rendered tight under the title inside the
   *  shared `flex flex-col gap-4` group (the deck-detail header pattern). */
  children?: React.ReactNode
}

function WeakSpotsHeader({ status, count, narrowed = false, children }: WeakSpotsHeaderProps): React.JSX.Element {
  const title = status === 'unresolved' ? 'Weak spots' : 'Resolved weak spots'
  const subtitle = buildSubtitle(status, count, narrowed)
  return (
    <div className={PAGE_HEADER_PADDING}>
      {/* Same grid/flex as the deck-detail hero: a single column that pairs
          the title block with its CTA at a tight gap-4, so the page's larger
          rhythm opens up around the pair rather than between title and button. */}
      <div className="flex flex-col gap-4">
        <PageHeader kanji="弱" label="Weak spots" title={title} subtitle={subtitle} />
        {children}
      </div>
    </div>
  )
}

function buildSubtitle(
  status:   'unresolved' | 'resolved',
  count:    number | null,
  narrowed: boolean,
): string {
  if (count === null) {
    return status === 'unresolved'
      ? 'Cards that keep coming back for another look.'
      : 'Cards you’ve already worked through.'
  }
  // When narrowed, frame the count as a match against the active filters so a
  // zero never reads as the (incorrect) "nothing flagged" all-clear.
  if (narrowed) {
    if (count === 0) return 'No weak spots match these filters.'
    if (count === 1) return 'One weak spot matches these filters.'
    return `${count} weak spots match these filters.`
  }
  if (status === 'unresolved') {
    if (count === 0) return 'Nothing flagged right now. Keep reviewing.'
    if (count === 1) return 'One card that keeps coming back for another look.'
    return `${count} cards that keep coming back for another look.`
  }
  if (count === 0) return 'No resolved cards yet.'
  if (count === 1) return 'One card you’ve already worked through.'
  return `${count} cards you’ve already worked through.`
}

/**
 * No-results state for an active narrowing (search or filters), distinct from
 * the all-clear kitsune empty. Keeps the toolbar above it visible and offers a
 * one-tap reset back to the full list for the current status tab.
 */
function NoMatches({ onClear }: { onClear: () => void }): React.JSX.Element {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 text-center">
      <p className="font-display text-lg text-sumi-ink">No weak spots match</p>
      <p className="max-w-measure-tight text-sm text-faded-sumi">
        Nothing here fits the current search and filters. Try a different term or widen the filters.
      </p>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear search and filters
      </Button>
    </div>
  )
}

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <WeakSpotsTopBar />
      <div className={PAGE_SHELL_CLASS}>
        <div className={PAGE_CONTAINER_CLASS}>{children}</div>
      </div>
    </>
  )
}

function ErrorAlert(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mt-6 rounded-xs border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p>Couldn&rsquo;t load your weak spots right now.</p>
      <p className="mt-1 text-error-deep/80">Refresh the page, or try again in a moment.</p>
    </div>
  )
}

function ListSkeleton(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading weak spots"
      className="mt-6 overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised"
    >
      <span aria-hidden="true" className="block h-0.5 w-full bg-inari-vermillion/40" />
      <div className="flex flex-col">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-3 border-b border-soft-hairline px-4 py-5 last:border-b-0 sm:px-5 sm:py-6"
          >
            {/* Three tiers, matching the redesigned row: hero, meaning, meta. */}
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-5 w-40" />
            </div>
            <Skeleton className="h-8 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
