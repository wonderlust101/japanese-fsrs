'use client'

import { TomoSelect } from '@/components/ui/TomoSelect'
import { ToolbarChip } from '@/components/ui/ToolbarChip'

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
  /** Total count from the backend cursor response. Omit for legacy callers. */
  totalCount?:      number | undefined
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
  totalCount,
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
          {totalCount !== undefined && (
            <>
              {' of '}
              <span className="text-sumi-ink">{totalCount}</span>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <ToolbarChip
          size="sm"
          disabled={!hasPrev}
          onClick={onPrev}
          leadingNode={<span>←</span>}
          aria-label="Previous page"
        >
          Prev
        </ToolbarChip>
        <span aria-hidden="true" className="px-1.5 text-faded-sumi/55">·</span>
        <ToolbarChip
          size="sm"
          disabled={!hasNext || isFetchingNext}
          onClick={onNext}
          trailingNode={<span>→</span>}
          aria-label="Next page"
        >
          Next
        </ToolbarChip>
      </div>
    </nav>
  )
}
