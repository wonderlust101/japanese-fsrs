'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { SessionDevToolbar } from './session-dev-toolbar'

// Floating, draggable dev dock for the review session surface. Mirrors the
// dock pattern used by Today / Setup / Staging so the affordance feels
// consistent across the app. Position + collapsed state persist to
// localStorage so the dock stays where the engineer left it across reloads.
//
// Rendering is gated upstream: this file is only mounted by the session page
// when `process.env.NODE_ENV !== 'production'`. The component itself is
// dev-agnostic and could be reused elsewhere if needed.

const STORAGE_KEY  = 'tomo.session.devtools'
const EDGE_PADDING = 16
const PANEL_WIDTH  = 360
const NUDGE_STEP   = 16

interface DockPersisted {
  x:         number
  y:         number
  collapsed: boolean
}

function readPersisted(): DockPersisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const c = parsed as Partial<DockPersisted>
    if (typeof c.x === 'number' && typeof c.y === 'number' && typeof c.collapsed === 'boolean') {
      return { x: c.x, y: c.y, collapsed: c.collapsed }
    }
    return null
  } catch {
    return null
  }
}

function writePersisted(value: DockPersisted): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value)) } catch { /* dev-only surface */ }
}

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: 16 }
  return {
    x: Math.max(EDGE_PADDING, window.innerWidth  - PANEL_WIDTH - EDGE_PADDING),
    y: Math.max(EDGE_PADDING, window.innerHeight - 380         - EDGE_PADDING),
  }
}

function clamp(x: number, y: number, h: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const maxX = Math.max(EDGE_PADDING, window.innerWidth  - PANEL_WIDTH - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - h           - EDGE_PADDING)
  return {
    x: Math.min(Math.max(EDGE_PADDING, x), maxX),
    y: Math.min(Math.max(EDGE_PADDING, y), maxY),
  }
}

export function SessionDevToolsDock(): React.JSX.Element {
  const containerRef  = useRef<HTMLDivElement | null>(null)
  const handleRef     = useRef<HTMLButtonElement | null>(null)
  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)

  const [position,  setPosition]  = useState<{ x: number; y: number }>(() => defaultPosition())
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated,  setHydrated]  = useState(false)

  useLayoutEffect(() => {
    const persisted = readPersisted()
    if (persisted !== null) {
      const h = containerRef.current?.offsetHeight ?? 380
      setPosition(clamp(persisted.x, persisted.y, h))
      setCollapsed(persisted.collapsed)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const t = window.setTimeout(() => writePersisted({ x: position.x, y: position.y, collapsed }), 250)
    return () => window.clearTimeout(t)
  }, [position, collapsed, hydrated])

  useEffect(() => {
    function onResize(): void {
      const h = containerRef.current?.offsetHeight ?? 380
      setPosition((p) => clamp(p.x, p.y, h))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragOriginRef.current = { pointerX: e.clientX, pointerY: e.clientY, x: position.x, y: position.y }
  }, [position])

  const onDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    const origin = dragOriginRef.current
    if (origin === null) return
    const h = containerRef.current?.offsetHeight ?? 380
    setPosition(clamp(origin.x + (e.clientX - origin.pointerX), origin.y + (e.clientY - origin.pointerY), h))
  }, [])

  const endDrag = useCallback((e: React.PointerEvent<HTMLButtonElement>): void => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragOriginRef.current = null
  }, [])

  const onHandleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>): void => {
    const h = containerRef.current?.offsetHeight ?? 380
    if      (e.key === 'ArrowUp')    { e.preventDefault(); setPosition((p) => clamp(p.x, p.y - NUDGE_STEP, h)) }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); setPosition((p) => clamp(p.x, p.y + NUDGE_STEP, h)) }
    else if (e.key === 'ArrowLeft')  { e.preventDefault(); setPosition((p) => clamp(p.x - NUDGE_STEP, p.y, h)) }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPosition((p) => clamp(p.x + NUDGE_STEP, p.y, h)) }
    else if (e.key === 'Home')       { e.preventDefault(); setPosition(defaultPosition()) }
  }, [])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Review session dev tools"
      style={{
        position:  'fixed',
        left:      `${position.x}px`,
        top:       `${position.y}px`,
        width:     `min(${PANEL_WIDTH}px, calc(100vw - ${EDGE_PADDING * 2}px))`,
        maxHeight: `calc(100vh - ${EDGE_PADDING * 2}px)`,
        zIndex:    70,
      }}
      className="flex flex-col rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised shadow-[0_8px_24px_-12px_rgba(31,26,24,0.4)]"
    >
      <div className="flex items-center gap-2 border-b border-warm-paper-raised/10 px-2 py-1.5">
        <button
          ref={handleRef}
          type="button"
          aria-label="Drag dev tools (arrow keys to nudge, Home to reset position)"
          onPointerDown={startDrag}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onHandleKeyDown}
          className="flex-1 cursor-grab active:cursor-grabbing rounded-[2px] px-2 py-1 text-left font-mono text-xs uppercase tracking-[0.16em] text-warm-paper-raised touch-none select-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
        >
          Session dev tools · {collapsed ? 'collapsed' : 'open'}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!collapsed}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10 cursor-pointer"
        >
          {collapsed ? '▾' : '▴'}
        </button>
      </div>

      {!collapsed && (
        <div className="overflow-y-auto p-3">
          <SessionDevToolbar />
        </div>
      )}
    </div>
  )
}
