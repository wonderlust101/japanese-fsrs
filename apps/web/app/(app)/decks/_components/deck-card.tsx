'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { ApiDeck } from '@fsrs-japanese/shared-types'

import { IconFlag } from '@/components/icons/chrome-marks'
import { queryKeys } from '@/lib/api/queryKeys'
import { getDeckAction } from '@/lib/actions/decks.actions'

import { DeckRowKebab } from './deck-row-kebab'
import { DragHandle } from './deck-drag-handle'

export interface DeckCardProps {
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

  /** Drag is meaningful (study-order sort + not showing archived). */
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

/**
 * Editorial deck row. Wide horizontal row, four-slot anatomy:
 *
 *   [leading slot]  [identity + quiet metadata]  [chip-or-state]  [primary action + kebab]
 *
 * Brand identity device (2px vermillion top stripe + leading slot column with
 * priority flag + slot index) is preserved — that's the Tomo register, not
 * decoration. What we strip is everything else: content-type pill, JLPT pill,
 * dot-separated stats line, mastery progress bar. The right side carries one
 * weighty signal: the due count (or a state word that replaces it), plus a
 * visible primary CTA.
 */
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

  // Per-deck stats. The list endpoint returns names + cardCount but not
  // due/new rollups, so we fetch each deck's detail on demand.
  const { data: stats } = useQuery({
    queryKey: queryKeys.decks.detail(deck.id),
    queryFn:  () => getDeckAction(deck.id),
  })

  const statsLoaded    = stats !== undefined && stats !== null
  const cardCount      = stats?.cardCount      ?? deck.cardCount
  const dueCount       = stats?.dueCount       ?? 0
  const matureCount    = stats?.matureCount    ?? 0
  const dueNewCount    = stats?.dueNewCount    ?? 0
  const dueReviewCount = stats?.dueReviewCount ?? 0
  // % learned = mature cards / total. Anki convention: a card is "mature" when
  // its scheduled interval is ≥ 21 days. Tells the user how much of the deck
  // is internalised (not just "seen at least once").
  const learnedPercent = cardCount > 0 ? Math.round((matureCount / cardCount) * 100) : 0

  const stripeTone = isArchived
    ? 'transparent'
    : curateMode
      ? 'var(--color-faded-sumi)'
      : 'var(--color-inari-vermillion)'

  const cardTone = isArchived ? 'bg-warm-paper-raised/60' : 'bg-warm-paper-raised'

  const liftClasses = isDragging
    ? 'translate-y-[-2px] shadow-[0_8px_22px_rgba(70,30,35,0.10)]'
    : ''

  const dropTargetClasses = isDropTarget && !isDragging
    ? 'before:absolute before:left-0 before:right-0 before:top-[-3px] before:h-px before:bg-inari-vermillion'
    : ''

  // Right-side primary action: Study when there's due work, Open otherwise.
  // The whole row remains a link to the detail page (keyboard-equivalent).
  const primaryAction = resolvePrimaryAction({ deckId: deck.id, dueCount, isArchived })

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
      <div
        className={[
          'group relative rounded-[2px] border-l border-r border-b border-soft-hairline',
          cardTone,
          'overflow-hidden',
          curateMode && selected ? 'ring-1 ring-inari-vermillion ring-offset-0' : '',
        ].join(' ')}
      >
        {/* Brand identity stripe. */}
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-[2px]"
          style={{ backgroundColor: stripeTone }}
        />

        <div className="flex">
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

          <DeckRowSurface
            href={`/decks/${deck.id}`}
            curateMode={curateMode}
            onClick={curateMode ? onToggleSelect : undefined}
            ariaLabel={`${displayName}, deck${slotIndex !== null ? `, slot ${formatSlot(slotIndex)}` : ''}`}
          >
            {/*
              2-row grid so the top lines (deck name | due count) sit on the
              same horizontal line and the bottom lines (cards count |
              new/review breakdown) sit on theirs. Action cluster spans both
              rows and centres vertically against the stack.

              Columns: [identity 1fr][chip auto][action auto]
              Rows:    [top auto][bottom auto]
            */}
            <div
              className={[
                'grid min-w-0 items-center',
                'grid-cols-[minmax(0,1fr)_auto_auto] gap-x-4 gap-y-1.5',
                'sm:gap-x-6 md:gap-x-8 lg:gap-x-10',
              ].join(' ')}
            >
              {/* Row 1, col 1 — deck name + optional Archived label */}
              <div className="col-start-1 row-start-1 flex min-w-0 items-baseline gap-2">
                <span
                  className={[
                    'min-w-0 truncate text-lg font-medium leading-tight',
                    isArchived ? 'text-faded-sumi' : 'text-sumi-ink',
                  ].join(' ')}
                >
                  {displayName}
                </span>
                {isArchived && (
                  <span className="shrink-0 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
                    Archived
                  </span>
                )}
              </div>

