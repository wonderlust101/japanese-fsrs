'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Corner } from './useDraggableSnap'
import { useDraggableSnap } from './useDraggableSnap'

const STORAGE_KEY  = 'tomo:dev:launcher-corner'
const BUTTON_SIZE  = 40
const DASHBOARD_DEV_TOOLS_TOGGLE_EVENT = 'tomo:dashboard-dev-tools:toggle'

// Corner anchor classes when resting; the live drag position is applied via
// inline style to follow the cursor exactly.
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

export function FloatingLauncher(): React.JSX.Element | null {
  // process.env.NODE_ENV is folded to a string literal at build time, so this
  // entire branch is dead-code-eliminated in production bundles.
  if (process.env.NODE_ENV !== 'development') return null
  return <FloatingLauncherInner />
}

function FloatingLauncherInner(): React.JSX.Element {
  const router        = useRouter()
  const pathname      = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDashboard = pathname === '/dashboard'

  const {
    corner,
    isDragging,
    livePosition,
    onPointerDown,
    consumeDragSuppress,
    resetCorner,
  } = useDraggableSnap({ storageKey: STORAGE_KEY, defaultCorner: 'br' })

  // Cmd/Ctrl + Shift + D opens the showcase from anywhere. Skip when the user
  // is actively typing so we don't fight legitimate input shortcuts.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      const isShortcut =
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        (event.key === 'D' || event.key === 'd')
      if (!isShortcut) return

      const target = event.target as HTMLElement | null
      if (target !== null) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
      }

      event.preventDefault()
      router.push('/dev/components')
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [router])

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
    // If the gesture was actually a drag, suppress the click that browsers
    // synthesize after pointerup — otherwise releasing the drag would toggle
    // the menu on every drop.
    if (consumeDragSuppress()) return
    setMenuOpen(prev => !prev)
  }, [consumeDragSuppress])

  const handleResetPosition = useCallback((): void => {
    resetCorner()
    setMenuOpen(false)
  }, [resetCorner])

  const handleOpenShowcase = useCallback((): void => {
    setMenuOpen(false)
  }, [])

  const handleToggleDashboardTools = useCallback((): void => {
    window.dispatchEvent(new CustomEvent(DASHBOARD_DEV_TOOLS_TOGGLE_EVENT))
    setMenuOpen(false)
  }, [])

  // Drag overrides corner positioning with raw cursor coords. When not
  // dragging, the rest position is the persisted corner.
  const dragStyle: React.CSSProperties | undefined =
    livePosition !== null
      ? { top: livePosition.y - BUTTON_SIZE / 2, left: livePosition.x - BUTTON_SIZE / 2 }
      : undefined
  const positionClass = livePosition !== null ? '' : CORNER_CLASSES[corner]

  return (
    <div
      ref={containerRef}
      className={['fixed z-50', positionClass].join(' ').trim()}
      style={dragStyle}
    >
      <button
        type="button"
        aria-label="Open dev tools"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onPointerDown={onPointerDown}
        onClick={handleClick}
        className={[
          'inline-flex items-center justify-center',
          'h-10 w-10 rounded-[2px]',
          'bg-inari-vermillion text-warm-paper-raised',
          'hover:bg-inari-vermillion-deep',
          'focus-visible:outline focus-visible:outline-1',
          'focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
          'shadow-card select-none touch-none',
          isDragging ? 'cursor-grabbing scale-[1.05]' : 'cursor-grab',
          'ui-motion-transform',
        ].join(' ')}
      >
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
      </button>

      {menuOpen && !isDragging && (
        <div
          role="menu"
          aria-label="Dev tools"
          className={[
            'absolute min-w-[208px]',
            'bg-warm-paper-raised border border-soft-hairline rounded-[2px]',
            'shadow-lg py-1',
            MENU_CLASSES[corner],
          ].join(' ')}
        >
          <Link
            href="/dev/components"
            role="menuitem"
            onClick={handleOpenShowcase}
            className="ui-motion-colors block px-3 py-2 text-sm text-sumi-ink hover:bg-cream-inset"
          >
            Open component showcase
          </Link>
          {isDashboard && (
            <button
              type="button"
              role="menuitem"
              onClick={handleToggleDashboardTools}
              className="ui-motion-colors block w-full px-3 py-2 text-left text-sm text-sumi-ink hover:bg-cream-inset"
            >
              Toggle dashboard preview controls
            </button>
          )}
          <div className="my-1 border-t border-soft-hairline" />
          <button
            type="button"
            role="menuitem"
            onClick={handleResetPosition}
            className="ui-motion-colors block w-full text-left px-3 py-2 text-sm text-faded-sumi hover:bg-cream-inset hover:text-sumi-ink"
          >
            Reset launcher position
          </button>
          <div className="px-3 py-2 text-xs text-faded-sumi border-t border-soft-hairline mt-1 leading-tight">
            Shortcut <kbd className="font-mono">⌘ ⇧ D</kbd>
            <span className="mx-1 text-soft-hairline">/</span>
            <kbd className="font-mono">Ctrl ⇧ D</kbd>
          </div>
        </div>
      )}
    </div>
  )
}
