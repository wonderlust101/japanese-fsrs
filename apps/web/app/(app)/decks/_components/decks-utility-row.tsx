'use client'

import { forwardRef, useEffect, useRef } from 'react'

import {
  IconEdit,
  IconFilter,
  IconSearch,
  IconSort,
} from '@/components/icons/chrome-marks'

import { DecksMenu, MenuItem } from './decks-menu'
import type { DecksSortKey, DecksTypeFilter } from './use-deck-prefs'

const SORT_LABEL: Record<DecksSortKey, string> = {
  'study-order':        'Study order',
  'recently-reviewed':  'Recently reviewed',
  'alphabetical':       'Alphabetical',
  'most-due-first':     'Most due first',
  'jlpt-level':         'JLPT level',
}

const SORT_ORDER: ReadonlyArray<DecksSortKey> = [
  'study-order',
  'recently-reviewed',
  'alphabetical',
  'most-due-first',
  'jlpt-level',
]

const TYPE_LABEL: Record<DecksTypeFilter, string> = {
  all:        'All types',
  vocabulary: 'Vocabulary',
  kanji:      'Kanji',
  mixed:      'Mixed',
}

const TYPE_ORDER: ReadonlyArray<DecksTypeFilter> = ['all', 'vocabulary', 'kanji', 'mixed']

interface DecksUtilityRowProps {
  sort:          DecksSortKey
  typeFilter:    DecksTypeFilter
  searchQuery:   string
  curateActive:  boolean
  onSort:        (sort: DecksSortKey) => void
  onTypeFilter:  (filter: DecksTypeFilter) => void
  onSearchQuery: (query: string) => void
  onCurate:      () => void
}

export function DecksUtilityRow({
  sort,
  typeFilter,
  searchQuery,
  curateActive,
  onSort,
  onTypeFilter,
  onSearchQuery,
  onCurate,
}: DecksUtilityRowProps): React.JSX.Element {
  const searchRef = useRef<HTMLInputElement | null>(null)

  // ⌘K (or Ctrl+K outside macOS) focuses the search input.
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'k') {
        // Don't hijack the browser's URL bar shortcut on Firefox where it
        // overlaps; if focus is in an input that isn't ours, let it through.
        const active = document.activeElement
        if (active instanceof HTMLInputElement && active !== searchRef.current) return
        event.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <section
      aria-label="Deck list controls"
      className="flex flex-col gap-3 border-t border-soft-hairline pt-4 pb-4 sm:flex-row sm:items-center sm:gap-3 sm:py-4"
    >
      {/* Left cluster: sort / type. Archived tab handles archive view. */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SortDropdown current={sort} onChange={onSort} />
        <TypeDropdown current={typeFilter} onChange={onTypeFilter} />
      </div>

      {/* Right cluster: search + curate. min-w-0 prevents the search from
          pushing the row off-screen on narrow desktop windows. */}
      <div className="flex flex-1 items-center justify-end gap-2 sm:min-w-[18rem]">
        <SearchInput
          ref={searchRef}
          value={searchQuery}
          onChange={onSearchQuery}
        />
        <CurateButton active={curateActive} onClick={onCurate} />
      </div>
    </section>
  )
}

// ── Sort ─────────────────────────────────────────────────────────────────

function SortDropdown({
  current,
  onChange,
}: {
  current:  DecksSortKey
  onChange: (sort: DecksSortKey) => void
}): React.JSX.Element {
  return (
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
          className={[
            'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised pl-2.5 pr-2.5 text-sm text-sumi-ink',
            'hover:border-faded-sumi hover:bg-cream-inset',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          <IconSort className="h-3.5 w-3.5 text-faded-sumi" />
          <span className="hidden text-faded-sumi sm:inline">Sort</span>
          <span className="text-sumi-ink">{SORT_LABEL[current]}</span>
          <Chevron />
        </button>
      )}
      renderItems={({ close }) => (
        <>
          {SORT_ORDER.map((key) => (
            <MenuItem
              key={key}
              selected={key === current}
              onClick={() => { onChange(key); close() }}
            >
              {SORT_LABEL[key]}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

// ── Type filter ──────────────────────────────────────────────────────────

function TypeDropdown({
  current,
  onChange,
}: {
  current:  DecksTypeFilter
  onChange: (filter: DecksTypeFilter) => void
}): React.JSX.Element {
  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[10rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <button
          ref={triggerRef}
          type="button"
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          className={[
            'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised pl-2.5 pr-2.5 text-sm text-sumi-ink',
            'hover:border-faded-sumi hover:bg-cream-inset',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          <IconFilter className="h-3.5 w-3.5 text-faded-sumi" />
          <span className="text-sumi-ink">{TYPE_LABEL[current]}</span>
          <Chevron />
        </button>
      )}
      renderItems={({ close }) => (
        <>
          {TYPE_ORDER.map((key) => (
            <MenuItem
              key={key}
              selected={key === current}
              onClick={() => { onChange(key); close() }}
            >
              {TYPE_LABEL[key]}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

// ── Search ───────────────────────────────────────────────────────────────

interface SearchInputProps {
  value:    string
  onChange: (next: string) => void
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange }, ref) {
    return (
      <div className="relative flex-1 sm:max-w-[20rem]">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faded-sumi"
        >
          <IconSearch className="h-3.5 w-3.5" />
        </span>
        <input
          ref={ref}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Find a deck"
          aria-label="Find a deck"
          className={[
            'ui-motion-colors w-full h-9 rounded-[2px] border border-soft-hairline bg-cream-inset pl-8 pr-16 text-sm text-sumi-ink placeholder:text-faded-sumi',
            'hover:border-faded-sumi',
            'focus:outline focus:outline-1 focus:outline-sumi-ink focus:outline-offset-2',
            '[&::-webkit-search-cancel-button]:appearance-none',
            '[&::-webkit-search-decoration]:appearance-none',
          ].join(' ')}
        />
        <kbd
          aria-hidden="true"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-1.5 font-mono text-[0.625rem] tracking-tight text-faded-sumi sm:inline-flex"
        >
          ⌘K
        </kbd>
      </div>
    )
  },
)

// ── Curate ───────────────────────────────────────────────────────────────

function CurateButton({
  active,
  onClick,
}: {
  active:  boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-[2px] pl-2.5 pr-3 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        active
          ? 'bg-sumi-ink text-warm-paper-raised hover:bg-sumi-ink/95'
          : 'border border-soft-hairline bg-warm-paper-raised text-sumi-ink hover:border-faded-sumi hover:bg-cream-inset',
      ].join(' ')}
    >
      <IconEdit className="h-3.5 w-3.5" />
      <span>{active ? 'Done' : 'Curate'}</span>
    </button>
  )
}

// ── Shared chrome ────────────────────────────────────────────────────────

function Chevron(): React.JSX.Element {
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
      className="text-faded-sumi"
    >
      <path d="M2 4l3 3 3-3" />
    </svg>
  )
}