              {/* Row 2, col 1 — cards-count metadata */}
              <p className="col-start-1 row-start-2 truncate font-mono text-xs leading-tight text-faded-sumi tabular-nums">
                <span className="text-sumi-ink/80">{cardCount}</span>
                {' '}{cardCount === 1 ? 'card' : 'cards'}
              </p>

              {/* Rows 1+2, col 2 — chip-or-state.
                  Renders into both grid cells so the due number aligns with
                  the deck name (row 1) and the new/review breakdown aligns
                  with the cards count (row 2). */}
              <ChipOrState
                isArchived={isArchived}
                statsLoaded={statsLoaded}
                dueCount={dueCount}
                dueNewCount={dueNewCount}
                dueReviewCount={dueReviewCount}
              />

              {/* Rows 1+2, col 3 — action cluster.
                  Spans both rows so it vertically centres against the
                  two-line stack to its left. */}
              {!curateMode && (
                <div className="col-start-3 row-span-2 flex shrink-0 items-center gap-2 sm:gap-3">
                  <PrimaryActionLink
                    href={primaryAction.href}
                    label={primaryAction.label}
                    tone={primaryAction.tone}
                  />
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
                </div>
              )}
            </div>
          </DeckRowSurface>
        </div>

        {/* Bottom progress unit: a caption strip + a full-bleed track. The
            caption tells the user what the bar measures; the bar visualises
            it. Together they read as a labelled chart axis at the foot of
            the card. */}
        {!isArchived && statsLoaded && cardCount > 0 && (
          <div className="border-t border-soft-hairline">
            <div className="flex items-baseline justify-between gap-2 px-4 pt-2 pb-1.5 sm:px-6">
              <span className="font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi">
                Mature
              </span>
              <span className="font-mono text-[0.6875rem] tabular-nums text-faded-sumi">
                <span className="text-sumi-ink/80">{matureCount}</span>
                <span className="text-faded-sumi/70">{' / '}</span>
                <span className="text-sumi-ink/80">{cardCount}</span>
                <span className="text-faded-sumi/70">{'  '}</span>
                <span className="text-sumi-ink uppercase tracking-[0.12em]">({learnedPercent}%)</span>
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${learnedPercent}% of ${cardCount} cards mature`}
              aria-valuenow={learnedPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-3 w-full overflow-hidden bg-soft-hairline/70"
            >
              <div
                className="h-full bg-inari-vermillion transition-[width] duration-300 ease-out"
                style={{ width: `${learnedPercent}%` }}
              />
            </div>
          </div>
        )}
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
      <div className="flex w-[3.5rem] shrink-0 flex-col items-center justify-center gap-1.5 border-r border-soft-hairline bg-cream-inset/40 px-1.5 py-5 sm:w-16 sm:py-6">
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
    <div className="flex w-[2.75rem] shrink-0 flex-col items-center justify-center gap-1 border-r border-soft-hairline bg-cream-inset/40 px-1 py-5 sm:w-14 sm:py-6">
      {/* In study-order sort mode (drag enabled and not curating), the slot
          column doubles as a drag-handle affordance: handle on hover, slot
          number at rest. Keyboard users still use the kebab's Move up / down. */}
      {dragEnabled && !isArchived ? (
        <DragHandle
          onPointerDown={onDragHandleDown}
          disabled={false}
          ariaLabel="Drag to reorder"
        />
      ) : null}
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
    'ui-motion-colors block flex-1 min-w-0 px-5 py-5 sm:px-6 sm:py-6',
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

/**
 * Renders into two grid cells (col 2, row 1 and col 2, row 2) so the due
 * number sits on the same horizontal line as the deck name, and the new /
 * review breakdown sits on the same line as the cards-count metadata.
 *
 * Uses a React Fragment because grid children need to be siblings of the
 * other grid items; wrapping in a single div would collapse both lines into
 * a single cell and lose the row alignment.
 */
function ChipOrState({
  isArchived,
  statsLoaded,
  dueCount,
  dueNewCount,
  dueReviewCount,
}: {
  isArchived:     boolean
  statsLoaded:    boolean
  dueCount:       number
  dueNewCount:    number
  dueReviewCount: number
}): React.JSX.Element {
  // Cell 1 (row 1, col 2): top line — due number or state word.
  // Cell 2 (row 2, col 2): bottom line — new / review breakdown, or nothing.

  const topCell = (content: React.ReactNode): React.JSX.Element => (
    <div className="col-start-2 row-start-1 hidden shrink-0 items-baseline justify-end gap-1 sm:flex">
      {content}
    </div>
  )
  const bottomCell = (content: React.ReactNode | null): React.JSX.Element => (
    <div className="col-start-2 row-start-2 hidden shrink-0 justify-end text-right sm:flex">
      {content}
    </div>
  )

  if (isArchived) {
    return (
      <>
        {topCell(
          <span className="font-mono text-sm leading-tight text-faded-sumi tabular-nums">Archived</span>,
        )}
        {bottomCell(null)}
      </>
    )
  }

  if (!statsLoaded) {
    return (
      <>
        {topCell(
          <span
            aria-hidden="true"
            className="inline-block h-5 w-14 animate-pulse rounded-[1px] bg-cream-inset"
          />,
        )}
        {bottomCell(null)}
      </>
    )
  }

  if (dueCount > 0) {
    return (
      <>
        {topCell(
          <>
            <span className="font-mono text-lg font-semibold leading-tight text-inari-vermillion-deep tabular-nums">
              {dueCount}
            </span>
            <span className="font-mono text-xs uppercase tracking-[0.08em] text-faded-sumi">
              due
            </span>
          </>,
        )}
        {bottomCell(
          (dueNewCount > 0 || dueReviewCount > 0) ? (
            <p className="font-mono text-xs leading-tight text-faded-sumi tabular-nums">
              <span className="text-sumi-ink/75">{dueNewCount}</span>
              {' new · '}
              <span className="text-sumi-ink/75">{dueReviewCount}</span>
              {' review'}
            </p>
          ) : null,
        )}
      </>
    )
  }

  return (
    <>
      {topCell(
        <span className="font-mono text-sm leading-tight text-faded-sumi tabular-nums">0 due</span>,
      )}
      {bottomCell(null)}
    </>
  )
}

interface PrimaryActionLinkProps {
  href:  string
  label: string
  tone:  'primary' | 'secondary'
}

function PrimaryActionLink({ href, label, tone }: PrimaryActionLinkProps): React.JSX.Element {
  const classes = tone === 'primary'
    ? [
        'bg-inari-vermillion text-warm-paper-raised border border-inari-vermillion',
        'hover:bg-inari-vermillion-deep hover:border-inari-vermillion-deep',
      ]
    : [
        'bg-warm-paper-raised text-sumi-ink border border-soft-hairline',
        'hover:bg-cream-inset hover:border-faded-sumi',
      ]

  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className={[
        'ui-motion-colors inline-flex h-8 items-center gap-1 rounded-[2px] px-2.5 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ...classes,
      ].join(' ')}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-base leading-none">→</span>
    </Link>
  )
}

function resolvePrimaryAction({
  deckId,
  dueCount,
  isArchived,
}: {
  deckId:     string
  dueCount:   number
  isArchived: boolean
}): { href: string; label: string; tone: 'primary' | 'secondary' } {
  if (isArchived) {
    return { href: `/decks/${deckId}`, label: 'Open', tone: 'secondary' }
  }
  if (dueCount > 0) {
    return { href: `/review/setup?deck=${encodeURIComponent(deckId)}`, label: 'Study', tone: 'primary' }
  }
  return { href: `/decks/${deckId}`, label: 'Open', tone: 'secondary' }
}

function formatSlot(slot: number): string {
  return String(slot).padStart(2, '0')
}
