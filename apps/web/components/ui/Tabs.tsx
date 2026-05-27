'use client'

import { useCallback, useId, useRef } from 'react'

import { cn } from '@/lib/utils'

export interface TabItem<V extends string> {
  value: V
  label: string
  /** Optional count rendered as `(n)` after the label. Omit or pass 0 to hide. */
  badge?: number
  /**
   * Accessible description for the badge, used in the badge's aria-label.
   * The count is prepended automatically, so pass only the noun
   * (e.g. 'modified', 'included'). Defaults to 'modified' to preserve the
   * legacy meaning when callers haven't opted in.
   */
  badgeLabel?: string
  /**
   * Custom display string for the badge (e.g. "3/12"). When set, replaces
   * the numeric `badge` rendering but the `badge` count still controls
   * visibility (>0 to show) and feeds the aria-label count.
   */
  badgeText?: string
}

interface TabsProps<V extends string> {
  items:     ReadonlyArray<TabItem<V>>
  value:     V
  onChange:  (next: V) => void
  ariaLabel: string
  className?: string
  /**
   * Shared id namespace for the tab triggers and their matching panels. Pass
   * the same `idBase` (typically from `useId()`) to every `TabPanel` so
   * `aria-controls` / `aria-labelledby` resolve to real nodes. When omitted,
   * a private id is used and panels lose their explicit binding.
   */
  idBase?: string
}

export function tabTriggerId(idBase: string, value: string): string {
  return `${idBase}-tab-${value}`
}

export function tabPanelId(idBase: string, value: string): string {
  return `${idBase}-panel-${value}`
}

// Tab nav primitive. Mono uppercase labels, hairline rail underneath, a 2px
// vermillion underline beneath the active tab. Count badges sit to the right
// of the label in faded sumi; they suppress when 0 or undefined.
//
// Keyboard: ←/→ move focus between tabs, Home/End jump to ends; activation
// is automatic on focus (one less keystroke for the canonical learner).

export function Tabs<V extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
  idBase,
}: TabsProps<V>): React.JSX.Element {
  const fallbackId = useId()
  const ns = idBase ?? fallbackId
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const handleKey = useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    const key = event.key
    if (key !== 'ArrowLeft' && key !== 'ArrowRight' && key !== 'Home' && key !== 'End') return
    event.preventDefault()
    const idx = items.findIndex((t) => t.value === value)
    let next = idx
    if (key === 'ArrowLeft')  next = (idx - 1 + items.length) % items.length
    if (key === 'ArrowRight') next = (idx + 1) % items.length
    if (key === 'Home')       next = 0
    if (key === 'End')        next = items.length - 1
    const nextItem = items[next]
    if (nextItem !== undefined) {
      onChange(nextItem.value)
      tabRefs.current[next]?.focus()
    }
  }, [items, value, onChange])

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKey}
      className={cn(
        'relative flex items-stretch gap-6 border-b border-soft-hairline',
        className,
      )}
    >
      {items.map((item, i) => {
        const selected = item.value === value
        const triggerId = tabTriggerId(ns, item.value)
        const panelId   = tabPanelId(ns, item.value)
        const showBadge = item.badge !== undefined && item.badge > 0
        return (
          <button
            key={item.value}
            ref={(el) => { tabRefs.current[i] = el }}
            id={triggerId}
            type="button"
            role="tab"
            aria-selected={selected}
            // Only bind aria-controls when the caller shares an idBase with
            // matching <TabPanel>s. Without one, the panelId derives from a
            // private fallback that no panel renders — so emitting it would
            // dangle. Pure-nav Tabs (no TabPanel) thus carry no aria-controls.
            {...(idBase !== undefined && { 'aria-controls': panelId })}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px py-3 pointer-coarse:min-h-11 font-mono text-sm',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-4',
              selected
                ? 'text-sumi-ink'
                : 'text-faded-sumi hover:text-sumi-ink',
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span>{item.label}</span>
              {showBadge && (
                <span
                  aria-label={`${item.badge} ${item.badgeLabel ?? 'modified'}`}
                  className={cn(
                    'inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1.5',
                    'font-mono text-sm tabular-nums tracking-normal',
                    selected
                      ? 'bg-inari-vermillion text-warm-paper-raised'
                      : 'bg-vermillion-wash text-inari-vermillion-deep',
                  )}
                >
                  {item.badgeText ?? item.badge}
                </span>
              )}
            </span>
            {selected && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-0.5 bg-inari-vermillion"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// TabPanel wraps the active panel. Use one per panel; show/hide is the
// caller's responsibility (we don't render hidden panels to save DOM and
// avoid accidental focus traps).
//
// Pass the same `idBase` you gave to `Tabs` plus this panel's `value` so the
// rendered `id` / `aria-labelledby` match the trigger's `aria-controls`.

interface TabPanelProps {
  idBase:     string
  value:      string
  className?: string
  children:   React.ReactNode
}

export function TabPanel({
  idBase,
  value,
  className,
  children,
}: TabPanelProps): React.JSX.Element {
  return (
    <div
      id={tabPanelId(idBase, value)}
      role="tabpanel"
      aria-labelledby={tabTriggerId(idBase, value)}
      className={cn('pt-6', className)}
    >
      {children}
    </div>
  )
}
