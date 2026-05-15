'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import { DashboardHeroDevToolbar, type HeroDevControls } from './today-hero-dev-toolbar'
import { DashboardModulesDevToolbar, type ModuleDevControls } from './today-modules-dev-toolbar'

const STORAGE_KEY = 'tomo.today.devtools'
const EDGE_PADDING = 16
const PANEL_WIDTH = 448 // matches min(28rem, ...) at desktop widths
const NUDGE_STEP = 16

interface DockPersisted {
  x:         number
  y:         number
  collapsed: boolean
}

interface TodayDevToolsDockProps {
  heroControls:   HeroDevControls
  moduleControls: ModuleDevControls
  onHeroChange:   (next: HeroDevControls) => void
  onModuleChange: (next: ModuleDevControls) => void
  onClose:        () => void
}

function readPersisted(): DockPersisted | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return null
    const candidate = parsed as Partial<DockPersisted>
    if (
      typeof candidate.x === 'number'
      && typeof candidate.y === 'number'
      && typeof candidate.collapsed === 'boolean'
    ) {
      return { x: candidate.x, y: candidate.y, collapsed: candidate.collapsed }
    }
    return null
  } catch {
    return null
  }
}

function writePersisted(value: DockPersisted): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // localStorage may be unavailable in private mode; dev-only surface, ignore.
  }
}

function defaultPosition(): { x: number; y: number } {
  if (typeof window === 'undefined') return { x: 16, y: 16 }
  return {
    x: Math.max(EDGE_PADDING, window.innerWidth  - PANEL_WIDTH - EDGE_PADDING),
    y: Math.max(EDGE_PADDING, window.innerHeight - 320         - EDGE_PADDING),
  }
}

function clampToViewport(x: number, y: number, panelHeight: number): { x: number; y: number } {
  if (typeof window === 'undefined') return { x, y }
  const maxX = Math.max(EDGE_PADDING, window.innerWidth  - PANEL_WIDTH  - EDGE_PADDING)
  const maxY = Math.max(EDGE_PADDING, window.innerHeight - panelHeight - EDGE_PADDING)
  return {
    x: Math.min(Math.max(EDGE_PADDING, x), maxX),
    y: Math.min(Math.max(EDGE_PADDING, y), maxY),
  }
}

export function TodayDevToolsDock({
  heroControls,
  moduleControls,
  onHeroChange,
  onModuleChange,
  onClose,
}: TodayDevToolsDockProps): React.JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const handleRef    = useRef<HTMLButtonElement | null>(null)
  const dragOriginRef = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)

  const [position,  setPosition]  = useState<{ x: number; y: number }>(() => defaultPosition())
  const [collapsed, setCollapsed] = useState(false)
  const [hydrated,  setHydrated]  = useState(false)

  useLayoutEffect(() => {
    const persisted = readPersisted()
    if (persisted !== null) {
      const panelHeight = containerRef.current?.offsetHeight ?? 320
      setPosition(clampToViewport(persisted.x, persisted.y, panelHeight))
      setCollapsed(persisted.collapsed)
    }
    setHydrated(true)
  }, [])

  // Debounce localStorage writes so a drag (60+ position updates per second)
  // doesn't thrash the disk. The cleanup cancels any pending write when a new
  // position arrives, so only the final settled value is persisted ~250ms
  // after the last change. Collapse toggles go through the same path; they're
  // discrete events so the debounce never delays anything visible.
  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      writePersisted({ x: position.x, y: position.y, collapsed })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [position, collapsed, hydrated])

  useEffect(() => {
    function onResize(): void {
      const panelHeight = containerRef.current?.offsetHeight ?? 320
      setPosition((prev) => clampToViewport(prev.x, prev.y, panelHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const startDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragOriginRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      x:        position.x,
      y:        position.y,
    }
  }, [position])

  const onDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
    const origin = dragOriginRef.current
    if (origin === null) return
    const nextX = origin.x + (event.clientX - origin.pointerX)
    const nextY = origin.y + (event.clientY - origin.pointerY)
    const panelHeight = containerRef.current?.offsetHeight ?? 320
    setPosition(clampToViewport(nextX, nextY, panelHeight))
  }, [])

  const endDrag = useCallback((event: React.PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragOriginRef.current = null
  }, [])

  const onHandleKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>): void => {
    const panelHeight = containerRef.current?.offsetHeight ?? 320
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setPosition((p) => clampToViewport(p.x, p.y - NUDGE_STEP, panelHeight))
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      setPosition((p) => clampToViewport(p.x, p.y + NUDGE_STEP, panelHeight))
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPosition((p) => clampToViewport(p.x - NUDGE_STEP, p.y, panelHeight))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPosition((p) => clampToViewport(p.x + NUDGE_STEP, p.y, panelHeight))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setPosition(defaultPosition())
    }
  }, [])

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Today dev tools"
      style={{
        position:  'fixed',
        left:      `${position.x}px`,
        top:       `${position.y}px`,
        width:     `min(${PANEL_WIDTH}px, calc(100vw - ${EDGE_PADDING * 2}px))`,
        maxHeight: `calc(100vh - ${EDGE_PADDING * 2}px)`,
        zIndex:    40,
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
          className={[
            'flex-1 cursor-grab active:cursor-grabbing rounded-[2px] px-2 py-1',
            'text-left font-mono text-xs uppercase tracking-[0.16em] text-warm-paper-raised',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40',
            'touch-none select-none',
          ].join(' ')}
        >
          Dev tools · {collapsed ? 'collapsed' : 'open'}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand dev tools' : 'Collapse dev tools'}
          aria-expanded={!collapsed}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
        >
          {collapsed ? '▾' : '▴'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dev tools"
          className="inline-flex h-7 w-7 items-center justify-center rounded-[2px] text-warm-paper-raised/70 hover:text-warm-paper-raised hover:bg-warm-paper-raised/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-warm-paper-raised/40"
        >
          ×
        </button>
      </div>

      {!collapsed && (
        <div className="grid gap-3 overflow-y-auto p-3">
          <DashboardHeroDevToolbar variant="panel" controls={heroControls} onChange={onHeroChange} />
          <DashboardModulesDevToolbar variant="panel" controls={moduleControls} onChange={onModuleChange} />
        </div>
      )}
    </div>
  )
}
