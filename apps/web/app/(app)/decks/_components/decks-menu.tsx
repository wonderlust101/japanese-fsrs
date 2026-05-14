'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * A small headless menu primitive used by the Library page's filter dropdowns
 * (Sort, Type) and the per-row kebab. Keyboard-navigable, click-outside-to-
 * close, Esc-to-close, ARIA menu/menuitem semantics. Floats below or above
 * the trigger depending on viewport space.
 *
 * Intentionally local to the Library page rather than a global primitive: the
 * project does not yet have a global menu/popover primitive, and shipping one
 * is outside the scope of this redesign. If a global primitive lands later,
 * this file is the obvious migration target.
 */

interface DecksMenuProps {
  /** Renderprop for the trigger element. Receives onClick + aria-expanded. */
  renderTrigger: (api: {
    onClick:        () => void
    onKeyDown:      (event: React.KeyboardEvent) => void
    ariaExpanded:   boolean
    triggerRef:     React.RefObject<HTMLButtonElement | null>
    menuId:         string
  }) => ReactNode

  /** Menu content. Receives close() so items can dismiss after selection. */
  renderItems: (api: {
    close:    () => void
    menuId:   string
  }) => ReactNode

  /** Menu width. Defaults to fit-content. */
  menuClassName?: string

  /** Anchor side. Default: 'start' (left-aligned with trigger). */
  align?: 'start' | 'end'

  /** Disable the menu entirely. Trigger still renders but can't open. */
  disabled?: boolean
}

export function DecksMenu({
  renderTrigger,
  renderItems,
  menuClassName = '',
  align         = 'start',
  disabled      = false,
}: DecksMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [direction, setDirection] = useState<'down' | 'up'>('down')
  const menuId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  const toggle = useCallback(() => {
    if (disabled) return
    setOpen((v) => !v)
  }, [disabled])

  // Click outside closes the menu. Tracked from the document so nested popovers
  // in dialogs still get the close signal.
  useEffect(() => {
    if (!open) return
    function onDown(event: MouseEvent | TouchEvent): void {
      const target = event.target
      if (!(target instanceof Node)) return
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  // Escape closes. Tab through the menu items naturally because the items
  // render as real buttons; once focus leaves, click-outside also closes.
  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  // Decide whether the menu opens downward or upward based on viewport space.
  useEffect(() => {
    if (!open) return
    const trigger = triggerRef.current
    if (trigger === null) return
    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    setDirection(spaceBelow < 240 && spaceAbove > spaceBelow ? 'up' : 'down')
  }, [open])

  // After open, move focus into the menu so keyboard users can navigate.
  useEffect(() => {
    if (!open) return
    // Defer to next tick so the menu DOM has mounted.
    const id = window.setTimeout(() => {
      const first = menuRef.current?.querySelector<HTMLElement>(
        '[role="menuitem"]:not([disabled])',
      )
      first?.focus()
    }, 0)
    return () => window.clearTimeout(id)
  }, [open])

  function onTriggerKeyDown(event: React.KeyboardEvent): void {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  function onMenuKeyDown(event: React.KeyboardEvent): void {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    )
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      const next = items[(currentIndex + 1 + items.length) % items.length]
      next?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = items[(currentIndex - 1 + items.length) % items.length]
      prev?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  return (
    <div className="relative inline-flex">
      {renderTrigger({
        onClick:      toggle,
        onKeyDown:    onTriggerKeyDown,
        ariaExpanded: open,
        triggerRef,
        menuId,
      })}

      {open && (
        <div
          ref={menuRef}
          role="menu"
          id={menuId}
          aria-orientation="vertical"
          onKeyDown={onMenuKeyDown}
          className={[
            'absolute z-30 min-w-[10rem] rounded-[2px] border border-soft-hairline bg-warm-paper-raised py-1.5',
            'shadow-[var(--shadow-card)]',
            direction === 'down' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            align === 'end' ? 'right-0' : 'left-0',
            menuClassName,
          ].join(' ')}
        >
          {renderItems({ close, menuId })}
        </div>
      )}
    </div>
  )
}

/**
 * Standard menu item: a real button so screen readers and keyboard users get
 * native semantics. Includes a leading-glyph slot and an optional trailing
 * check-mark (for radio-like selection states).
 */
interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  leading?:  ReactNode
  selected?: boolean
  danger?:   boolean
}

export function MenuItem({
  leading,
  selected,
  danger,
  className = '',
  children,
  ...rest
}: MenuItemProps): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      className={[
        'group flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm',
        'ui-motion-colors',
        'focus:outline-none focus:bg-cream-inset',
        'hover:bg-cream-inset',
        'disabled:opacity-50 disabled:pointer-events-none',
        danger
          ? 'text-inari-vermillion-deep hover:bg-vermillion-wash focus:bg-vermillion-wash'
          : 'text-sumi-ink',
        className,
      ].join(' ')}
      {...rest}
    >
      {leading !== undefined && (
        <span
          aria-hidden="true"
          className={[
            'inline-flex h-4 w-4 shrink-0 items-center justify-center',
            danger ? 'text-inari-vermillion-deep' : 'text-faded-sumi group-hover:text-sumi-ink',
          ].join(' ')}
        >
          {leading}
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {selected === true && (
        <span aria-hidden="true" className="text-inari-vermillion">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 6.5 L5 9 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </button>
  )
}

export function MenuSeparator(): React.JSX.Element {
  return <div aria-hidden="true" className="my-1 h-px bg-soft-hairline" />
}
