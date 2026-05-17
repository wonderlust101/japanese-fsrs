'use client'

import { TomoSelect } from '@/components/ui/TomoSelect'

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const
export type CardsPageSize = (typeof PAGE_SIZE_OPTIONS)[number]

interface Props {
  pageIndex:        number  // 0-indexed
  pageSize:         CardsPageSize
  totalCount:       number
  onPrev:           () => void
  onNext:           () => void
  onPageSizeChange: (next: CardsPageSize) => void
}

/**
 * Pagination footer for the Cards browser. Page-size selector on the
 * left, Prev / Next + "Showing X–Y of N" on the right. With client-side
 * filtering today, the total count is known; when the cross-deck
 * endpoint lands, swap the totalCount source to the server response and
 * the rest stays the same.
 */
export function CardsPagination({
  pageIndex,
  pageSize,
  totalCount,
  onPrev,
  onNext,
  onPageSizeChange,
}: Props): React.JSX.Element | null {
  if (totalCount <= 0) return null

  const start = pageIndex * pageSize + 1
  const end   = Math.min((pageIndex + 1) * pageSize, totalCount)
  const hasPrev = pageIndex > 0
  const hasNext = end < totalCount

  return (
    <nav
      aria-label="Cards pagination"
      className="mt-5 flex flex-col items-stretch gap-3 border-t border-soft-hairline pt-4 pb-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
            Per page
          </span>
          <TomoSelect
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v) as CardsPageSize)}
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
          {' of '}
          <span className="text-sumi-ink">{totalCount}</span>
        </p>
      </div>

      <div className="flex items-center gap-1">
        <PaginationButton disabled={!hasPrev} onClick={onPrev}>
          <span aria-hidden="true">←</span>
          <span>Prev</span>
        </PaginationButton>
        <span aria-hidden="true" className="px-1.5 text-faded-sumi/55">·</span>
        <PaginationButton disabled={!hasNext} onClick={onNext}>
          <span>Next</span>
          <span aria-hidden="true">→</span>
        </PaginationButton>
      </div>
    </nav>
  )
}

function PaginationButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean
  onClick:  () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'ui-motion-colors inline-flex h-8 items-center gap-1.5 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 text-sm',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-45',
        disabled
          ? 'text-faded-sumi'
          : 'text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
