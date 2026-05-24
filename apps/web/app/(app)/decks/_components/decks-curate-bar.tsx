'use client'

import {
  IconCopy,
  IconDelete,
  IconFlag,
  IconHide,
} from '@/components/icons/chrome-marks'
import { StickyActionBar } from '@/components/ui/StickyActionBar'
import { ToolbarChip } from '@/components/ui/ToolbarChip'

interface DecksCurateBarProps {
  selectedCount:  number
  totalCount:     number
  canReorder:     boolean
  onDone:         () => void
  onMoveToTop:    () => void
  onArchive:      () => void
  onCopy:         () => void
  onDelete:       () => void
}

/**
 * Bottom-anchored bulk action band that appears in Curate mode. Spans the full
 * viewport width and aligns its inner content to the page's 1440px container
 * (matching the same `px-6 md:px-12 lg:px-16` gutters used by the
 * deck list above). A 2px Inari Vermillion top rule pulls the bar into the
 * same brand vocabulary as `SectionCard` and the deck rows — the band reads as
 * a continuation of the page, not a floating widget on top of it.
 */
export function DecksCurateBar({
  selectedCount,
  totalCount,
  canReorder,
  onDone,
  onMoveToTop,
  onArchive,
  onCopy,
  onDelete,
}: DecksCurateBarProps): React.JSX.Element {
  const noSelection = selectedCount === 0

  return (
    <StickyActionBar ariaLabel="Bulk deck actions" brandStripe>
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:py-3.5 md:px-12 lg:px-16">
        <ToolbarChip onClick={onDone}>Done</ToolbarChip>

        {/* Selection count — same mono small-caps treatment as the
            decks-tabs / decks-utility-row eyebrows. */}
        <span className="font-mono text-xs tabular-nums text-faded-sumi">
          <span className="text-sumi-ink">{selectedCount}</span>
          {' selected '}
          <span className="text-faded-sumi/70">of</span>
          {' '}
          <span className="text-sumi-ink/85">{totalCount}</span>
        </span>

        {!canReorder && (
          <>
            <span className="hidden truncate font-mono text-sm text-faded-sumi md:inline">
              Sort by Study order to reorder
            </span>
            {/* Always available to assistive tech, regardless of viewport. */}
            <span id="decks-reorder-hint-sr" className="sr-only">
              Sort by Study order to reorder
            </span>
          </>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <BarAction
            onClick={onMoveToTop}
            disabled={noSelection || !canReorder}
            icon={<IconFlag className="h-3.5 w-3.5" />}
            label="Move to top"
            describedById={!canReorder ? 'decks-reorder-hint-sr' : undefined}
          />
          <BarAction
            onClick={onArchive}
            disabled={noSelection}
            icon={<IconHide className="h-3.5 w-3.5" />}
            label="Archive"
          />
          <BarAction
            onClick={onCopy}
            disabled={noSelection}
            icon={<IconCopy className="h-3.5 w-3.5" />}
            label="Copy"
          />
          <BarAction
            onClick={onDelete}
            disabled={noSelection}
            icon={<IconDelete className="h-3.5 w-3.5" />}
            label="Delete"
            danger
          />
        </div>
      </div>
    </StickyActionBar>
  )
}

function BarAction({
  onClick,
  disabled,
  icon,
  label,
  describedById,
  danger,
}: {
  onClick:        () => void
  disabled:       boolean
  icon:           React.ReactNode
  label:          string
  describedById?: string | undefined
  danger?:        boolean | undefined
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-describedby={describedById}
      className={[
        'ui-motion-colors inline-flex h-9 items-center gap-2 rounded-[2px] px-2.5 text-sm font-medium',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
        danger
          ? 'text-inari-vermillion-deep hover:bg-vermillion-wash'
          : 'text-sumi-ink hover:bg-cream-inset',
      ].join(' ')}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="hidden sm:inline">{label}</span>
      <span className="sr-only sm:hidden">{label}</span>
    </button>
  )
}
