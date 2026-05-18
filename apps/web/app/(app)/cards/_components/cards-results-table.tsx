'use client'

import Link from 'next/link'

import { StatusPill, type StatusTone } from '@/components/ui/Pill'
import { DecksMenu, MenuItem, MenuSeparator } from '@/app/(app)/decks/_components/decks-menu'
import { State } from '@fsrs-japanese/shared-types'

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
  /** Personal organization tags applied to the card. */
  tags:      readonly string[]
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
 * inside the Word/Reading cell, so the grid drops a column. Column
 * reveal stages by viewport:
 *
 *   md  (≥768px)  — checkbox · Word/Reading · Meaning · Status · Due
 *   lg  (≥1024px) — adds Type (part of speech)
 *   xl  (≥1280px) — adds Tags
 */
/*
 * Column-width tuning notes:
 *   - Word/Reading and Meaning hold roughly equal weight (2fr : 2.2fr).
 *     The slight bias toward Meaning gives long English glosses room to
 *     breathe without truncating mid-phrase.
 *   - Type bumps to 6.5rem so "irreg verb" fits without truncation.
 *   - Status bumps to 6rem so the StatusPill never crowds the cell edge.
 *   - Tags grows to a full 1fr lane so two chips + overflow fit by default.
 *   - Due stays compact (4.5rem) — its content is at most "Xmo" or a date.
 */
const GRID_CLASS = [
  // Base (md): Word · Meaning · Status · Due · Actions
  'md:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6rem_4.5rem_2.25rem]',
  // lg: + Type
  'lg:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6.5rem_6rem_4.5rem_2.25rem]',
  // xl: + Tags
  'xl:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6.5rem_minmax(0,1fr)_6rem_4.5rem_2.25rem]',
].join(' ')

