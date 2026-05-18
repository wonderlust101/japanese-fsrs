import { forwardRef } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type ChipSize  = 'sm' | 'md'
type ChipState = 'default' | 'selected' | 'inactive'

interface ToolbarChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?:         ChipSize
  state?:        ChipState
  leadingNode?:  ReactNode
  trailingNode?: ReactNode
  /** Right-aligned secondary content (e.g. a count or status hint)
   *  rendered between the label and the trailing node. */
  meta?:         ReactNode
}

const SIZE_CLASS: Record<ChipSize, string> = {
  sm: 'h-8 text-sm',
  md: 'h-9 text-sm',
}

const STATE_CLASS: Record<ChipState, string> = {
  default:
    'border-soft-hairline bg-warm-paper-raised text-sumi-ink ' +
    'hover:border-faded-sumi hover:bg-cream-inset',
  selected:
    'border-inari-vermillion/40 bg-vermillion-wash text-inari-vermillion-deep ' +
    'hover:border-inari-vermillion/60',
  inactive:
    'border-soft-hairline bg-warm-paper-raised text-faded-sumi',
}

const BASE = [
  'ui-motion-colors inline-flex items-center gap-2 rounded-[2px] border',
  'pl-2.5 pr-2.5 font-medium',
  'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
  // HTML `disabled` drives the visual disabled state so callers don't have
  // to duplicate the fade-out / pointer rules. Matches the original
  // cards-pagination tuning of 45% opacity, neutral text, no hover lift.
  'disabled:cursor-not-allowed disabled:opacity-45 disabled:text-faded-sumi',
  'disabled:hover:border-soft-hairline disabled:hover:bg-warm-paper-raised',
].join(' ')

/**
 * The toolbar / utility-row chip primitive: a small ink-on-warm-paper
 * affordance shared by filter triggers, pagination buttons, dropdown
 * triggers, sticky-bar utility actions, and saved-view pills.
 *
 * Replaces ~12 verbatim copies of
 * `ui-motion-colors inline-flex h-9 items-center gap-2 rounded-[2px] border border-soft-hairline bg-warm-paper-raised pl-2.5 pr-2.5 text-sm text-sumi-ink`.
 *
 * Anatomy follows DESIGN.md card-system geometry: 2px corner, 1px
 * soft-hairline border, warm-paper-raised fill, cream-inset hover, sumi-ink
 * 1px focus outline at offset 2 (matches Button focus). No drop shadow at
 * rest — chips are part of the flat resting plane.
 *
 * Extends `ButtonHTMLAttributes` so any standard event handler (`onKeyDown`,
 * `onFocus`, etc.) or ARIA attribute passes through naturally. Use directly
 * inside dropdown trigger renderprops without re-enumerating event types.
 */
export const ToolbarChip = forwardRef<HTMLButtonElement, ToolbarChipProps>(
  (
    {
      size         = 'md',
      state        = 'default',
      leadingNode,
      trailingNode,
      meta,
      children,
      className,
      type         = 'button',
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          BASE,
          SIZE_CLASS[size],
          STATE_CLASS[state],
          className,
        )}
        {...rest}
      >
        {leadingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {leadingNode}
          </span>
        )}
        <span className="truncate">{children}</span>
        {meta !== undefined && (
          <span className="ml-auto tabular-nums text-faded-sumi">{meta}</span>
        )}
        {trailingNode !== undefined && (
          <span aria-hidden="true" className="inline-flex shrink-0">
            {trailingNode}
          </span>
        )}
      </button>
    )
  },
)

ToolbarChip.displayName = 'ToolbarChip'
