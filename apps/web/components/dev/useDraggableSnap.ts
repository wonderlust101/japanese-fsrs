'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type Corner = 'tl' | 'tr' | 'bl' | 'br'

const CORNERS: ReadonlyArray<Corner> = ['tl', 'tr', 'bl', 'br']

interface UseDraggableSnapOptions {
  storageKey:     string
  defaultCorner?: Corner
  dragThreshold?: number
}

interface UseDraggableSnapResult {
  corner:              Corner
  isDragging:          boolean
  livePosition:        { x: number; y: number } | null
  onPointerDown:       (event: React.PointerEvent<HTMLElement>) => void
  consumeDragSuppress: () => boolean
  resetCorner:         () => void
}

interface DragState {
  startX:    number
  startY:    number
  pointerId: number
}

function readStoredCorner(key: string, fallback: Corner): Corner {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (raw !== null && CORNERS.includes(raw as Corner)) return raw as Corner
  } catch {
    // localStorage may throw in private mode / quota exceeded — fall through
  }
  return fallback
}

function writeStoredCorner(key: string, corner: Corner): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, corner)
  } catch {
    // ignore — same reasons as above
  }
}

function clearStoredCorner(key: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function nearestCorner(x: number, y: number, viewportW: number, viewportH: number): Corner {
  const top  = y < viewportH / 2
  const left = x < viewportW / 2
  return `${top ? 't' : 'b'}${left ? 'l' : 'r'}` as Corner
}

export function useDraggableSnap({
  storageKey,
  defaultCorner = 'br',
  dragThreshold = 4,
}: UseDraggableSnapOptions): UseDraggableSnapResult {
  const [corner, setCorner]             = useState<Corner>(defaultCorner)
  const [livePosition, setLivePosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging]     = useState(false)

  const dragStateRef = useRef<DragState | null>(null)
  const wasDragRef   = useRef(false)

  // Hydrate corner from localStorage after mount. Avoiding this in useState's
  // initializer keeps the SSR markup deterministic — the server has no localStorage.
  useEffect(() => {
    setCorner(readStoredCorner(storageKey, defaultCorner))
  }, [storageKey, defaultCorner])

  const handlePointerMove = useCallback((event: PointerEvent): void => {
    const drag = dragStateRef.current
    if (drag === null || event.pointerId !== drag.pointerId) return

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    if (Math.hypot(dx, dy) > dragThreshold) {
      wasDragRef.current = true
      setIsDragging(true)
    }
    setLivePosition({ x: event.clientX, y: event.clientY })
  }, [dragThreshold])

  const handlePointerUp = useCallback((event: PointerEvent): void => {
    const drag = dragStateRef.current
    if (drag === null || event.pointerId !== drag.pointerId) return

    if (wasDragRef.current) {
      const next = nearestCorner(
        event.clientX,
        event.clientY,
        window.innerWidth,
        window.innerHeight,
      )
      setCorner(next)
      writeStoredCorner(storageKey, next)
    }

    dragStateRef.current = null
    setLivePosition(null)
    setIsDragging(false)

    document.removeEventListener('pointermove',   handlePointerMove)
    document.removeEventListener('pointerup',     handlePointerUp)
    document.removeEventListener('pointercancel', handlePointerUp)
  }, [handlePointerMove, storageKey])

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLElement>): void => {
    // Mouse: primary button only. Touch/pen: any button is fine.
    if (event.pointerType === 'mouse' && event.button !== 0) return

    dragStateRef.current = {
      startX:    event.clientX,
      startY:    event.clientY,
      pointerId: event.pointerId,
    }
    wasDragRef.current = false

    document.addEventListener('pointermove',   handlePointerMove)
    document.addEventListener('pointerup',     handlePointerUp)
    document.addEventListener('pointercancel', handlePointerUp)
  }, [handlePointerMove, handlePointerUp])

  // The click event always fires after pointerup; the launcher uses this flag
  // to suppress the click when the gesture was actually a drag.
  const consumeDragSuppress = useCallback((): boolean => {
    const was = wasDragRef.current
    wasDragRef.current = false
    return was
  }, [])

  const resetCorner = useCallback((): void => {
    clearStoredCorner(storageKey)
    setCorner(defaultCorner)
  }, [storageKey, defaultCorner])

  // Defensive: detach any in-flight document listeners on unmount.
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove',   handlePointerMove)
      document.removeEventListener('pointerup',     handlePointerUp)
      document.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  return { corner, isDragging, livePosition, onPointerDown, consumeDragSuppress, resetCorner }
}
