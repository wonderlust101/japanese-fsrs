'use client'

import {
  IconCopy,
  IconDelete,
  IconFlag,
  IconHide,
} from '@/components/icons/chrome-marks'

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
 * Sticky bottom action bar that appears in Curate mode. Lives 24px above the
 * viewport edge so it doesn't sit flush against the browser chrome. Max-width
 * matches the list container so it visually owns the same column.
 *
 * Hides on small viewports via different sizing (full-width minus 16px padding).
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
    <div
      role="region"
      aria-label="Bulk deck actions"
      className={[
        'pointer-events-none fixed inset-x-0 bottom-3 z-20 flex justify-center px-3',
        'sm:bottom-5 sm:px-6',
      ].join(' ')}
    >
      <div
        className={[
          'pointer-events-auto flex w-full max-w-[64rem] items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 py-2.5',
          'shadow-[var(--shadow-card)]',
        ].join(' ')}
      >
        <button
          type="button"
          onClick={onDone}
          className={[
            'ui-motion-colors inline-flex h-9 items-center rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-3 text-sm font-medium text-sumi-ink',
            'hover:border-faded-sumi hover:bg-cream-inset',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          ].join(' ')}
        >
          Done
        </button>

        <span className="hidden font-mono text-xs tabular-nums text-faded-sumi sm:inline">
          <span className="text-sumi-ink">{selectedCount}</span>
          {' selected of '}
          <span className="text-sumi-ink/85">{totalCount}</span>
        </span>
        <span className="font-mono text-xs tabular-nums text-faded-sumi sm:hidden">
          <span className="text-sumi-ink">{selectedCount}</span>/<span>{totalCount}</span>
        </span>

        {!canReorder && (
          <span className="hidden truncate text-xs italic text-faded-sumi md:inline">
            Sort by Study order to reorder.
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <BarAction
            onClick={onMoveToTop}
            disabled={noSelection || !canReorder}
            icon={<IconFlag className="h-3.5 w-3.5" />}
            label="Move to top"
            hint={!canReorder ? 'Sort by Study order to reorder' : undefined}
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
    </div>
  )
}

function BarAction({
  onClick,
  disabled,
  icon,
  label,
  hint,
  danger,
}: {
  onClick:    () => void
  disabled:   boolean
  icon:       React.ReactNode
  label:      string
  hint?:      string | undefined
  danger?:    boolean | undefined
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={hint ?? label}
      className={[
        'ui-motion-colors inline-flex h-9 items-center gap-1.5 rounded-[2px] px-2.5 text-sm font-medium',
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
