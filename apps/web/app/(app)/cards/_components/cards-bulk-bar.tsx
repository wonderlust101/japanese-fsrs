'use client'

import { IconCopy, IconDelete, IconHide } from '@/components/icons/chrome-marks'
import { ToolbarChip } from '@/components/ui/ToolbarChip'

interface Props {
  selectedCount: number
  onMove:        () => void
  onSuspend:     () => void
  onDelete:      () => void
  onClear:       () => void
}

/**
 * Bulk-action bar that appears once the user has selected at least one
 * card. Uses `position: sticky` rather than `position: fixed` so the
 * bar inherits the main content column's width (stopping cleanly at
 * the sidebar boundary on desktop) instead of bleeding across the
 * whole viewport. Caller is responsible for rendering this inside the
 * page's main content column so sticky positioning finds the correct
 * scroll container (`<main>` in the app layout).
 *
 * Visual anatomy mirrors the previous `StickyActionBar` version:
 * warm-paper-raised background, 1px soft-hairline top border, 2px
 * Inari Vermillion brand stripe at the top edge, inline mono action
 * labels. The decision to drop the shared `StickyActionBar` primitive
 * here was scoped: the cards bulk bar is the only consumer that
 * needs content-column-only width; other consumers (Decks curate bar)
 * keep the viewport-spanning behavior.
 */
export function CardsBulkBar({
  selectedCount,
  onMove,
  onSuspend,
  onDelete,
  onClear,
}: Props): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label="Bulk card actions"
      className="sticky bottom-0 z-[var(--z-raised)] border-t border-soft-hairline bg-warm-paper-raised"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-inari-vermillion"
      />
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:py-3.5 md:px-12 lg:px-16">
        <ToolbarChip onClick={onClear}>Done</ToolbarChip>

        <span className="font-mono text-xs tabular-nums text-faded-sumi">
          <span className="text-sumi-ink">{selectedCount}</span>
          {' '}
          <span className="text-faded-sumi/80">{selectedCount === 1 ? 'card selected' : 'cards selected'}</span>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <BarAction icon={<IconCopy  className="h-3.5 w-3.5" />} label="Move"      onClick={onMove}   />
          <BarAction icon={<IconHide  className="h-3.5 w-3.5" />} label="Suspend"   onClick={onSuspend} />
          {/* When wiring this bar into a parent, the parent must gate onDelete behind a confirmation dialog — see BulkDeleteDecksDialog for the pattern. */}
          <BarAction icon={<IconDelete className="h-3.5 w-3.5" />} label="Delete"    onClick={onDelete} danger />
        </div>
      </div>
    </div>
  )
}

function BarAction({
  onClick,
  icon,
  label,
  danger,
}: {
  onClick: () => void
  icon:    React.ReactNode
  label:   string
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-xs px-2.5 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        danger === true
          ? 'text-inari-vermillion-deep hover:bg-vermillion-wash'
          : 'text-sumi-ink hover:bg-cream-inset',
      ].join(' ')}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  )
}
