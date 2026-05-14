'use client'

import { smoothScrollTo } from './smooth-scroll-to'

interface DecksPaginationProps {
  page:           number
  pageSize:       number
  totalCount:     number
  scrollTargetEl: React.RefObject<HTMLElement | null>
  onPageChange:   (next: number) => void
}

/**
 * Editorial pagination footer. Sits below the list. On Prev/Next click, the
 * page transitions and the viewport smoothly scrolls to ~96px above the
 * scrollTargetEl (the bottom edge of the utility row). The 96px offset gives
 * the first row breathing room from the chrome above.
 *
 * Uses a hand-rolled rAF scroll (smoothScrollTo) instead of
 * `scrollIntoView({ behavior: 'smooth' })` to ensure Safari and older Edge
 * behave the same as Chrome. Honors prefers-reduced-motion.
 */
export function DecksPagination({
  page,
  pageSize,
  totalCount,
  scrollTargetEl,
  onPageChange,
}: DecksPaginationProps): React.JSX.Element | null {
  if (totalCount <= pageSize) return null

  const start = (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, totalCount)
  const hasPrev = page > 1
  const hasNext = end < totalCount

  function go(next: number): void {
    onPageChange(next)
    // Defer the scroll one frame so the new page renders first.
    window.requestAnimationFrame(() => {
      const el = scrollTargetEl.current
      if (el === null) return
      const rect = el.getBoundingClientRect()
      // 96px breathing room above the first row.
      const targetY = (window.scrollY ?? window.pageYOffset ?? 0) + rect.top - 96
      smoothScrollTo(Math.max(0, targetY), 320)
    })
  }

  return (
    <nav
      aria-label="Deck list pagination"
      className="mt-6 flex items-center justify-between border-t border-soft-hairline pt-4 pb-12"
    >
      <p className="font-mono text-xs text-faded-sumi tabular-nums">
        Showing{' '}
        <span className="text-sumi-ink">{start}</span>
        {start !== end && (
          <>
            –<span className="text-sumi-ink">{end}</span>
          </>
        )}
        {' of '}
        <span className="text-sumi-ink">{totalCount}</span>
        {' deck'}{totalCount === 1 ? '' : 's'}
      </p>

      <div className="flex items-center gap-1">
        <PaginationButton
          disabled={!hasPrev}
          onClick={() => go(page - 1)}
          direction="prev"
        >
          Prev
        </PaginationButton>
        <span aria-hidden="true" className="px-1.5 text-faded-sumi/55">·</span>
        <PaginationButton
          disabled={!hasNext}
          onClick={() => go(page + 1)}
          direction="next"
        >
          Next
        </PaginationButton>
      </div>
    </nav>
  )
}

function PaginationButton({
  disabled,
  onClick,
  direction,
  children,
}: {
  disabled:  boolean
  onClick:   () => void
  direction: 'prev' | 'next'
  children:  React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        'ui-motion-colors inline-flex items-center gap-1 rounded-[2px] px-2 py-1 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        disabled
          ? 'text-faded-sumi/50 cursor-not-allowed'
          : 'text-sumi-ink hover:bg-cream-inset',
      ].join(' ')}
    >
      {direction === 'prev' && <span aria-hidden="true">←</span>}
      <span>{children}</span>
      {direction === 'next' && <span aria-hidden="true">→</span>}
    </button>
  )
}
