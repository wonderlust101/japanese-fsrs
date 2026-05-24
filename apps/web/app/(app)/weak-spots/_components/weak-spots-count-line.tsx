'use client'

import { DecksMenu, MenuItem } from '@/app/(app)/decks/_components/decks-menu'
import type { WeakSpotSortOrder } from '@/lib/actions/weak-spots.actions'

type SortDir = 'asc' | 'desc'

interface Props {
  totalCount:      number
  status:          'unresolved' | 'resolved'
  sort:            WeakSpotSortOrder
  /** Direction override; `null` uses the axis's natural default. */
  sortDir:         SortDir | null
  onPickSort:      (next: WeakSpotSortOrder) => void
  onToggleSortDir: () => void
}

// Sort *axes* (the dropdown). `oldestUnresolved` is intentionally absent: it's
// the date axis read ascending, which the direction toggle now expresses.
const SORT_OPTIONS: ReadonlyArray<{ value: WeakSpotSortOrder; label: string }> = [
  { value: 'mostRecent', label: 'Date flagged' },
  { value: 'mostLapses', label: 'Most lapses'  },
  { value: 'deckOrder',  label: 'Deck order'   },
]

/** Natural (default) direction per axis. Descending for date/lapses (newest /
 *  most first), ascending for deck order. */
function naturalAscFor(sort: WeakSpotSortOrder): boolean {
  return sort === 'oldestUnresolved' || sort === 'deckOrder'
}

/** Human-readable description of the current direction, per axis. */
function directionAdjective(sort: WeakSpotSortOrder, asc: boolean): string {
  if (sort === 'mostLapses') return asc ? 'fewest first' : 'most first'
  if (sort === 'deckOrder')  return asc ? 'ascending'    : 'descending'
  // date axis (mostRecent / oldestUnresolved)
  return asc ? 'oldest first' : 'newest first'
}

/**
 * Result-count line for /weak-spots, the twin of the Cards browser's
 * CardsCountLine: the live count, a direction toggle, and a sort-axis
 * dropdown read as one sentence ("12 weak spots · ↓ Sort by Date flagged").
 * Axis (dropdown) and direction (arrow) are split exactly as on /cards.
 */
export function WeakSpotsCountLine({
  totalCount, status, sort, sortDir, onPickSort, onToggleSortDir,
}: Props): React.JSX.Element {
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Date flagged'
  const effectiveAsc = sortDir === 'asc' ? true : sortDir === 'desc' ? false : naturalAscFor(sort)
  const directionWord = directionAdjective(sort, effectiveAsc)
  const noun = totalCount === 1 ? 'weak spot' : 'weak spots'

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2 font-mono text-sm sm:text-xs text-faded-sumi tabular-nums">
        <span className="whitespace-nowrap">
          <span className="text-sumi-ink">{totalCount}</span>
          {' '}{status === 'resolved' ? 'resolved ' : ''}{noun}
        </span>
        <span aria-hidden="true" className="text-faded-sumi/75">·</span>

        {/* Direction toggle. Leads the sort cue, matching the Cards count
            line: 44px touch target on mobile, 20px on desktop. */}
        <button
          type="button"
          onClick={onToggleSortDir}
          aria-label={`Reverse sort direction (currently ${directionWord})`}
          title={directionWord}
          className="ui-motion-colors inline-flex h-11 w-11 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded-[2px] text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink active:bg-cream-inset focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          <DirGlyph asc={effectiveAsc} />
        </button>

        <DecksMenu
          align="start"
          menuClassName="min-w-[12rem]"
          renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
            <button
              ref={triggerRef}
              type="button"
              onClick={onClick}
              onKeyDown={onKeyDown}
              aria-haspopup="menu"
              aria-expanded={ariaExpanded}
              className="ui-motion-colors inline-flex min-h-[44px] sm:min-h-0 items-center gap-2 rounded-[2px] px-2 -mx-2 sm:px-1 sm:-mx-1 hover:text-sumi-ink active:bg-cream-inset/60 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              <span className="text-faded-sumi">Sort by</span>
              <span className="text-sumi-ink">{sortLabel}</span>
              <Chevron />
            </button>
          )}
          renderItems={({ close }) => (
            <>
              {SORT_OPTIONS.map((opt) => (
                <MenuItem
                  key={opt.value}
                  selected={opt.value === sort}
                  onClick={() => { onPickSort(opt.value); close() }}
                >
                  {opt.label}
                </MenuItem>
              ))}
            </>
          )}
        />
      </div>
    </div>
  )
}

function Chevron(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[11px] w-[11px] sm:h-[9px] sm:w-[9px] text-faded-sumi"
    >
      <path d="M2 4l3 3 3-3" />
    </svg>
  )
}

/** Up arrow for ascending, down arrow for descending. Sized to the
 *  surrounding text, matching the Cards count-line glyph. */
function DirGlyph({ asc }: { asc: boolean }): React.JSX.Element {
  const sharedClass = 'h-[13px] w-[13px] sm:h-[11px] sm:w-[11px]'
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 10 10"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={sharedClass}
    >
      {asc ? <path d="M5 8V2M2.5 4.5L5 2l2.5 2.5" /> : <path d="M5 2v6M2.5 5.5L5 8l2.5-2.5" />}
    </svg>
  )
}
