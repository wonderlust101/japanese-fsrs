'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import { useDevDockContext } from './DevDockContext'
import { useDraggableSnap, type Corner } from './useDraggableSnap'

const LAUNCHER_STORAGE_KEY = 'tomo:dev:launcher-corner'
const BUTTON_SIZE          = 40

// Geometry the centered-spawn calculation needs. Mirrors `DOCK_WIDTH` /
// `DOCK_HEIGHT_EST` in `DevDock.tsx`; kept inline rather than imported so
// the launcher doesn't pull DevDock's render path into its module graph.
// If the dock's footprint changes there, update both numbers — the dock's
// own resize-clamp will still correct minor drift after first paint.
const DOCK_WIDTH      = 360
const DOCK_HEIGHT_EST = 360

// Corner anchor classes when the launcher is resting. The live drag position
// is applied via inline style to follow the cursor exactly.
const CORNER_CLASSES: Record<Corner, string> = {
  tl: 'top-4 left-4',
  tr: 'top-4 right-4',
  bl: 'bottom-4 left-4',
  br: 'bottom-4 right-4',
}

// Where the popover hangs relative to the button, so it never spills off-screen
// when the button is anchored near a corner.
const MENU_CLASSES: Record<Corner, string> = {
  tl: 'top-full left-0 mt-2',
  tr: 'top-full right-0 mt-2',
  bl: 'bottom-full left-0 mb-2',
  br: 'bottom-full right-0 mb-2',
}

export interface FloatingLauncherProps {
  /** Forwarded to the registered launcher corner so the dock can anchor itself. */
  onCornerChange?: (corner: Corner) => void
}

