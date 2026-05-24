'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { ApiDeck } from '@fsrs-japanese/shared-types'

import { IconFlag } from '@/components/icons/chrome-marks'
import { Checkbox } from '@/components/ui/Checkbox'
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
    ? 'translate-y-[-2px] shadow-deck-lift'
    : ''

  const dropTargetClasses = isDropTarget && !isDragging
    ? [
        'before:absolute before:left-0 before:right-0 before:top-[-2px]',
        'before:h-[3px] before:rounded-full before:bg-inari-vermillion',
        'before:shadow-[var(--glow-vermillion-soft)]',
        'after:absolute after:left-[-3px] after:top-[-5px]',
        'after:h-[9px] after:w-[9px] after:rounded-full after:bg-inari-vermillion',
        'after:shadow-[0_0_0_2px_var(--color-warm-paper-raised)]',
      ].join(' ')
    : ''

  // Right-side primary action: always "Study". Tone shifts to
  // primary (vermillion) when there's due work to act on; secondary
  // otherwise. The whole row remains a link to the detail page
  // (keyboard-equivalent).
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
          'group relative rounded-xs border-l border-r border-b border-soft-hairline',
          cardTone,
          'overflow-hidden',
          curateMode && selected ? 'ring-1 ring-inari-vermillion ring-offset-0' : '',
        ].join(' ')}
      >
        {/* Brand identity stripe. */}
        <span
          aria-hidden="true"
          className="absolute top-0 -left-px -right-px h-0.5"
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

          {/* Mobile: text and action cluster stack vertically so the
              Study button reads below the deck name + metadata. Desktop:
              they sit side-by-side as before. The kanji LeadingColumn
              stays in the outer flex row regardless. */}
          <div className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center">

          <DeckRowSurface
            href={`/decks/${deck.id}`}
            curateMode={curateMode}
            onClick={curateMode ? onToggleSelect : undefined}
            ariaLabel={`${displayName}, deck${slotIndex !== null ? `, slot ${formatSlot(slotIndex)}` : ''}`}
          >
            {/*
              2-row grid for the row's clickable metadata zone. The action
              cluster lives OUTSIDE this Link so the inner action button
              (Study) navigates to its own href instead of being
              eaten by the outer row link — a nested <a> would otherwise
              produce invalid HTML and inconsistent click routing.

              Columns: [identity 1fr][chip auto]
              Rows:    [top auto][bottom auto]
            */}
            <div
              className={[
                'grid min-w-0 items-center',
                'grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2',
                'sm:gap-x-6 md:gap-x-8 lg:gap-x-10',
              ].join(' ')}
            >
              {/* Row 1, col 1 — deck name + optional Archived label. */}
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
                  <span className="shrink-0 font-mono text-sm text-faded-sumi">
                    Archived
                  </span>
                )}
              </div>

              {/* Row 2, col 1 — cards count + mobile-only inline due signal.
                  Mature readout lives below the bar in row 3, not here. */}
              <p className="col-start-1 row-start-2 truncate font-mono text-xs leading-tight text-faded-sumi tabular-nums">
                <span className="text-sumi-ink/80">{cardCount}</span>
                {' '}{cardCount === 1 ? 'card' : 'cards'}
                {!isArchived && statsLoaded && dueCount > 0 && (
                  <span className="sm:hidden">
                    <span aria-hidden="true" className="px-1.5 text-faded-sumi/60">·</span>
                    <span className="font-medium text-inari-vermillion-deep">{dueCount}</span>
                    <span className="text-faded-sumi">{' due'}</span>
                  </span>
                )}
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

              {/* Row 3, full width — Mature progress stacked: bar on top,
                  readout caption beneath. The two lines read as one
                  ledger annotation (visual + numeric) anchored to the
                  left column under the cards count above. */}
              {!isArchived && statsLoaded && cardCount > 0 && (
                <div className="col-start-1 col-end-3 row-start-3 mt-1.5 flex flex-col gap-2">
                  <div
                    role="progressbar"
                    aria-label="Mature cards"
                    aria-valuenow={learnedPercent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuetext={`${matureCount} of ${cardCount} cards mature, ${learnedPercent} percent`}
                    className="h-1 w-full overflow-hidden rounded-full bg-soft-hairline/45"
                  >
                    <div
                      className="h-full w-full origin-left rounded-full bg-inari-vermillion-deep/70 transition-transform duration-300"
                      style={{
                        transform: `scaleX(${learnedPercent / 100})`,
                        transitionTimingFunction: 'var(--ease-out-quint)',
                      }}
                    />
                  </div>
                  <span className="font-mono text-sm tabular-nums leading-none text-faded-sumi">
                    <span className="text-sumi-ink/80">{matureCount}</span>
                    <span className="text-faded-sumi">{' / '}</span>
                    <span className="text-sumi-ink/80">{cardCount}</span>
                    <span className="text-faded-sumi">{' mature'}</span>
                  </span>
                </div>
              )}
            </div>
          </DeckRowSurface>

          {/* Action cluster. Mobile: stacks under text via the parent
              column flex; padding is rebalanced (no top pad on mobile
              because the row surface already provided it). Desktop:
              right-aligned in the row, py matches DeckRowSurface so
              the baseline lines up. */}
          {!curateMode && (
            <div className="flex shrink-0 items-center gap-2 px-5 pb-5 pt-0 sm:gap-3 sm:px-0 sm:pr-6 sm:py-6">
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
      <div className="flex w-[3.5rem] shrink-0 flex-col items-center justify-center gap-2 border-r border-soft-hairline bg-cream-inset/40 px-1.5 py-5 sm:w-16 sm:py-6">
        <DragHandle
          onPointerDown={onDragHandleDown}
          disabled={!dragEnabled}
          ariaLabel={dragEnabled ? 'Drag to reorder' : 'Reordering requires Study order sort'}
        />
        <div role="presentation" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onChange={() => onToggleSelect()}
            ariaLabel="Select deck"
          />
        </div>
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
  // `flex items-center` (was `block`) so the inner grid (deck name +
  // cards count) vertically centers when the row's flex siblings —
  // kanji slot, action cluster — push the overall row to a taller
  // height. Without it the text rode against the top with empty
  // space below. The grid `> *:w-full` makes the grid expand to
  // fill horizontally inside the now-flex container.
  const sharedClass = [
    'ui-motion-colors flex flex-1 items-center min-w-0 px-5 py-5 sm:px-6 sm:py-6',
    '[&>*]:w-full',
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
 * Right-side state column. Renders into a single grid cell that spans
 * both rows (col 2, row 1 → row 2) so its content can vertically center
 * against col 1's now-inline identity row. Inside the cell, a flex
 * column right-aligns items and centers them on the cross axis; when
 * there's only one item (state word, loading skeleton, "0 due"), it
 * sits on the row's centerline. When the "N due / breakdown" pair is
 * present, the two lines stack naturally — still vertically centered
 * as a group.
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
  const wrapper = (children: React.ReactNode): React.JSX.Element => (
    <div className="col-start-2 row-start-1 row-end-3 hidden shrink-0 flex-col items-end justify-center gap-1 text-right sm:flex">
      {children}
    </div>
  )

  if (isArchived) {
    return wrapper(
      <span className="font-mono text-sm leading-tight text-faded-sumi tabular-nums">Archived</span>,
    )
  }

  if (!statsLoaded) {
    return wrapper(
      <span
        aria-hidden="true"
        className="inline-block h-5 w-14 animate-pulse rounded-[1px] bg-cream-inset"
      />,
    )
  }

  if (dueCount > 0) {
    return wrapper(
      <>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-lg font-semibold leading-tight text-inari-vermillion-deep tabular-nums">
            {dueCount}
          </span>
          <span className="font-mono text-xs text-faded-sumi">due</span>
        </div>
        {(dueNewCount > 0 || dueReviewCount > 0) && (
          <p className="font-mono text-xs leading-tight text-faded-sumi tabular-nums">
            <span className="text-sumi-ink/75">{dueNewCount}</span>
            {' new · '}
            <span className="text-sumi-ink/75">{dueReviewCount}</span>
            {' review'}
          </p>
        )}
      </>,
    )
  }

  return wrapper(
    <span className="font-mono text-sm leading-tight text-faded-sumi tabular-nums">0 due</span>,
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

  // h-11 on mobile (WCAG 2.5.5 AAA: 44px touch target), h-8 desktop.
  // `active:` deepens tone for iOS tap feedback, sibling-consistent
  // with the cards toolbar primitives.
  const activeClass = tone === 'primary'
    ? 'active:bg-inari-vermillion-deep'
    : 'active:bg-cream-inset'

  return (
    <Link
      href={href}
      className={[
        'ui-motion-colors inline-flex h-11 sm:h-8 items-center gap-1 rounded-xs px-3 sm:px-2.5 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        activeClass,
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
  // Label is always "Study" — the deck card's primary verb is to
  // engage with the deck. Tone differentiates the urgency: primary
  // (vermillion) when there's due work to do, secondary (neutral)
  // when archived or caught up. The href still routes to the deck
  // detail when there's nothing immediately reviewable; that page
  // surfaces the deck's contents and add-new controls from there.
  if (isArchived) {
    return { href: `/decks/${deckId}`, label: 'Study', tone: 'secondary' }
  }
  if (dueCount > 0) {
    return { href: `/review/setup?deck=${encodeURIComponent(deckId)}`, label: 'Study', tone: 'primary' }
  }
  return { href: `/decks/${deckId}`, label: 'Study', tone: 'secondary' }
}

function formatSlot(slot: number): string {
  return String(slot).padStart(2, '0')
}
