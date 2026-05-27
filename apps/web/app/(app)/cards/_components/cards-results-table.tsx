'use client'

import Link from 'next/link'

import { StatusPill, type StatusTone } from '@/components/ui/Pill'
import { Time } from '@/components/ui/Time'
import { TomoLoader } from '@/components/ui/TomoLoader'
import { DecksMenu, MenuItem, MenuSeparator } from '@/app/(app)/decks/_components/decks-menu'
import { State, assertNever } from '@fsrs-japanese/shared-types'

export type CardRowAction = 'edit' | 'add-copy' | 'move' | 'delete'

export interface CardsResultRow {
  id:        string
  word:      string
  reading:   string
  meaning:   string
  deckId:    string
  deckName:  string
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond_jlpt' | null
  /** Part-of-speech label sourced from `WordFields.partOfSpeech`
   *  (noun / verb / i-adj / na-adj / adv / etc.). Optional because the
   *  schema marks it nullable. */
  partOfSpeech: string | null
  state:     State
  isSuspended: boolean
  /** Lifetime count of failed reviews. ≥ 8 highlights as a weakSpot. */
  lapses:    number
  /** ISO date the card is next due. */
  due:       string | null
}

/**
 * Lapse-tier row tints. The row's background colour signals card health
 * at a glance: amber for "starting to drag," red for "weakSpot." The brand's
 * `vermillion-wash` is reserved for the selection state, so we lean on
 * Tailwind's amber / red palettes for the lapse signals — distinct from
 * selected-row red, distinct from each other.
 */
const LAPSE_WARNING_THRESHOLD = 4
const LAPSE_WEAK_SPOT_THRESHOLD   = 8

/**
 * Shared grid template applied to both the header and each row so columns
 * line up under their labels. Reading now lives inline beside the word
 * inside the Word/Reading cell. Column reveal stages by viewport:
 *
 *   md  (≥768px)  — checkbox · Word/Reading · Meaning · Status · Due
 *   lg  (≥1024px) — adds Type (part of speech)
 */
/*
 * Column-width tuning notes:
 *   - Word/Reading and Meaning hold roughly equal weight (2fr : 2.2fr).
 *     The slight bias toward Meaning gives long English glosses room to
 *     breathe without truncating mid-phrase.
 *   - Type sits at 11rem so two-word POS tokens ("verb (ichidan)",
 *     "verb (godan)", "na-adjective", "irreg verb") render with
 *     breathing room rather than at the truncation threshold. Single
 *     tokens like "noun" / "る-verb" read fine — `truncate` is a no-op
 *     when content fits.
 *   - Status bumps to 6rem so the StatusPill never crowds the cell edge.
 *   - Due stays compact (4.5rem) — its content is at most "Xmo" or a date.
 */
const GRID_CLASS = [
  // Base (md): Word · Meaning · Status · Due · Actions
  'md:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6rem_4.5rem_2.25rem]',
  // lg: + Type
  'lg:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_11rem_6rem_4.5rem_2.25rem]',
].join(' ')

// Read-only grid: Word · Meaning · (Type). No status, no due, no kebab —
// keeps the read-only catalogue preview as content-only.
const GRID_CLASS_READ_ONLY = [
  'md:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)]',
  'lg:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_11rem]',
].join(' ')

