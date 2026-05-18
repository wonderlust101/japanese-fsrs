'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'
import { SectionKicker } from '@/components/ui/SectionKicker'

type PanelPosition = 'bottom-left' | 'bottom-right'

interface FixturePanelProps {
  /** Eyebrow label rendered in the collapsed header. e.g. "Dev · Insights state". */
  title:        string
  /** Currently-active value shown on the right side of the header (e.g. "Attention week"). */
  summary?:     string
  children:     ReactNode
  defaultOpen?: boolean
  position?:    PanelPosition
  /** Width override. Default `w-[18.5rem] max-w-[calc(100vw-2rem)]`. */
  widthClass?:  string
  ariaLabel:    string
  /** Optional footer note rendered below the body. */
  footer?:      ReactNode
}

const POSITION_CLASS: Record<PanelPosition, string> = {
  'bottom-left':  'bottom-4 left-4',
  'bottom-right': 'bottom-4 right-4',
}

/**
 * Development-only fixture / state panel. Replaces the six verbatim copies of
 * the bottom-left dev panel shell across insights/cards/decks dev tooling
 * (`InsightsDevPanel`, `MistakesDevPanel`, `ProgressDevPanel`,
 * `StatisticsDevPanel`, `cards-dev-panel`, `dev-state-panel`).
 *
 * The panel:
 *   - Is fixed bottom-left (or bottom-right) at z-40.
 *   - Has a collapsible header that always shows the title + current summary.
 *   - Owns no fixture logic itself — callers pass the body (typically a radio
 *     fieldset) as children so the panel can serve any state-cycling need.
 *
 * Renders nothing unless `process.env.NODE_ENV === 'development'`. The check
 * happens here (not at call sites) so consumers can keep markup flat.
 */
export function FixturePanel({
  title,
  summary,
  children,
  defaultOpen = true,
  position    = 'bottom-left',
  widthClass  = 'w-[18.5rem] max-w-[calc(100vw-2rem)]',
  ariaLabel,
  footer,
}: FixturePanelProps): React.JSX.Element | null {
  const [open, setOpen] = useState(defaultOpen)

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      className={cn(
        'fixed z-40 rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-[var(--shadow-card)]',
        POSITION_CLASS[position],
        widthClass,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 border-b border-soft-hairline px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <SectionKicker size="xs">{title}</SectionKicker>
        {summary !== undefined && (
          <span className="font-mono text-[0.6875rem] text-sumi-ink">
            {summary}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="p-2.5">{children}</div>
          {footer !== undefined && (
            <div className="border-t border-soft-hairline px-3 py-1.5">
              {footer}
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface FixtureOptionProps {
  name:        string
  value:       string
  checked:     boolean
  onChange:    () => void
  label:       string
  description?: string
}

/**
 * Standard radio row used inside FixturePanel's body. Optional — callers can
 * pass arbitrary children — but covers the predominant fixture-list pattern.
 */
export function FixtureOption({
  name,
  value,
  checked,
  onChange,
  label,
  description,
}: FixtureOptionProps): React.JSX.Element {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-2 rounded-[2px] border px-2.5 py-1.5 text-xs transition-colors',
        checked
          ? 'border-inari-vermillion bg-inari-vermillion/5'
          : 'border-transparent hover:border-soft-hairline hover:bg-cream-inset/45',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-3 w-3 accent-inari-vermillion"
      />
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sumi-ink">{label}</div>
        {description !== undefined && (
          <div className="mt-0.5 leading-snug text-faded-sumi">{description}</div>
        )}
      </div>
    </label>
  )
}

interface FixtureOptionListProps {
  ariaLabel: string
  children:  ReactNode
}

export function FixtureOptionList({
  ariaLabel,
  children,
}: FixtureOptionListProps): React.JSX.Element {
  return (
    <fieldset className="space-y-1" aria-label={ariaLabel}>
      {children}
    </fieldset>
  )
}
