'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toast, useToast } from '@/components/ui/Toast'
import {
  useDiagnoseLeechMutation,
  useLeechDetailQuery,
  useLeechesQuery,
  useReopenLeechMutation,
  useResolveLeechMutation,
} from '@/lib/api/leeches'
import type { ListLeechesOptions } from '@/lib/actions/leeches.actions'
import type { ApiLeechListItem, ApiLeechListResponse } from '@fsrs-japanese/shared-types'

import { LeechDetailsDialog } from './leech-details-dialog'
import { LeechListItem } from './leech-list-item'
import { LeechesEmpty } from './leeches-empty'
import { LeechesFilterRow, useLeechFiltersStorage } from './leeches-filter-row'
import { useLeechesDevState } from './leeches-dev-panel'
import { INITIAL_LEECH_FILTERS } from './leeches-types'

const PAGE_SHELL_CLASS     = 'min-h-screen bg-cool-paper-base pb-16'
const PAGE_CONTAINER_CLASS = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16'
const HEADER_PADDING_CLASS = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

// ─── View ────────────────────────────────────────────────────────────────────

/**
 * Container for /insights/weak-spots. Built on the Mistakes view's editorial
 * scaffolding so the two surfaces feel like the same family:
 *   - TopBar with a "← Insights" anchor for tabular navigation.
 *   - PageHeader with the 蛭 kanji ornament.
 *   - Filter row.
 *   - List body (or empty state).
 *   - Detail dialog driven by URL-less `selectedId` state.
 *
 * Data flow: live data wins by default; dev fixtures override only when the
 * fixture panel selects something other than `off`. Forced states ('loading'
 * / 'error') short-circuit the view entirely so the dev panel can preview
 * those branches without a live API. Pattern matches `MistakesView`.
 */
