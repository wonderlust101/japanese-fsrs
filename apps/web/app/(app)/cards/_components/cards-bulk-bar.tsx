'use client'

import { IconCopy, IconDelete, IconEdit, IconHide } from '@/components/icons/chrome-marks'
import { StickyActionBar } from '@/components/ui/StickyActionBar'
import { ToolbarChip } from '@/components/ui/ToolbarChip'

interface Props {
  selectedCount: number
  onAddTag:      () => void
  onMove:        () => void
  onSuspend:     () => void
  onDelete:      () => void
  onClear:       () => void
}

/**
 * Sticky bottom bar that appears once the user has selected at least one
 * card. Same anatomy as `DecksCurateBar`: full-viewport-width band with
 * a 2px vermillion top stripe, brand background, and inline mono action
 * labels. Disappears entirely when the selection is empty.
 */
export function CardsBulkBar({
  selectedCount,
  onAddTag,
  onMove,
  onSuspend,
  onDelete,
  onClear,
}: Props): React.JSX.Element {
  return (
    <StickyActionBar ariaLabel="Bulk card actions" brandStripe>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-6 sm:py-3.5 lg:px-12 xl:px-16">
        <ToolbarChip onClick={onClear}>Done</ToolbarChip>

        <span className="font-mono text-xs tabular-nums text-faded-sumi">
          <span className="text-sumi-ink">{selectedCount}</span>
          {' '}
          <span className="text-faded-sumi/80">{selectedCount === 1 ? 'card selected' : 'cards selected'}</span>
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <BarAction icon={<IconEdit  className="h-3.5 w-3.5" />} label="Add tag"   onClick={onAddTag} />
          <BarAction icon={<IconCopy  className="h-3.5 w-3.5" />} label="Move"      onClick={onMove}   />
          <BarAction icon={<IconHide  className="h-3.5 w-3.5" />} label="Suspend"   onClick={onSuspend} />
          {/* When wiring this bar into a parent, the parent must gate onDelete behind a confirmation dialog — see BulkDeleteDecksDialog for the pattern. */}
          <BarAction icon={<IconDelete className="h-3.5 w-3.5" />} label="Delete"    onClick={onDelete} danger />
        </div>
      </div>
    </StickyActionBar>
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
        'ui-motion-colors inline-flex h-9 items-center gap-1.5 rounded-[2px] px-2.5 text-sm font-medium',
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
