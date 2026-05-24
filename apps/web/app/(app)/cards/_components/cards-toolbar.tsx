'use client'

import { useRef } from 'react'

import type { CardStatusFilter } from '@fsrs-japanese/shared-types'

import { ToolbarChip } from '@/components/ui/ToolbarChip'
import { IconFilter, IconSort } from '@/components/icons/chrome-marks'
import { DecksMenu, MenuItem } from '@/app/(app)/decks/_components/decks-menu'

import { CardsSearchBar } from './cards-search-bar'
import { CardsViewDropdown } from './cards-view-dropdown'
import { CardsAddFilterMenu } from './cards-add-filter-menu'
import type { CardsFilterState, JlptFilter } from './cards-filter-state'
import type { CardQualityIssue } from './cards-quality-data'

export interface DeckOption {
  id:   string
  name: string
}

interface Props {
  state:           CardsFilterState
  decks:           ReadonlyArray<DeckOption>
  qualityIssues?:  ReadonlyArray<CardQualityIssue> | undefined
  activeViewModified: boolean
  onSearchChange:  (next: string) => void
  onStateChange:   (next: CardsFilterState) => void
  onPickView:      (id: string | null) => void
  /** Controlled state for the Add-filter popover. Lifted to the
   *  orchestrator so a page-level F-keybinding can open the menu
   *  without prop-drilling a ref. */
  addFilterOpen:   boolean
  onAddFilterOpenChange: (next: boolean) => void
  /**
   * Imperative handle: parent stores a function the View dropdown
   * registers, used by the page-level V-keybinding to programmatically
   * click the View trigger. Using a callback-slot pattern (rather than
   * exposing a real React ref to the DecksMenu trigger) avoids
   * forwardRef gymnastics through three layers of render-prop wrappers.
   */
  viewTriggerRef:  React.MutableRefObject<(() => void) | null>
  /** Optional override: when the parent wants to render a mobile-only "Filter" button. */
  onOpenMobileSheet?: (() => void) | undefined
  mobileChipCount?: number | undefined
}

/**
 * Single-row toolbar for /cards. Replaces the previous three-row stack
 * (search · saved views · filter row) with one composed row:
 *
 *   [ View ▾ ]  ⌕ search                  | Deck ▾  JLPT ▾  Status ▾  Sort ▾  + Filter
 *
 * On narrow viewports the right-hand group collapses to a single
 * "Filter (n)" button that opens a bottom sheet (rendered by the
 * parent).
 *
 * State is held in `CardsFilterState`; every control mutates the same
 * object and the parent serializes it to the URL. There is no local
 * "staged" state in this component.
 */