interface Props {
  rows:        readonly CardsResultRow[]
  /**
   * Required unless `readOnly` is true. The kebab menu surfaces edit /
   * move / add-copy / delete and routes them back up through this callback.
   */
  onRowAction?: (cardId: string, action: CardRowAction) => void
  loading?:    boolean
  /**
   * True while the *next* page is being fetched but the current rows are
   * still on screen. Drives an indeterminate vermillion sweep across the
   * top stripe and dims existing rows to preserve reading context. Distinct
   * from `loading` (cold state, no rows yet).
   */
  paginating?: boolean
  /**
   * Optional suffix (including the leading `?` or `&`) appended to each
   * row's `/cards/[id]` link. Use to encode the source section so the
   * sidebar can highlight the originating nav item — e.g. Deck Detail
   * passes `?from=decks` so the active nav stays on Decks while the
   * user is reading a card.
   */
  cardHrefSuffix?: string
  /**
   * When true, the table renders content-only: no per-row kebab, no
   * FSRS status pill, no due column, no lapse-tier health badge. Used
   * by the `/decks/[id]/preview` read-only surface (premade-deck
   * catalogue → "view deck"). Row links still navigate to the card
   * detail page so the user can read deeper content.
   */
  readOnly?: boolean
  /**
   * Selection mode. When `selectedIds` is provided, each row renders a
   * checkbox at the leading edge (mirroring the kebab pattern as an
   * absolute sibling of the Link, so it isn't nested inside the Link's
   * clickable area). The header gains a "select all visible" checkbox.
   * Omit both to keep the legacy behaviour.
   */
  selectedIds?:         ReadonlySet<string>
  onToggleSelection?:   (cardId: string) => void
  onToggleAllVisible?:  () => void
}

/**
 * Table-like dense results. Wraps row content in a SectionCard surface
 * (hairline border + 2px vermillion top stripe) for brand consistency,
 * with rows separated by hairlines inside. Selection state is the
 * primary interaction; row content navigates to /cards/[cardId].
 */