// Read-only grid: Word · Meaning · (Type) · (Tags). No status, no due, no
// kebab — keeps the read-only catalogue preview as content-only.
const GRID_CLASS_READ_ONLY = [
  'md:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)]',
  'lg:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6.5rem]',
  'xl:grid-cols-[minmax(0,2fr)_minmax(0,2.2fr)_6.5rem_minmax(0,1fr)]',
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
  cardHrefSuffix = '',
  readOnly = false,
}: Props): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised">
      <span
        aria-hidden="true"
        className="pointer-events-none block h-[2px] w-full bg-inari-vermillion"
      />

      {/* Header. Right padding matches the row's `<Link>` (`pr-12` interactive
          mode; `pr-4` read-only) so both grids compute against the same
          available width — keeping every column edge between header and row
          in lockstep. */}
      <div
        className={[
          'hidden md:grid',
          readOnly ? GRID_CLASS_READ_ONLY : GRID_CLASS,
          'items-center gap-3 border-b border-soft-hairline bg-cream-inset/45 px-4 py-2.5 font-mono text-[0.6875rem] uppercase tracking-[0.12em] text-faded-sumi',
          readOnly ? 'pr-4' : 'pr-12',
        ].join(' ')}
      >
        <span>Word</span>
        <span>Meaning</span>
        <span className="hidden lg:block">Type</span>
        <span className="hidden xl:block">Tags</span>
        {!readOnly && (
          <>
            <span>Status</span>
            <span className="text-right">Due</span>
            <span className="sr-only">Actions</span>
          </>
        )}
      </div>

      {loading && (
        <div className="divide-y divide-soft-hairline">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <span className="dashboard-skeleton h-5 w-24 rounded-[1px]" />
              <span className="dashboard-skeleton h-4 w-16 rounded-[1px]" />
              <span className="dashboard-skeleton h-4 w-40 rounded-[1px]" />
            </div>
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-sumi-ink">No cards match.</p>
          <p className="mx-auto mt-1.5 max-w-[40ch] text-sm text-faded-sumi">
            Try broadening the search or clearing some filters.
          </p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="divide-y divide-soft-hairline" aria-label="Card results">
          {rows.map((row) => (
            <ResultRow
              key={row.id}
              row={row}
              hrefSuffix={cardHrefSuffix}
              readOnly={readOnly}
              onAction={(action) => onRowAction?.(row.id, action)}
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
}: {
  row:        CardsResultRow
  hrefSuffix: string
  readOnly:   boolean
  onAction:   (action: CardRowAction) => void
}): React.JSX.Element {
  const dueLabel = row.due === null ? '—' : formatDue(row.due)
  const statusTone = statusForState(row.state, row.isSuspended)
  // In read-only mode the lapse-tier signals are suppressed — the row reads
  // as neutral catalogue content rather than a personal-state diagnostic.
  const lapseTier = readOnly ? 'ok' : lapseTierFor(row.lapses)
  const firstTag = row.tags[0]

  return (
    <li
      className={[
        'ui-motion-colors group/row relative',
        rowToneClass(lapseTier),
      ].join(' ')}
    >
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
          'block px-4 py-4 sm:py-5 focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-[-1px]',
          readOnly ? 'pr-4' : 'pr-12',
        ].join(' ')}
      >
        {/* Desktop: shared GRID_CLASS so every cell sits under its
            header label. The last cell is a transparent spacer; the
            absolute kebab above visually fills it. */}
        <div className={[
          'hidden md:grid',
          readOnly ? GRID_CLASS_READ_ONLY : GRID_CLASS,
          'items-center gap-3',
        ].join(' ')}>
          {/* Word + reading share one cell. The word truncates first
              if the cell narrows; the reading stays inline as a quiet
              pronunciation aid in faded-sumi. */}
          <span className="flex min-w-0 items-baseline gap-2">
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
            {row.meaning || '—'}
          </span>
          <span className="hidden min-w-0 truncate font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-faded-sumi lg:block">
            {row.partOfSpeech ?? '—'}
          </span>
          <span className="hidden min-w-0 xl:block">
            <TagStrip tags={row.tags} />
          </span>
          {!readOnly && (
            <>
              <span>
                <StatusPill status={statusTone.status} label={statusTone.label} size="sm" className="!rounded-[2px] !leading-tight" />
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-faded-sumi">
                {dueLabel}
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
                <StatusPill status={statusTone.status} label={statusTone.label} size="sm" className="!rounded-[2px] !leading-tight" />
              </span>
            )}
          </div>
          <span className="min-w-0 truncate text-sm text-sumi-ink/80">{row.meaning || '—'}</span>
          <div className="flex items-baseline gap-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em] text-faded-sumi">
            {row.partOfSpeech !== null && row.partOfSpeech !== undefined && (
              <span className="shrink-0">{row.partOfSpeech}</span>
            )}
            {firstTag !== undefined && (
              <>
                {row.partOfSpeech !== null && row.partOfSpeech !== undefined && (
                  <span aria-hidden="true" className="text-faded-sumi/55">·</span>
                )}
                <span className="truncate">{firstTag}</span>
              </>
            )}
            {!readOnly && (
              <span className="ml-auto shrink-0 truncate">
                {dueLabel === '—' ? 'Not due' : `Due ${dueLabel}`}
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
  const toneClass = isLeech ? 'text-inari-vermillion-deep' : 'text-amber-900'
  return (
    <span
      role="img"
      aria-label={`Card health: ${label}`}
      title={isLeech
        ? 'Weak spot: this card has 8 or more lapses and is failing repeatedly.'
        : 'Drifting: this card has been failed 4 or more times.'}
      className={[
        'ml-3 shrink-0 font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.08em]',
        toneClass,
      ].join(' ')}
    >
      {label}
    </span>
  )
}

/**
 * Renders the first two tags as compact chips, with "+N" overflow when
 * there are more. Returns an em-dash when the card has no tags.
 */
function TagStrip({ tags }: { tags: readonly string[] }): React.JSX.Element {
  if (tags.length === 0) {
    return <span className="font-mono text-xs text-faded-sumi/70">—</span>
  }
  const visible  = tags.slice(0, 2)
  const overflow = tags.length - visible.length
  return (
    <span className="flex min-w-0 items-center gap-1">
      {visible.map((tag) => (
        <span
          key={tag}
          className="truncate rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-1.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] text-faded-sumi"
          title={tag}
        >
          {tag}
        </span>
      ))}
      {overflow > 0 && (
        <span className="font-mono text-[0.625rem] text-faded-sumi/80 tabular-nums">+{overflow}</span>
      )}
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
            'ui-motion-colors inline-flex h-8 w-8 items-center justify-center rounded-[2px] text-faded-sumi',
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
    default: {
      const _exhaustiveCheck: never = state
      return _exhaustiveCheck
    }
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
