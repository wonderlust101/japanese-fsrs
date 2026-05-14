'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { ApiDeck } from '@fsrs-japanese/shared-types'

import { IconFlag } from '@/components/icons/chrome-marks'
import { ContentTypePill, JlptPill } from '@/components/ui/Pill'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckAction } from '@/lib/actions/decks.actions'
import { inferDeckLevel } from '@/lib/deck-level'

import { DeckRowKebab } from './deck-row-kebab'
import { DragHandle } from './deck-drag-handle'

export interface DeckCardProps {
  /** The deck (server payload). */
  deck: ApiDeck

  /** Display name (may differ from deck.name when a local rename override is active). */
  displayName: string

  /** Slot index in the resolved study order, 1-based. Null for archived decks. */
  slotIndex: number | null

  /** Row's display index in the current view (drives the page-enter stagger). */
  viewIndex: number

  /** Is this the user's priority deck (slot 01 of the study order)? */
  isPriority: boolean

  /** Is this deck currently archived? */
  isArchived: boolean

  /** Curate mode active for the whole page. */
  curateMode: boolean

  /** Is this row selected in curate mode? */
  selected: boolean

  /** Drag is meaningful (curate + sort=study-order); otherwise the handle is inert. */
  dragEnabled: boolean

  /** Toggle selection in curate mode. */
  onToggleSelect: () => void

  /** Per-row actions surfaced by the kebab. */
  onSetAsPriority:  () => void
  onRename:         () => void
  onCopy:           () => void
  onEditOptions:    () => void
  onArchive:        () => void
  onRestore:        () => void
  onDelete:         () => void
  onMoveUp:         () => void
  onMoveDown:       () => void

  /** Drag handle pointer-down: orchestrator owns the drag state machine. */
  onDragHandleDown: (event: React.PointerEvent<HTMLButtonElement>) => void

  /** Is this row currently being dragged (for visual lift). */
  isDragging: boolean

  /** Is this row currently the drop target indicator under the cursor. */
  isDropTarget: boolean

  /** Can the user move this deck up/down in the kebab menu? */
  canMoveUp:   boolean
  canMoveDown: boolean
}

