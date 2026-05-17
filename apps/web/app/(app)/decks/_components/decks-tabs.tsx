'use client'

import type { DecksViewTab } from './use-deck-prefs'

/**
 * Top-level tabs for the Decks page. Three views:
 *
 *   - Active   — every non-archived deck (default).
 *   - Mature   — non-archived decks whose cards are 100% mature
 *                (matureCount === cardCount, cardCount > 0). Shows what
 *                you've fully internalised.
 *   - Archived — decks the user has set aside.
 *
 * The tabs hide the older "Show archived" toggle from the curate bar — there's
 * now exactly one place to switch between active and archived views.
 */

export interface TabCounts {
  active:   number
  mature:   number
  archived: number
}

export function DecksTabs({
  view,
  counts,
  onChange,
}: {
  view:    DecksViewTab
  counts:  TabCounts
  onChange: (next: DecksViewTab) => void
}): React.JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Deck view"
      className="flex items-center gap-1 border-b border-soft-hairline"
    >
      <TabButton label="Active"   count={counts.active}   active={view === 'active'}   onClick={() => onChange('active')} />
      <TabButton label="Mature"   count={counts.mature}   active={view === 'mature'}   onClick={() => onChange('mature')} />
      <TabButton label="Archived" count={counts.archived} active={view === 'archived'} onClick={() => onChange('archived')} />
    </div>
  )
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label:   string
  count:   number
  active:  boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'ui-motion-colors relative inline-flex items-center gap-1.5 px-3 py-2.5 text-sm',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        active
          ? 'text-sumi-ink font-medium'
          : 'text-faded-sumi hover:text-sumi-ink',
      ].join(' ')}
    >
      <span>{label}</span>
      <span
        className={[
          'font-mono text-xs tabular-nums',
          active ? 'text-sumi-ink/70' : 'text-faded-sumi/70',
        ].join(' ')}
      >
        {count}
      </span>
      {/* Active-tab underline: 2px vermillion rule that pulls each tab into
          the same brand vocabulary as SectionCard / DeckCard's top stripes. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-px h-[2px] bg-inari-vermillion"
        />
      )}
    </button>
  )
}