export function LeechesView(): React.JSX.Element {
  const dev = useLeechesDevState()
  const [filters, setFilters] = useLeechFiltersStorage(INITIAL_LEECH_FILTERS)

  // Translate the UI filter shape to the wire shape (drops 'all' sentinels).
  const queryOpts = useMemo<ListLeechesOptions>(() => {
    const opts: ListLeechesOptions = {
      status: filters.status,
      sort:   filters.sort,
    }
    if (filters.deckId    !== 'all') opts.deckId    = filters.deckId
    if (filters.jlptLevel !== 'all') opts.jlptLevel = filters.jlptLevel
    if (filters.cardType  !== 'all') opts.cardType  = filters.cardType
    if (filters.diagnosis !== 'all') opts.diagnosis = filters.diagnosis
    return opts
  }, [filters])

  const liveQuery = useLeechesQuery(queryOpts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const detailQuery = useLeechDetailQuery(selectedId)

  const resolveMutation  = useResolveLeechMutation()
  const reopenMutation   = useReopenLeechMutation()
  const diagnoseMutation = useDiagnoseLeechMutation()

  const { toast, showToast, dismissToast } = useToast()

  function openLeech(id: string): void {
    setSelectedId(id)
  }

  function closeDialog(): void {
    setSelectedId(null)
    // Reset the diagnose mutation's error so reopening a different leech
    // doesn't inherit the prior error message.
    diagnoseMutation.reset()
  }

  function handleResolve(id: string): void {
    resolveMutation.mutate(id, {
      onSuccess: () => showToast('Leech marked resolved.', 'info'),
      onError:   (err) => showToast(err.message ?? 'Couldn’t resolve this card.', 'error'),
    })
  }

  function handleReopen(id: string): void {
    reopenMutation.mutate(id, {
      onSuccess: () => showToast('Leech reopened.', 'info'),
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
        <LeechesHeader status={filters.status} count={null} />
        <LeechesFilterRow value={filters} onChange={setFilters} />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.forcedState === 'loading') {
    return (
      <PageShell>
        <LeechesHeader status={filters.status} count={null} />
        <LeechesFilterRow value={filters} onChange={setFilters} />
        <ListSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  // ── Live error / loading ─────────────────────────────────────────────────
  if (dev.fixtureData === null && liveQuery.isError) {
    return (
      <PageShell>
        <LeechesHeader status={filters.status} count={null} />
        <LeechesFilterRow value={filters} onChange={setFilters} />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.fixtureData === null && liveQuery.isLoading) {
    return (
      <PageShell>
        <LeechesHeader status={filters.status} count={null} />
        <LeechesFilterRow value={filters} onChange={setFilters} />
        <ListSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  // ── Live or fixture data ─────────────────────────────────────────────────
  const data: ApiLeechListResponse = dev.fixtureData ?? liveQuery.data ?? {
    items:      [],
    nextCursor: null,
    hasMore:    false,
  }
  const items = data.items
  const isEmpty = items.length === 0

  const selectedLeech: ApiLeechListItem | undefined = selectedId === null
    ? undefined
    : detailQuery.data ?? items.find((l) => l.id === selectedId) ?? undefined

  const diagnoseError =
    diagnoseMutation.error !== null
      ? diagnoseMutation.error.message
      : undefined

  return (
    <>
      <PageShell>
        <LeechesHeader status={filters.status} count={items.length} />

        {/* Primary CTA — above the fold. Only surfaces when there's
            actually something to drill: hidden on the resolved tab and
            when the unresolved list is empty (the LeechesEmpty kitsune
            owns that state). */}
        {filters.status === 'unresolved' && !isEmpty && (
          <div className="-mt-2 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 sm:mb-4">
            <Link
              href="/insights/weak-spots/drill/setup"
              className="inline-flex h-11 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-5 text-sm font-semibold text-warm-paper-raised transition-colors hover:bg-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Drill these →
            </Link>
            <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
              Practice only · review schedule unchanged
            </p>
          </div>
        )}

        <LeechesFilterRow value={filters} onChange={setFilters} />

        {isEmpty ? (
          <LeechesEmpty variant={filters.status} />
        ) : (
          <div className="mt-6 overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised">
            <span aria-hidden="true" className="block h-[2px] w-full bg-inari-vermillion" />
            <ul role="list" className="flex flex-col">
              {items.map((leech) => (
                <LeechListItem
                  key={leech.id}
                  leech={leech}
                  onOpen={openLeech}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  isMutating={
                    (resolveMutation.isPending && resolveMutation.variables === leech.id) ||
                    (reopenMutation.isPending  && reopenMutation.variables  === leech.id)
                  }
                />
              ))}
            </ul>
          </div>
        )}

        {dev.panel}
      </PageShell>

      <LeechDetailsDialog
        open={selectedId !== null}
        onClose={closeDialog}
        leech={selectedLeech}
        isLoading={selectedId !== null && detailQuery.isLoading && selectedLeech === undefined}
        isError={selectedId !== null && detailQuery.isError && selectedLeech === undefined}
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

function LeechesTopBar(): React.JSX.Element {
  return (
    <TopBar>
      <Link
        href="/insights"
        className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span aria-hidden="true">←</span>
        <span>Insights</span>
      </Link>
      <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
      <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">Weak spots</h1>
    </TopBar>
  )
}

interface LeechesHeaderProps {
  status: 'unresolved' | 'resolved'
  count:  number | null
}

function LeechesHeader({ status, count }: LeechesHeaderProps): React.JSX.Element {
  const title = status === 'unresolved' ? 'Weak spots' : 'Resolved weak spots'
  const subtitle = buildSubtitle(status, count)
  return (
    <div className={HEADER_PADDING_CLASS}>
      <PageHeader kanji="弱" label="Weak spots" title={title} subtitle={subtitle} />
    </div>
  )
}

function buildSubtitle(
  status: 'unresolved' | 'resolved',
  count:  number | null,
): string {
  if (count === null) {
    return status === 'unresolved'
      ? 'Cards that keep coming back for another look.'
      : 'Cards you’ve already worked through.'
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

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <LeechesTopBar />
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
      className="mt-6 rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p>Couldn&rsquo;t load your leeches right now.</p>
      <p className="mt-1 text-error-deep/80">Refresh the page, or try again in a moment.</p>
    </div>
  )
}

function ListSkeleton(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading leeches"
      className="mt-6 overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised"
    >
      <span aria-hidden="true" className="block h-[2px] w-full bg-inari-vermillion/40" />
      <div className="flex flex-col">
        {Array.from({ length: 5 }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 border-b border-soft-hairline px-5 py-5 last:border-b-0"
          >
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}