export function CardsResultsTable({
  rows,
  onRowAction,
  loading = false,
  paginating = false,
  cardHrefSuffix = '',
  readOnly = false,
  selectedIds,
  onToggleSelection,
  onToggleAllVisible,
}: Props): React.JSX.Element {
  const selectionMode = selectedIds !== undefined && onToggleSelection !== undefined
  const visibleIds    = rows.map((r) => r.id)
  const allSelected   = selectionMode
    && visibleIds.length > 0
    && visibleIds.every((id) => selectedIds.has(id))
  const someSelected  = selectionMode
    && !allSelected
    && visibleIds.some((id) => selectedIds.has(id))

  return (
    <div
      className="overflow-hidden rounded-xs border border-soft-hairline bg-warm-paper-raised"
      aria-busy={paginating || undefined}
    >
      {/* Top stripe doubles as the pagination progress channel. The static
          vermillion bar is always present; during a paginating refetch a
          narrower opaque sliver sweeps across it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none relative block h-0.5 w-full overflow-hidden bg-inari-vermillion/35"
      >
        {/* Resting brand stripe (full-width). Fades out while the sweep
            runs so the moving sliver reads cleanly without doubling up. */}
        <span
          className={[
            'absolute inset-0 bg-inari-vermillion transition-opacity duration-200',
            paginating ? 'opacity-0' : 'opacity-100',
          ].join(' ')}
        />
        {paginating && (
          <span
            role="progressbar"
            aria-label="Loading next page of cards"
            className="cards-pagination-sweep"
          />
        )}
      </div>

      {/* Header. Right padding matches the row's `<Link>` (`pr-12` interactive
          mode; `pr-4` read-only) so both grids compute against the same
          available width — keeping every column edge between header and row
          in lockstep. The leading checkbox slot is rendered separately so
          it doesn't disturb the column grid. */}
      <div
        className={[
          'hidden md:flex items-center gap-2 border-b border-soft-hairline bg-cream-inset/45 px-4 py-2.5 font-mono text-sm text-faded-sumi',
          readOnly ? 'pr-4' : 'pr-12',
        ].join(' ')}
      >
        {selectionMode && (
          <input
            type="checkbox"
            aria-label="Select all visible cards"
            checked={allSelected}
            ref={(el) => { if (el !== null) el.indeterminate = someSelected }}
            onChange={onToggleAllVisible}
            className="h-4 w-4 shrink-0 rounded-[1px] border-soft-hairline accent-inari-vermillion text-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          />
        )}
        <div
          className={[
            'grid flex-1 items-center gap-2',
            readOnly ? GRID_CLASS_READ_ONLY : GRID_CLASS,
          ].join(' ')}
        >
          <span>Word</span>
          <span>Meaning</span>
          <span className="hidden lg:block">Type</span>
          {!readOnly && (
            <>
              <span>Status</span>
              <span className="text-right">Due</span>
              <span className="sr-only">Actions</span>
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <TomoLoader size="block" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="px-6 py-12 text-center">
          {/* Kanji eyebrow — 空 (kara, "empty") — gives the filtered-
              zero state the same visual language as the first-run
              empty state (始) and the page header (字). One consistent
              brand device across every state of the surface. */}
          <span
            lang="ja"
            aria-hidden="true"
            className="font-display text-numeral leading-none text-inari-vermillion/75"
          >
            空
          </span>
          <p className="mt-3 text-sm font-medium text-sumi-ink">No cards match.</p>
          <p className="mx-auto mt-1.5 max-w-measure-tight text-sm text-faded-sumi">
            Try broadening the search or clearing some filters.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul
          className={[
            'divide-y divide-soft-hairline transition-opacity duration-200',
            paginating ? 'pointer-events-none opacity-65' : 'opacity-100',
          ].join(' ')}
          aria-label="Card results"
        >
          {rows.map((row) => (
            <ResultRow
              key={row.id}
              row={row}
              hrefSuffix={cardHrefSuffix}
              readOnly={readOnly}
              onAction={(action) => onRowAction?.(row.id, action)}
              {...(selectionMode
                ? { selected: selectedIds.has(row.id), onToggleSelected: () => onToggleSelection(row.id) }
                : {})}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Row ────────────────────────────────────────────────────────────────

function ResultRow({
  row,
  hrefSuffix,
  readOnly,
  onAction,
  selected,
  onToggleSelected,
}: {
  row:              CardsResultRow
  hrefSuffix:       string
  readOnly:         boolean
  onAction:         (action: CardRowAction) => void
  selected?:        boolean
  onToggleSelected?: () => void
}): React.JSX.Element {
  const dueLabel = row.due === null ? '—' : formatDue(row.due)
  const statusTone = statusForState(row.state, row.isSuspended)
  // In read-only mode the lapse-tier signals are suppressed — the row reads
  // as neutral catalogue content rather than a personal-state diagnostic.
  const lapseTier = readOnly ? 'ok' : lapseTierFor(row.lapses)
  const selectionMode = onToggleSelected !== undefined

  return (
    <li
      className={[
        'ui-motion-colors group/row relative',
        rowToneClass(lapseTier),
        selected === true ? 'bg-vermillion-wash/30' : '',
      ].join(' ')}
    >
      {/* Selection checkbox sits absolutely at the left edge so it's a peer
          of the Link (not a descendant); the Link adds `pl-11` when in
          selection mode to clear the checkbox area.
          `left-4` (16px) matches the header's `px-4` so the row checkbox
          and the header "select all" checkbox share the same left edge. */}
      {selectionMode && (
        <div className="absolute left-4 top-1/2 z-10 -translate-y-1/2">
          <input
            type="checkbox"
            aria-label={`Select ${row.word}`}
            checked={selected === true}
            onChange={onToggleSelected}
            className="h-4 w-4 rounded-[1px] border-soft-hairline accent-inari-vermillion text-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          />
        </div>
      )}

      {/* Row actions sit absolutely at the far-right edge so the kebab
          is a peer of the Link, not a descendant — avoids nested
          interactive elements while still visually occupying the final
          grid cell. Suppressed entirely in read-only mode. */}
      {!readOnly && (
        <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
          <CardRowMenu onAction={onAction} />
        </div>
      )}

      <Link
        href={`/cards/${row.id}${hrefSuffix}`}
        className={[
          'block py-4 sm:py-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px]',
          // `pl-11` in selection mode mirrors the header's
          //   px-4 (16px) + checkbox (16px) + gap-3 (12px) = 44px
          // so the row's column grid starts on the same x-axis as the header's.
          selectionMode ? 'pl-11' : 'pl-4',
          readOnly ? 'pr-4' : 'pr-12',
        ].join(' ')}
      >
        {/* Desktop: shared GRID_CLASS so every cell sits under its
            header label. The last cell is a transparent spacer; the
            absolute kebab above visually fills it. */}
        <div className={[
          'hidden md:grid',
          readOnly ? GRID_CLASS_READ_ONLY : GRID_CLASS,
          'items-center gap-2',
        ].join(' ')}>
          {/* Word + reading share one cell. The word truncates first
              if the cell narrows; the reading stays inline as a quiet
              pronunciation aid in faded-sumi. */}
          <span className="flex min-w-0 items-baseline gap-2">
            <span className="sr-only">Word: </span>
            <span
              lang="ja"
              className={['min-w-0 truncate text-base font-semibold', wordToneClass(lapseTier)].join(' ')}
            >
              {row.word}
            </span>
            {row.reading.length > 0 && (
              <span lang="ja" className="min-w-0 shrink truncate text-sm text-faded-sumi">
                {row.reading}
              </span>
            )}
            {!readOnly && <HealthBadge tier={lapseTier} />}
          </span>
          <span className="min-w-0 truncate text-sm text-sumi-ink/85">
            <span className="sr-only">Meaning: </span>
            {row.meaning || '—'}
          </span>
          <span className="hidden min-w-0 truncate font-mono text-sm text-faded-sumi lg:block">
            <span className="sr-only">Type: </span>
            {row.partOfSpeech ?? '—'}
          </span>
          {!readOnly && (
            <>
              <span>
                <span className="sr-only">Status: </span>
                <StatusPill status={statusTone.status} label={statusTone.label} size="sm" className="!rounded-xs !leading-tight" />
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-faded-sumi">
                <span className="sr-only">Due: </span>
                {row.due === null ? dueLabel : <Time value={row.due}>{dueLabel}</Time>}
              </span>
              <span aria-hidden="true" />
            </>
          )}
        </div>

        {/* Mobile: card-row anatomy mirroring Deck Detail's CardListItem. */}
        <div className="flex min-w-0 flex-col gap-1 md:hidden">
          <div className="flex items-baseline gap-2">
            <span
              lang="ja"
              className={['min-w-0 truncate text-lg font-semibold', wordToneClass(lapseTier)].join(' ')}
            >
              {row.word}
            </span>
            {row.reading.length > 0 && (
              <span lang="ja" className="shrink-0 text-sm text-faded-sumi">
                {row.reading}
              </span>
            )}
            {!readOnly && <HealthBadge tier={lapseTier} />}
            {!readOnly && (
              <span className="ml-auto shrink-0">
                <StatusPill status={statusTone.status} label={statusTone.label} size="sm" className="!rounded-xs !leading-tight" />
              </span>
            )}
          </div>
          <span className="min-w-0 truncate text-sm text-sumi-ink/80">{row.meaning || '—'}</span>
          <div className="flex items-baseline gap-2 font-mono text-sm text-faded-sumi">
            {row.partOfSpeech !== null && row.partOfSpeech !== undefined && (
              <span className="shrink-0">{row.partOfSpeech}</span>
            )}
            {!readOnly && (
              <span className="ml-auto shrink-0 truncate">
                {dueLabel === '—' ? 'Not due' : <>Due <Time value={row.due as string}>{dueLabel}</Time></>}
              </span>
            )}
          </div>
        </div>
      </Link>
    </li>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────

type LapseTier = 'ok' | 'warning' | 'weakSpot'

function lapseTierFor(lapses: number): LapseTier {
  if (lapses >= LAPSE_WEAK_SPOT_THRESHOLD)   return 'weakSpot'
  if (lapses >= LAPSE_WARNING_THRESHOLD) return 'warning'
  return 'ok'
}

/**
 * Every row uses the default warm-paper-raised surface; lapse-tier
 * health is communicated by the inline `HealthBadge` text + the word
 * tint, not by row background. Keeping the row neutral lets long lists
 * read as one continuous surface instead of a striped traffic-light.
 */
function rowToneClass(_tier: LapseTier): string {
  return 'bg-warm-paper-raised hover:bg-cream-inset/55'
}

/**
 * Word colour is always sumi-ink regardless of lapse tier. Card health
 * is now signalled exclusively by the inline `HealthBadge` text — the
 * headword stays a stable reading target.
 */
function wordToneClass(_tier: LapseTier): string {
  return 'text-sumi-ink'
}

/**
 * Text-label companion to the colour signal. Pairs with the row/word
 * tint so card health is communicated by **both** colour and text —
 * satisfying the "don't rely on colour alone" accessibility rule.
 * Renders nothing on healthy rows; on warning/weakSpot rows, emits a
 * compact mono-uppercase chip with a tier-matched border and ARIA
 * label naming the health state.
 */
function HealthBadge({ tier }: { tier: LapseTier }): React.JSX.Element | null {
  if (tier === 'ok') return null
  const isLeech = tier === 'weakSpot'
  const label = isLeech ? 'Weak spot' : 'Drifting'
  const toneClass = isLeech ? 'text-inari-vermillion-deep' : 'text-warning'
  return (
    <span
      role="img"
      aria-label={`Card health: ${label}`}
      title={isLeech
        ? 'Weak spot: this card has 8 or more lapses and is failing repeatedly.'
        : 'Drifting: this card has been failed 4 or more times.'}
      className={[
        'ml-3 shrink-0 font-mono text-sm font-semibold',
        toneClass,
      ].join(' ')}
    >
      {label}
    </span>
  )
}

/**
 * Per-row kebab menu. Lives outside the row's `<Link>` (positioned
 * absolutely in the parent `<li>`) so it doesn't nest interactive
 * elements. Routes Edit / Move / Delete back up via `onAction`; the
 * Cards browser turns those into toast stubs until the endpoints land.
 */
function CardRowMenu({ onAction }: { onAction: (action: CardRowAction) => void }): React.JSX.Element {
  return (
    <DecksMenu
      align="end"
      menuClassName="min-w-[9rem]"
      renderTrigger={({ onClick, onKeyDown, ariaExpanded, triggerRef }) => (
        <button
          ref={triggerRef}
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick() }}
          onKeyDown={onKeyDown}
          aria-haspopup="menu"
          aria-expanded={ariaExpanded}
          aria-label="Card actions"
          className={[
            'ui-motion-colors inline-flex h-11 w-11 sm:h-8 sm:w-8 items-center justify-center rounded-xs text-faded-sumi',
            'hover:bg-cream-inset hover:text-sumi-ink',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
            <circle cx="3"  cy="7" r="1.25" />
            <circle cx="7"  cy="7" r="1.25" />
            <circle cx="11" cy="7" r="1.25" />
          </svg>
        </button>
      )}
      renderItems={({ close }) => (
        <>
          <MenuItem onClick={() => { onAction('edit');     close() }}>Edit card</MenuItem>
          <MenuItem onClick={() => { onAction('add-copy'); close() }}>Add a copy to another deck…</MenuItem>
          <MenuItem onClick={() => { onAction('move');     close() }}>Move to another deck…</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={() => { onAction('delete');   close() }} danger>Delete card</MenuItem>
        </>
      )}
    />
  )
}

function statusForState(state: State, isSuspended: boolean): { status: StatusTone; label: string } {
  if (isSuspended) return { status: 'suspended', label: 'Suspended' }
  switch (state) {
    case State.New:        return { status: 'new', label: 'New' }
    case State.Learning:
    case State.Relearning: return { status: 'learning', label: 'Learning' }
    case State.Review:     return { status: 'review', label: 'Review' }
    default:
      return assertNever(state)
  }
}

function formatDue(iso: string): string {
  const date = new Date(iso)
  const now  = new Date()
  const diffMs = date.getTime() - now.getTime()
  const days   = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'today'
  if (days === 1) return '1d'
  if (days < 30) return `${days}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
