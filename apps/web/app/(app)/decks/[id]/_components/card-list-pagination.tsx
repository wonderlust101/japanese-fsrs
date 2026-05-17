'use client'

import { TomoSelect } from '@/components/ui/TomoSelect'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type CardPageSize = (typeof PAGE_SIZE_OPTIONS)[number]

interface Props {
  /** 0-indexed page currently displayed. */
  pageIndex:        number
  /** Current per-page size. */
  pageSize:         CardPageSize
  /** Count of items rendered on the current page. */
  pageItemCount:    number
  /** True when an earlier page exists (pageIndex > 0). */
  hasPrev:          boolean
  /** True when a later page exists (more in cache OR server has more). */
  hasNext:          boolean
  /** True when the next page is currently being fetched from the server. */
  isFetchingNext:   boolean
  onPrev:           () => void
  onNext:           () => void
  onPageSizeChange: (next: CardPageSize) => void
}

/**
 * Pagination footer for the deck-scoped card list. Page-size selector on the
 * left, Prev / Next on the right. The cards API is cursor-paginated, so we
 * don't have a total count or numbered page jumps; the chrome mirrors what
 * the Decks list page uses (Prev / Next + "Showing X–Y").
 *
 * "Showing X–Y" uses the local pageIndex × pageSize to derive the range —
 * exact for the current page, even though the absolute total beyond what's
 * been fetched is unknown.
 */
export function CardListPagination({
  pageIndex,
  pageSize,
  pageItemCount,
  hasPrev,
  hasNext,
  isFetchingNext,
  onPrev,
  onNext,
  onPageSizeChange,
}: Props): React.JSX.Element {
  const start = pageItemCount === 0 ? 0 : pageIndex * pageSize + 1
  const end   = pageIndex * pageSize + pageItemCount

  return (
    <nav
      aria-label="Card list pagination"
      className="mt-6 flex flex-col items-stretch gap-3 border-t border-soft-hairline pt-4 pb-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
            Per page
          </span>
          <TomoSelect
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v) as CardPageSize)}
            options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
            ariaLabel="Cards per page"
            className="min-w-[4.5rem]"
          />
        </div>

        <p className="font-mono text-xs text-faded-sumi tabular-nums">
          Showing{' '}
          <span className="text-sumi-ink">{start}</span>
          {start !== end && (
            <>
              {'–'}
              <span className="text-sumi-ink">{end}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <PaginationButton disabled={!hasPrev} onClick={onPrev}>
          <span aria-hidden="true">←</span>
          <span>Prev</span>
        </PaginationButton>
        <span aria-hidden="true" className="px-1.5 text-faded-sumi/55">·</span>
        <PaginationButton disabled={!hasNext} loading={isFetchingNext} onClick={onNext}>
          <span>Next</span>
          <span aria-hidden="true">→</span>
        </PaginationButton>
      </div>
    </nav>
  )
}

function PaginationButton({
  disabled,
  loading,
  onClick,
  children,
}: {
  disabled: boolean
  loading?: boolean
  onClick:  () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled || loading === true}
      onClick={onClick}
      className={[
        'ui-motion-colors inline-flex h-8 items-center gap-1.5 rounded-[2px] border px-3 text-sm',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-45',
        disabled
          ? 'border-soft-hairline bg-warm-paper-raised text-faded-sumi'
          : 'border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
