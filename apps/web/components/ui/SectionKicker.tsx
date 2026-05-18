import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type KickerSize  = 'xs' | 'sm' | 'md'
type KickerTone  = 'default' | 'ink' | 'inverse'
type KickerAs    = 'p' | 'span' | 'div' | 'h2' | 'h3' | 'header'

interface SectionKickerProps {
  children:    ReactNode
  size?:       KickerSize
  tone?:       KickerTone
  as?:         KickerAs
  className?:  string
  /** Letter-spacing override. The default `[0.16em]` matches Tomo's
   *  uppercase-mono eyebrow register; pass `'wide'` for the `[0.18em]`
   *  display used on the page-state empty-card label. */
  tracking?:   'normal' | 'wide'
}

const SIZE_CLASS: Record<KickerSize, string> = {
  xs: 'text-[0.625rem]',
  sm: 'text-[0.6875rem]',
  md: 'text-xs',
}

const TONE_CLASS: Record<KickerTone, string> = {
  default: 'text-faded-sumi',
  ink:     'text-sumi-ink',
  inverse: 'text-warm-paper-raised',
}

/**
 * The mono-uppercase "section eyebrow" used to label modules, dev panels,
 * fieldsets, and page sections throughout Tomo (~180+ sites).
 *
 * Renders as:
 * ```
 * <p class="font-mono uppercase tracking-[0.16em] text-faded-sumi text-[0.6875rem]">
 *   {children}
 * </p>
 * ```
 *
 * Replaces ad-hoc `font-mono text-[0.625rem|0.6875rem] uppercase tracking-[0.16em] text-faded-sumi`
 * combos with one named primitive so the kicker stays consistent across
 * Today, Insights, Settings, Cards, Decks, and the dev panels.
 */
export function SectionKicker({
  children,
  size      = 'sm',
  tone      = 'default',
  as        = 'p',
  className,
  tracking  = 'normal',
}: SectionKickerProps): React.JSX.Element {
  const Element = as as 'p'
  return (
    <Element
      className={cn(
        'font-mono uppercase font-medium',
        SIZE_CLASS[size],
        TONE_CLASS[tone],
        tracking === 'wide' ? 'tracking-[0.18em]' : 'tracking-[0.16em]',
        className,
      )}
    >
      {children}
    </Element>
  )
}