export function CardsToolbar({
  state, decks, qualityIssues, activeViewModified,
  onSearchChange, onStateChange, onPickView,
  addFilterOpen, onAddFilterOpenChange,
  viewTriggerRef,
  onOpenMobileSheet, mobileChipCount = 0,
}: Props): React.JSX.Element {
  const addFilterRef = useRef<HTMLButtonElement | null>(null)

  return (
    <section
      aria-label="Cards toolbar"
      // Deliberate two-row layout on desktop. Row 1 = identity + search
      // ("where am I, what am I searching for"); Row 2 = filter
      // dimensions ("how am I narrowing"). Splitting along the
      // semantic seam means the toolbar's vertical footprint is stable
      // regardless of how long the active view's name happens to be.
      className="flex flex-col gap-3 border-b border-soft-hairline pb-4"
    >
      {/* ── Row 1: identity + search ────────────────────────────────────
          Search uses `flex-1` with no max-width so it expands to the
          container's full right edge, matching row 2's right edge. The
          two rows then share identical left and right gutters and read
          as one rectangular unit. */}
      <div className="flex min-w-0 items-center gap-2">
        <CardsViewDropdown
          activeId={state.viewId}
          modified={activeViewModified}
          qualityIssues={qualityIssues}
          onPick={onPickView}
          triggerRef={viewTriggerRef}
        />
        <div className="min-w-0 flex-1">
          <CardsSearchBar
            value={state.search}
            onChange={onSearchChange}
          />
        </div>
      </div>

      {/* ── Row 2: filter dimensions + Add filter (desktop) ─────────────
          Dimension chips cluster on the left; `+ Add filter` is pushed
          to the right via `ml-auto` so row 2 terminates at the same
          right edge as the search field on row 1. The resulting
          left-cluster / right-action split also reads semantically:
          "existing filters" vs. "discover more". */}
      <div className="hidden flex-wrap items-center gap-2 sm:flex">
        <DeckPicker
          decks={decks}
          deckId={state.deckId}
          onPick={(deckId) => onStateChange({ ...state, deckId })}
        />
        <JlptPicker
          value={state.jlpt}
          onPick={(jlpt) => onStateChange({ ...state, jlpt })}
        />
        <StatusPicker
          value={state.status}
          onPick={(status) => onStateChange({ ...state, status })}
        />
        {/* Sort is rendered on the result-count line, not here — it's
            not a filter, and grouping it with filter dimensions made
            users scan the wrong cluster when looking for sort. The
            count line ('342 cards · Sort by Recently added ▾') puts
            sort next to the counter it actually affects. */}
        <ToolbarChip
          ref={addFilterRef}
          onClick={() => onAddFilterOpenChange(!addFilterOpen)}
          leadingNode={<PlusGlyph />}
          aria-haspopup="dialog"
          aria-expanded={addFilterOpen}
          // `ml-auto` pushes the Add-filter chip to the row's right
          // edge, matching the search field's right edge on row 1 so
          // both rows share identical right gutters.
          className="ml-auto"
        >
          <span className="text-sumi-ink">Add filter</span>
        </ToolbarChip>
        <CardsAddFilterMenu
          open={addFilterOpen}
          anchorRef={addFilterRef}
          state={state}
          onApply={(next) => { onStateChange(next); onAddFilterOpenChange(false) }}
          onClose={() => onAddFilterOpenChange(false)}
        />
      </div>

      {/* ── Right cluster (mobile): single Filter button ──────────────
          Sized as `lg` so the touch target lands at 44px, matching
          WCAG 2.5.5 (AAA). The desktop dropdowns above stay at their
          default `md` height since pointer precision is much higher. */}
      {onOpenMobileSheet !== undefined && (
        <div className="sm:hidden">
          <ToolbarChip
            size="lg"
            onClick={onOpenMobileSheet}
            leadingNode={<IconFilter className="h-3.5 w-3.5 text-faded-sumi" />}
            trailingNode={mobileChipCount > 0 ? (
              <span
                aria-label={`${mobileChipCount} filter${mobileChipCount === 1 ? '' : 's'} active`}
                className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-sumi-ink px-1 text-sm font-semibold text-warm-paper-raised"
              >
                {mobileChipCount}
              </span>
            ) : undefined}
            className="w-full justify-center"
          >
            Filter
          </ToolbarChip>
        </div>
      )}
    </section>
  )
}

// ─── Per-dimension dropdown triggers ────────────────────────────────────

// Menu labels stay short ('N5') because the dropdown header context
// makes the 'JLPT' word redundant inside the menu. The trigger label
// adds the 'JLPT ' prefix at render time when a level is set so a chip
// in the toolbar still reads as 'JLPT N3' (self-identifying without a
// separate prefix slot).
const JLPT_OPTIONS: ReadonlyArray<{ value: JlptFilter; label: string }> = [
  { value: 'all',    label: 'Any JLPT' },
  { value: 'N5',     label: 'N5' },
  { value: 'N4',     label: 'N4' },
  { value: 'N3',     label: 'N3' },
  { value: 'N2',     label: 'N2' },
  { value: 'N1',     label: 'N1' },
  { value: 'beyond', label: 'Beyond JLPT' },
]

const STATUS_OPTIONS: ReadonlyArray<{ value: CardStatusFilter; label: string }> = [
  { value: 'all',       label: 'All statuses' },
  { value: 'new',       label: 'New' },
  { value: 'learning',  label: 'Learning' },
  { value: 'review',    label: 'Review' },
  { value: 'suspended', label: 'Suspended' },
]

// Sort options moved to the new <CountLineSort> component on the
// result-count line. Removed here because Sort is no longer a toolbar
// concern; the toolbar holds filters only.