export function FloatingLauncher({ onCornerChange }: FloatingLauncherProps): React.JSX.Element {
  const router       = useRouter()
  const ctx          = useDevDockContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const {
    corner,
    isDragging,
    livePosition,
    onPointerDown,
    consumeDragSuppress,
    resetCorner,
  } = useDraggableSnap({ storageKey: LAUNCHER_STORAGE_KEY, defaultCorner: 'br' })

  // Surface the launcher's current corner upward so the dock's initial
  // position can anchor near the button when no persisted dock position exists.
  useEffect(() => {
    onCornerChange?.(corner)
  }, [corner, onCornerChange])

  // Toggle the dock; when opening, spawn it at viewport center. Hoisted out
  // of the keydown handler so the menu item and the shortcut share a single
  // implementation.
  //
  // The toggle direction is decided by "is the dock currently showing at
  // center?" rather than just `ctx.closed`. That matters because the default
  // dock state is `closed: false` with a null position (corner default) — a
  // naive `closed`-only check would treat the dock as "already open" and
  // immediately set `closed: true` on the first keypress, hiding it instead
  // of centering it. With the position check below, any non-centered state
  // (default corner, dragged-elsewhere, collapsed, closed) converges on
  // "open at center" on press; only a press while the dock is *actually*
  // sitting open + expanded + centered closes it.
  const toggleDockCentered = useCallback((): void => {
    const targetX = Math.max(0, Math.round((window.innerWidth  - DOCK_WIDTH)      / 2))
    const targetY = Math.max(0, Math.round((window.innerHeight - DOCK_HEIGHT_EST) / 2))

    const showingAtCenter =
      !ctx.closed &&
      !ctx.collapsed &&
      ctx.position !== null &&
      Math.abs(ctx.position.x - targetX) < 4 &&
      Math.abs(ctx.position.y - targetY) < 4

    if (showingAtCenter) {
      ctx.setClosed(true)
    } else {
      ctx.setPosition({ x: targetX, y: targetY })
      ctx.setCollapsed(false)
      ctx.setClosed(false)
    }
  }, [ctx])

  // Global dev-tool shortcuts. Both skip when the user is typing so we don't
  // intercept legitimate input shortcuts.
  //
  //   ⌘⇧D / Ctrl⇧D → opens the component showcase.
  //   ⌘⇧0 / Ctrl⇧0 → toggles the dock; when opening, spawns at viewport
  //     center so a "lost" dock is one keystroke away from a known position.
  //     Bound at the document level so it works even if the launcher button
  //     itself is hard to reach (the whole point of the escape hatch).
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return

      // Skip when focus is inside a form control. `event.key === '0'` would
      // otherwise swallow a Shift+0 in any number input on the page.
      const target = event.target as HTMLElement | null
      if (target !== null) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      if (event.key === 'D' || event.key === 'd') {
        event.preventDefault()
        router.push('/dev/components')
        return
      }

      // `event.key === '0'` covers the unshifted digit. On most layouts Shift+0
      // also produces `)` — match both so the modifier combo behaves the same
      // regardless of which character the OS hands us.
      if (event.key === '0' || event.key === ')') {
        event.preventDefault()
        toggleDockCentered()
        setMenuOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router, toggleDockCentered])

  // Outside-click + Escape close the menu.
  useEffect(() => {
    if (!menuOpen) return

    function handleDocPointerDown(event: PointerEvent): void {
      const target = event.target as Node | null
      if (containerRef.current !== null && target !== null && !containerRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    document.addEventListener('pointerdown', handleDocPointerDown)
    document.addEventListener('keydown',     handleEscape)
    return () => {
      document.removeEventListener('pointerdown', handleDocPointerDown)
      document.removeEventListener('keydown',     handleEscape)
    }
  }, [menuOpen])

  const handleClick = useCallback((): void => {
    if (consumeDragSuppress()) return
    setMenuOpen((prev) => !prev)
  }, [consumeDragSuppress])

  const handleResetPosition = useCallback((): void => {
    resetCorner()
    setMenuOpen(false)
  }, [resetCorner])

  const handleResetDock = useCallback((): void => {
    ctx.resetDock()
    setMenuOpen(false)
  }, [ctx])

  const handleToggleDock = useCallback((): void => {
    ctx.setClosed(!ctx.closed)
    if (ctx.closed) ctx.setCollapsed(false)
    setMenuOpen(false)
  }, [ctx])

  // Menu mirror of the ⌘⇧0 keyboard shortcut: toggles the dock and, on the
  // open side of the toggle, spawns it at viewport center.
  const handleToggleCentered = useCallback((): void => {
    toggleDockCentered()
    setMenuOpen(false)
  }, [toggleDockCentered])

  const handleMenuLinkClick = useCallback((): void => {
    setMenuOpen(false)
  }, [])

  // Drag overrides corner positioning with raw cursor coords. When not
  // dragging, the rest position is the persisted corner.
  const dragStyle: React.CSSProperties | undefined =
    livePosition !== null
      ? { top: livePosition.y - BUTTON_SIZE / 2, left: livePosition.x - BUTTON_SIZE / 2 }
      : undefined
  const positionClass = livePosition !== null ? '' : CORNER_CLASSES[corner]

  const dockHidden = ctx.closed
  const hasPanels  = ctx.panels.length > 0

  return (
    <div
      ref={containerRef}
      className={cn('fixed z-[70]', positionClass)}
      style={dragStyle}
    >
      <button
        type="button"
        aria-label="Open dev tools"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onClick={handleClick}
        className={cn(
          'inline-flex items-center justify-center',
          'h-10 w-10 rounded-[2px]',
          'bg-sumi-ink text-warm-paper-raised',
          'hover:bg-sumi-ink/90',
          'focus-visible:outline focus-visible:outline-1',
          'focus-visible:outline-warm-paper-raised focus-visible:outline-offset-2',
          'shadow-[0_8px_24px_-12px_rgba(31,26,24,0.55)] select-none touch-none',
          isDragging ? 'cursor-grabbing scale-[1.05]' : 'cursor-grab',
          'transition-transform duration-150 ease-out',
        )}
      >
        {/* Two opposing chevrons, the dev/console shorthand `</>`. Distinct
            from any product icon. The vermillion dot signals the dev nature. */}
        <span className="relative inline-flex items-center justify-center">
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 6l-3 4 3 4" />
            <path d="M13 6l3 4-3 4" />
          </svg>
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-1.5 w-1.5 rounded-full bg-inari-vermillion"
          />
        </span>
      </button>

      {menuOpen && !isDragging && (
        <div
          role="menu"
          aria-label="Dev tools"
          className={cn(
            'absolute min-w-[224px]',
            'bg-sumi-ink text-warm-paper-raised',
            'border border-sumi-ink/15 rounded-[2px] py-1',
            'shadow-[0_12px_36px_-16px_rgba(31,26,24,0.55)]',
            MENU_CLASSES[corner],
          )}
        >
          <MenuButton onClick={handleToggleDock}>
            {dockHidden
              ? hasPanels ? 'Show dev dock' : 'Show dev dock (no panels here)'
              : 'Hide dev dock'}
          </MenuButton>
          <MenuLink href="/dev/components" onClick={handleMenuLinkClick}>
            Component showcase
          </MenuLink>

          <Divider />

          <MenuButton onClick={handleToggleCentered} shortcut="⌘⇧0">
            Spawn at center
          </MenuButton>
          <MenuButton onClick={handleResetDock}>Reset dock position</MenuButton>
          <MenuButton onClick={handleResetPosition}>Reset launcher position</MenuButton>

          <Divider />

          <MenuHint>
            <span className="flex items-baseline gap-1.5">
              <kbd className="font-mono">⌘ ⇧ D</kbd>
              <span className="text-warm-paper-raised/35">·</span>
              <kbd className="font-mono">Ctrl ⇧ D</kbd>
              <span className="ml-0.5 text-warm-paper-raised/55">opens showcase</span>
            </span>
            <span className="mt-0.5 flex items-baseline gap-1.5">
              <kbd className="font-mono">⌘ ⇧ 0</kbd>
              <span className="text-warm-paper-raised/35">·</span>
              <kbd className="font-mono">Ctrl ⇧ 0</kbd>
              <span className="ml-0.5 text-warm-paper-raised/55">toggle (center)</span>
            </span>
          </MenuHint>
        </div>
      )}
    </div>
  )
}

// ── Menu primitives ──────────────────────────────────────────────────────────

function MenuButton({
  onClick,
  disabled,
  shortcut,
  children,
}: {
  onClick:   () => void
  disabled?: boolean
  /**
   * Optional trailing shortcut hint, e.g. "⌘⇧0". Rendered right-aligned in
   * the standard `kbd` style. Display-only — the actual key binding lives
   * on the document keydown listener, not here.
   */
  shortcut?: string
  children:  React.ReactNode
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled === true}
      className={cn(
        'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[0.8rem] cursor-pointer',
        'text-warm-paper-raised/85 hover:bg-warm-paper-raised/10 hover:text-warm-paper-raised',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-warm-paper-raised/85',
        'transition-colors duration-150 ease-out',
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      {shortcut !== undefined && (
        <kbd
          aria-hidden="true"
          className="shrink-0 font-mono text-[0.625rem] tracking-[0.05em] text-warm-paper-raised/55"
        >
          {shortcut}
        </kbd>
      )}
    </button>
  )
}

function MenuLink({
  href,
  onClick,
  children,
}: {
  href:     string
  onClick:  () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className={cn(
        'block px-3 py-2 text-[0.8rem]',
        'text-warm-paper-raised/85 hover:bg-warm-paper-raised/10 hover:text-warm-paper-raised',
        'transition-colors duration-150 ease-out',
      )}
    >
      {children}
    </Link>
  )
}

function Divider(): React.JSX.Element {
  return <div className="my-1 border-t border-warm-paper-raised/10" aria-hidden="true" />
}

function MenuHint({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-col px-3 py-1.5 text-[0.625rem] leading-tight text-warm-paper-raised/55">
      {children}
    </div>
  )
}
