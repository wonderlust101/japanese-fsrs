'use client'

import { useCallback, useId, useRef } from 'react'

import { cn } from '@/lib/utils'

export interface TabItem<V extends string> {
  value: V
  label: string
  /** Optional count rendered as `(n)` after the label. Omit or pass 0 to hide. */
  badge?: number
}

interface TabsProps<V extends string> {
  items:     ReadonlyArray<TabItem<V>>
  value:     V
  onChange:  (next: V) => void
  ariaLabel: string
  className?: string
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
}: TabsProps<V>): React.JSX.Element {
  const idBase = useId()
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
        const tabId    = `${idBase}-tab-${item.value}`
        const panelId  = `${idBase}-panel-${item.value}`
        const showBadge = item.badge !== undefined && item.badge > 0
        return (
          <button
            key={item.value}
            ref={(el) => { tabRefs.current[i] = el }}
            id={tabId}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative -mb-px py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em]',
              'transition-colors duration-150 ease-out',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-4',
              selected
                ? 'text-sumi-ink'
                : 'text-faded-sumi hover:text-sumi-ink',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{item.label}</span>
              {showBadge && (
                <span
                  aria-label={`${item.badge} modified`}
                  className={cn(
                    'inline-flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1.5',
                    'font-mono text-[0.625rem] tabular-nums tracking-normal',
                    selected
                      ? 'bg-inari-vermillion text-warm-paper-raised'
                      : 'bg-vermillion-wash text-inari-vermillion-deep',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </span>
            {selected && (
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-[2px] bg-inari-vermillion"
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

interface TabPanelProps {
  id?:        string
  ariaLabelledBy?: string
  className?: string
  children:   React.ReactNode
}

export function TabPanel({
  id,
  ariaLabelledBy,
  className,
  children,
}: TabPanelProps): React.JSX.Element {
  return (
    <div
      {...(id !== undefined && { id })}
      role="tabpanel"
      {...(ariaLabelledBy !== undefined && { 'aria-labelledby': ariaLabelledBy })}
      className={cn('pt-6', className)}
    >
      {children}
    </div>
  )
}
