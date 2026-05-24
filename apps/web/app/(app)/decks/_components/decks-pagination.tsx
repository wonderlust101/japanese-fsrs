'use client'

import { TomoSelect } from '@/components/ui/TomoSelect'
import { ToolbarChip } from '@/components/ui/ToolbarChip'

import { smoothScrollTo } from './smooth-scroll-to'

export const DECKS_PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const
export type DecksPageSize = (typeof DECKS_PAGE_SIZE_OPTIONS)[number]

interface Props {
  /** 1-indexed current page. */
  page:             number
  pageSize:         DecksPageSize
  totalCount:       number
  scrollTargetEl:   React.RefObject<HTMLElement | null>
  /** Caller takes a 1-indexed page number. */
  onPickPage:       (nextPage: number) => void
  onPrev:           () => void
  onNext:           () => void
  onPageSizeChange: (next: DecksPageSize) => void
}

/**
 * Editorial pagination footer for the Deck list. Mirrors the Cards
 * browser's pagination layout (per-page selector, numbered pages with
 * ellipsis window, Prev/Next chips, Showing X-Y of N) so the two list
 * surfaces feel like siblings.
 *
 * Adds one deck-specific touch the cards page doesn't need: a smooth
 * scroll back to the top of the utility row on every page change, so
 * the first row of the new page is comfortably above the fold.
 */
export function DecksPagination({
  page,
  pageSize,
  totalCount,
  scrollTargetEl,
  onPickPage,
  onPrev,
  onNext,
  onPageSizeChange,
}: Props): React.JSX.Element | null {
  if (totalCount <= 0) return null

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const start      = (page - 1) * pageSize + 1
  const end        = Math.min(page * pageSize, totalCount)
  const hasPrev    = page > 1
  const hasNext    = page < totalPages

  const visiblePages = buildVisiblePages(page, totalPages)

  function scrollToTop(): void {
    window.requestAnimationFrame(() => {
      const el = scrollTargetEl.current
      if (el === null) return
      const rect    = el.getBoundingClientRect()
      const targetY = (window.scrollY ?? window.pageYOffset ?? 0) + rect.top - 96
      smoothScrollTo(Math.max(0, targetY), 320)
    })
  }

  function pickPage(next: number): void {
    if (next === page) return
    onPickPage(next)
    scrollToTop()
  }
  function prev(): void {
    if (!hasPrev) return
    onPrev()
    scrollToTop()
  }
  function next(): void {
    if (!hasNext) return
    onNext()
    scrollToTop()
  }

  return (
    <nav
      aria-label="Deck list pagination"
      className="mt-6 flex flex-col items-stretch gap-3 border-t border-soft-hairline pt-4 pb-12 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
    >
      {/* ── Per-page selector. Mobile: nav row first (order-1), this
          second. Desktop: per-page first. */}
      <div className="order-2 flex items-center gap-2 sm:order-1">
        <span className="hidden font-mono text-sm text-faded-sumi sm:inline">
          Per page
        </span>
        <TomoSelect
          value={String(pageSize)}
          onValueChange={(v) => onPageSizeChange(Number(v) as DecksPageSize)}
          options={DECKS_PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
          ariaLabel="Decks per page"
          className="min-w-[4.5rem] min-h-11 sm:min-h-0"
        />
      </div>

      {/* ── Prev / numbered pages / Next ──────────────────────────────── */}
      <div className="order-1 flex items-stretch gap-1 sm:order-2 sm:items-center">
        <ToolbarChip
          size="sm"
          disabled={!hasPrev}
          onClick={prev}
          leadingNode={<ArrowLeftGlyph />}
          aria-label="Previous page"
          className="shrink-0 min-h-11 sm:min-h-0"
        >
          <span className="hidden sm:inline">Prev</span>
        </ToolbarChip>

        <div
          className={[
            'flex flex-1 items-center gap-1 overflow-x-auto sm:flex-none sm:overflow-visible',
            '[mask-image:linear-gradient(to_right,black_0%,black_calc(100%-1.5rem),transparent_100%)]',
            'sm:[mask-image:none]',
          ].join(' ')}
        >
          {visiblePages.map((token, idx) =>
            token === '…' ? (
              <span
                key={`gap-${idx}`}
                aria-hidden="true"
                className="shrink-0 px-1.5 font-mono text-xs text-faded-sumi/60"
              >
                …
              </span>
            ) : (
              <ToolbarChip
                key={token}
                size="sm"
                state={token === page ? 'selected' : 'default'}
                onClick={() => pickPage(token)}
                aria-label={`Page ${token}`}
                aria-current={token === page ? 'page' : undefined}
                className="shrink-0 min-w-[2.25rem] justify-center tabular-nums min-h-11 sm:min-h-0 sm:min-w-[2rem]"
              >
                {token}
              </ToolbarChip>
            ),
          )}
        </div>

        <ToolbarChip
          size="sm"
          disabled={!hasNext}
          onClick={next}
          trailingNode={<ArrowRightGlyph />}
          aria-label="Next page"
          className="shrink-0 min-h-11 sm:min-h-0"
        >
          <span className="hidden sm:inline">Next</span>
        </ToolbarChip>
      </div>

      {/* ── Desktop-only "Showing X–Y of N decks" ─────────────────────── */}
      <p className="order-3 hidden font-mono text-xs text-faded-sumi tabular-nums sm:inline-block">
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
        {' deck'}{totalCount === 1 ? '' : 's'}
      </p>
    </nav>
  )
}

// ── Page-window calculation (current ± 2, always with first & last) ────

function buildVisiblePages(current: number, total: number): ReadonlyArray<number | '…'> {
  if (total <= 1) return [1]

  const window = 2
  const pages = new Set<number>([1, total])
  for (let p = current - window; p <= current + window; p += 1) {
    if (p >= 1 && p <= total) pages.add(p)
  }

  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | '…')[] = []
  for (let i = 0; i < sorted.length; i += 1) {
    const page = sorted[i]
    if (page === undefined) continue
    if (i > 0) {
      const prev = sorted[i - 1]
      if (prev !== undefined && page - prev > 1) {
        out.push('…')
      }
    }
    out.push(page)
  }
  return out
}

// ── Inline glyphs ──────────────────────────────────────────────────────

function ArrowLeftGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 2L3 5l4 3" />
    </svg>
  )
}

function ArrowRightGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 2l4 3-4 3" />
    </svg>
  )
}