function JlptPicker({ value, onPick }: { value: JlptFilter; onPick: (v: JlptFilter) => void }): React.JSX.Element {
  const menuLabel = JLPT_OPTIONS.find((o) => o.value === value)?.label ?? 'Any JLPT'
  // Trigger shows the 'JLPT' word when a level is selected so the chip
  // reads 'JLPT N3' rather than the ambiguous 'N3'. At default ('Any
  // JLPT'), the menu label already contains the dimension word.
  const triggerLabel = value === 'all' || value === 'beyond' ? menuLabel : `JLPT ${menuLabel}`
  return (
    <ChromeDropdown
      label={triggerLabel}
      icon={<IconSort className="h-3.5 w-3.5 text-faded-sumi" />}
      selected={value !== 'all'}
      options={JLPT_OPTIONS}
      activeValue={value}
      onPick={onPick}
    />
  )
}

function StatusPicker({ value, onPick }: { value: CardStatusFilter; onPick: (v: CardStatusFilter) => void }): React.JSX.Element {
  const current = STATUS_OPTIONS.find((o) => o.value === value)?.label ?? 'All statuses'
  return (
    <ChromeDropdown
      label={current}
      selected={value !== 'all'}
      options={STATUS_OPTIONS}
      activeValue={value}
      onPick={onPick}
    />
  )
}

function DeckPicker({
  decks, deckId, onPick,
}: {
  decks:  ReadonlyArray<DeckOption>
  deckId: string | 'all'
  onPick: (next: string | 'all') => void
}): React.JSX.Element {
  const currentName = deckId === 'all'
    ? 'All decks'
    : (decks.find((d) => d.id === deckId)?.name ?? 'Unknown deck')
  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[14rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <ToolbarChip
          ref={triggerRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          state={deckId !== 'all' ? 'selected' : 'default'}
          className="max-w-[12rem]"
          trailingNode={<Chevron />}
        >
          {/* No 'Deck' prefix word: 'All decks' / a deck name both read
              as deck-scoped on their own, and the dropdown chevron
              already signals "filter". Truncate to keep long deck
              names from blowing out the row width. */}
          <span className="text-sumi-ink truncate">{currentName}</span>
        </ToolbarChip>
      )}
      renderItems={({ close }) => (
        <>
          <MenuItem selected={deckId === 'all'} onClick={() => { onPick('all'); close() }}>
            All decks
          </MenuItem>
          {decks.length > 0 && <div className="my-1 h-px bg-soft-hairline" aria-hidden="true" />}
          {decks.map((d) => (
            <MenuItem key={d.id} selected={d.id === deckId} onClick={() => { onPick(d.id); close() }}>
              {d.name}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

interface ChromeDropdownProps<T extends string> {
  label:       string
  icon?:       React.ReactNode | undefined
  selected:    boolean
  options:     ReadonlyArray<{ value: T; label: string }>
  activeValue: T
  onPick:      (value: T) => void
}

function ChromeDropdown<T extends string>({
  label, icon, selected, options, activeValue, onPick,
}: ChromeDropdownProps<T>): React.JSX.Element {
  return (
    <DecksMenu
      align="start"
      menuClassName="min-w-[12rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <ToolbarChip
          ref={triggerRef}
          onClick={onClick}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          state={selected ? 'selected' : 'default'}
          leadingNode={icon}
          trailingNode={<Chevron />}
        >
          {/* Single-span label: the chip's left edge is right next to
              the value, no "<dim>: " gap eating horizontal real estate.
              The dropdown chevron + the value text carry the meaning. */}
          <span className="text-sumi-ink whitespace-nowrap">{label}</span>
        </ToolbarChip>
      )}
      renderItems={({ close }) => (
        <>
          {options.map((opt) => (
            <MenuItem
              key={opt.value}
              selected={opt.value === activeValue}
              onClick={() => { onPick(opt.value); close() }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </>
      )}
    />
  )
}

// ─── Glyphs ─────────────────────────────────────────────────────────────

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

function PlusGlyph(): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      width="11"
      height="11"
      viewBox="0 0 11 11"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="text-faded-sumi"
    >
      <path d="M5.5 2v7M2 5.5h7" />
    </svg>
  )
}