export function DeckCard(props: DeckCardProps): React.JSX.Element {
  const {
    deck,
    displayName,
    slotIndex,
    viewIndex,
    isPriority,
    isArchived,
    curateMode,
    selected,
    dragEnabled,
    onToggleSelect,
    isDragging,
    isDropTarget,
  } = props

  // Per-deck stats. The list endpoint returns deck names + cardCount but not
  // due/new rollups, so we fetch each deck's detail on demand. Skeleton state
  // for the stats appears inline below.
  const { data: stats } = useQuery({
    queryKey: queryKeys.decks.detail(deck.id),
    queryFn:  () => getDeckAction(deck.id),
  })

  const cardCount = stats?.cardCount ?? deck.cardCount
  const dueCount  = stats?.dueCount  ?? 0
  const newCount  = stats?.newCount  ?? deck.cardCount
  const progress  = cardCount > 0 ? Math.round(((cardCount - newCount) / cardCount) * 100) : 0
  const level     = inferDeckLevel(deck)
  const deckType  = deck.deckType

  // ── Outer wrapper element ─────────────────────────────────────────────
  // In default mode, the row is a navigation link to the deck detail page.
  // In curate mode, the row is a selectable button; clicking toggles the
  // checkbox in the index column. We still want keyboard accessibility, so
  // we render real <Link> / <button> elements (no role hacks).

  const stripeTone = isArchived
    ? 'transparent'
    : curateMode
      ? 'var(--color-faded-sumi)'
      : 'var(--color-inari-vermillion)'

  const cardTone = isArchived
    ? 'bg-warm-paper-raised/60'
    : 'bg-warm-paper-raised'

  const liftClasses = isDragging
    ? 'translate-y-[-2px] shadow-[0_8px_22px_rgba(70,30,35,0.10)]'
    : ''

  const dropTargetClasses = isDropTarget && !isDragging
    ? 'before:absolute before:left-0 before:right-0 before:top-[-3px] before:h-px before:bg-inari-vermillion'
    : ''

  return (
    <div
      data-deck-id={deck.id}
      className={[
        'animate-page-enter relative',
        liftClasses,
        dropTargetClasses,
        'transition-[transform,box-shadow] duration-200 ease-out',
      ].join(' ')}
      style={{ animationDelay: `${Math.min(viewIndex, 12) * 40}ms` }}
    >
      {/* The card itself: 2px corners, 1px Soft Hairline (left/right/bottom),
          2px Inari Vermillion top stripe, no shadow at rest. Per DESIGN.md
          "Flat-Card Rule" and "Deck Card (List-Row)" spec. */}
      <div
        className={[
          'group relative rounded-[2px] border-l border-r border-b border-soft-hairline',
          cardTone,
          'overflow-hidden',
          curateMode && selected ? 'ring-1 ring-inari-vermillion ring-offset-0' : '',
        ].join(' ')}
      >
        {/* Top stripe. Negative offsets carry through the rounded-2px corners. */}
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-[2px]"
          style={{ backgroundColor: stripeTone }}
        />

        <div className="flex">
          {/* Leading column: study-order index or curate-mode controls.
              On desktop the column is 56px wide; on mobile 44px. The 1px
              hairline divider on the right separates the column from the
              deck content. */}
          <LeadingColumn
            slotIndex={slotIndex}
            isPriority={isPriority}
            isArchived={isArchived}
            curateMode={curateMode}
            selected={selected}
            dragEnabled={dragEnabled}
            onDragHandleDown={props.onDragHandleDown}
            onToggleSelect={onToggleSelect}
          />

          {/* The content surface. Wraps as a Link in default mode (whole-card
              click navigates) or as a button in curate mode (whole-card click
              toggles selection). Keeps the kebab from triggering navigation. */}
          <DeckRowSurface
            href={`/decks/${deck.id}`}
            curateMode={curateMode}
            onClick={curateMode ? onToggleSelect : undefined}
            ariaLabel={`${displayName}, deck${slotIndex !== null ? `, slot ${formatSlot(slotIndex)}` : ''}`}
          >
            {/* Title row: name + content-type pill + level pill + kebab */}
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={[
                    'min-w-0 truncate text-base font-medium',
                    isArchived ? 'text-faded-sumi' : 'text-sumi-ink',
                  ].join(' ')}
                >
                  {displayName}
                </span>
                {deckType !== undefined && (
                  <ContentTypePill
                    type={deckType === 'kanji' ? 'kanji' : deckType === 'mixed' ? 'mixed' : 'vocabulary'}
                    size="sm"
                  />
                )}
                {level !== null && !isArchived && <JlptPill level={level} size="sm" />}
                {isArchived && (
                  <span className="rounded-[2px] border border-soft-hairline bg-cream-inset px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-faded-sumi">
                    Archived
                  </span>
                )}
                {deck.isPremadeFork && !isArchived && (
                  <span className="rounded-[2px] border border-soft-hairline bg-cream-inset px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-faded-sumi">
                    Subscribed
                  </span>
                )}
              </div>
              {!curateMode && (
                <DeckRowKebab
                  isPriority={isPriority}
                  isArchived={isArchived}
                  canMoveUp={props.canMoveUp}
                  canMoveDown={props.canMoveDown}
                  onSetAsPriority={props.onSetAsPriority}
                  onRename={props.onRename}
                  onCopy={props.onCopy}
                  onEditOptions={props.onEditOptions}
                  onArchive={props.onArchive}
                  onRestore={props.onRestore}
                  onDelete={props.onDelete}
                  onMoveUp={props.onMoveUp}
                  onMoveDown={props.onMoveDown}
                />
              )}
            </div>

            {/* Description (single-line). Hidden if missing. */}
            {deck.description !== null && deck.description.trim().length > 0 && (
              <p className="mt-1 truncate text-sm text-faded-sumi">{deck.description}</p>
            )}

            {/* Stats row */}
            <div className="mt-2.5 flex items-center gap-3 font-mono text-xs text-faded-sumi tabular-nums">
              <span>
                <span className="text-sumi-ink/85">{cardCount}</span>{' '}cards
              </span>
              {stats !== undefined && stats !== null ? (
                <>
                  <Dot />
                  <span className={dueCount > 0 ? 'text-inari-vermillion-deep' : ''}>
                    <span className={dueCount > 0 ? 'font-medium' : ''}>{dueCount}</span>{' '}due
                  </span>
                  <Dot />
                  <span>
                    <span className="text-sumi-ink/85">{newCount}</span>{' '}new
                  </span>
                </>
              ) : (
                <>
                  <Dot />
                  <SkelBar />
                  <Dot />
                  <SkelBar />
                </>
              )}
              <span className="ml-auto" />
              {!isArchived && stats !== undefined && stats !== null && (
                <span className="hidden sm:inline">
                  <span className="text-sumi-ink/85">{progress}</span>%{' '}mastery
                </span>
              )}
            </div>

            {/* Progress bar: h-[3px] track on Cream Inset, fill on Vermillion.
                The 1px tall (well, 3px) bar is the one acceptable place for
                full-saturation Vermillion at a small surface area, per
                DESIGN.md §"Deck Card (List-Row)". */}
            {!isArchived && (
              <div
                aria-hidden="true"
                className="mt-2.5 h-[3px] w-full overflow-hidden bg-cream-inset"
              >
                <div
                  className="h-full bg-inari-vermillion transition-[width] duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </DeckRowSurface>
        </div>
      </div>
    </div>
  )
}

// ── Subcomponents ────────────────────────────────────────────────────────

function LeadingColumn({
  slotIndex,
  isPriority,
  isArchived,
  curateMode,
  selected,
  dragEnabled,
  onDragHandleDown,
  onToggleSelect,
}: {
  slotIndex:        number | null
  isPriority:       boolean
  isArchived:       boolean
  curateMode:       boolean
  selected:         boolean
  dragEnabled:      boolean
  onDragHandleDown: (event: React.PointerEvent<HTMLButtonElement>) => void
  onToggleSelect:   () => void
}): React.JSX.Element {
  if (curateMode) {
    return (
      <div className="flex w-[3.5rem] shrink-0 flex-col items-center justify-center gap-1.5 border-r border-soft-hairline bg-cream-inset/40 px-1.5 py-3 sm:w-16">
        <DragHandle
          onPointerDown={onDragHandleDown}
          disabled={!dragEnabled}
          ariaLabel={dragEnabled ? 'Drag to reorder' : 'Reordering requires Study order sort'}
        />
        <button
          type="button"
          role="checkbox"
          aria-checked={selected}
          onClick={(e) => { e.stopPropagation(); onToggleSelect() }}
          className={[
            'ui-motion-colors flex h-5 w-5 items-center justify-center rounded-[2px] border',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
            selected
              ? 'border-inari-vermillion bg-inari-vermillion text-warm-paper-raised'
              : 'border-soft-hairline bg-warm-paper-raised hover:border-faded-sumi',
          ].join(' ')}
        >
          {selected && (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <path d="M2 5.5 L4.5 8 L9 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="flex w-[2.75rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-soft-hairline bg-cream-inset/40 px-1 py-3 sm:w-14">
      {isPriority && (
        <span
          aria-hidden="true"
          className="text-inari-vermillion"
          title="Priority deck"
        >
          <IconFlag className="h-4 w-4" />
        </span>
      )}
      {slotIndex !== null && (
        <span
          className={[
            'font-mono text-sm font-medium tabular-nums leading-none',
            isPriority ? 'text-inari-vermillion' : 'text-faded-sumi',
          ].join(' ')}
        >
          {formatSlot(slotIndex)}
        </span>
      )}
      {isArchived && (
        <span className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-faded-sumi/60">
          arc
        </span>
      )}
    </div>
  )
}

interface DeckRowSurfaceProps {
  href:       string
  curateMode: boolean
  onClick?:   (() => void) | undefined
  ariaLabel:  string
  children:   React.ReactNode
}

function DeckRowSurface({ href, curateMode, onClick, ariaLabel, children }: DeckRowSurfaceProps): React.JSX.Element {
  const sharedClass = [
    'ui-motion-colors block flex-1 min-w-0 px-4 py-3.5 sm:px-5 sm:py-4',
    'hover:bg-cream-inset/35 focus-visible:bg-cream-inset',
    'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px]',
  ].join(' ')

  if (curateMode) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        className={`${sharedClass} text-left`}
      >
        {children}
      </button>
    )
  }

  return (
    <Link href={href} className={sharedClass} aria-label={ariaLabel}>
      {children}
    </Link>
  )
}

function Dot(): React.JSX.Element {
  return <span aria-hidden="true" className="text-faded-sumi/45">·</span>
}

function SkelBar(): React.JSX.Element {
  return (
    <span aria-hidden="true" className="inline-block h-3 w-8 animate-pulse rounded-[1px] bg-cream-inset align-middle" />
  )
}

function formatSlot(slot: number): string {
  return String(slot).padStart(2, '0')
}
