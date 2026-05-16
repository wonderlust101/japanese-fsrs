'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export type SetupPreviewState =
  | 'normal'
  | 'modified'
  | 'catch-up'
  | 'no-reviews'
  | 'offline'
  | 'loading'
  | 'error'
  | 'first-time'

export type SetupPreviewQueueShape =
  | 'small'      // 8 review · 2 new
  | 'typical'    // 32 review · 12 new · 3 backlog
  | 'review-heavy' // 60 review · 0 new
  | 'new-heavy'  // 5 review · 25 new
  | 'overdue'    // 6 review · 4 new · 28 backlog

export interface SetupDevControls {
  state:      SetupPreviewState
  queueShape: SetupPreviewQueueShape
}

export const DEFAULT_SETUP_DEV_CONTROLS: SetupDevControls = {
  state:      'normal',
  queueShape: 'typical',
}

const STATE_OPTIONS: ReadonlyArray<{ value: SetupPreviewState; label: string }> = [
  { value: 'normal',     label: 'Normal'                    },
  { value: 'modified',   label: 'Modified (tuning changed)' },
  { value: 'catch-up',   label: 'Catch-up (backlog)'        },
  { value: 'no-reviews', label: 'No reviews available'      },
  { value: 'offline',    label: 'Offline'                   },
  { value: 'loading',    label: 'Loading'                   },
  { value: 'error',      label: 'Error'                     },
  { value: 'first-time', label: 'First time (no decks)'     },
]

const QUEUE_OPTIONS: ReadonlyArray<{ value: SetupPreviewQueueShape; label: string }> = [
  { value: 'small',        label: 'Small (10)'         },
  { value: 'typical',      label: 'Typical (47)'       },
  { value: 'review-heavy', label: 'Review-heavy (60)'  },
  { value: 'new-heavy',    label: 'New-heavy (30)'     },
  { value: 'overdue',      label: 'Overdue (38)'       },
]

const STORAGE_KEY = 'tomo.setup-dev-toolbar.position'

interface Position { x: number; y: number }

function loadPosition(): Position | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null
    return { x: parsed.x, y: parsed.y }
  } catch { return null }
}

function savePosition(p: Position): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) } catch { /* ignore */ }
}

interface SetupDevToolbarProps {
  controls:        SetupDevControls
  onChange:        (next: SetupDevControls) => void
  onClose:         () => void
}

export function SetupDevToolbar({
  controls,
  onChange,
  onClose,
}: SetupDevToolbarProps): React.JSX.Element {
  const [position, setPosition] = useState<Position>(() => loadPosition() ?? { x: 16, y: 16 })
  const [dragging, setDragging] = useState<boolean>(false)
  const dragOffset = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if ((event.target as HTMLElement).closest('[data-drag-ignore]') !== null) return
    event.preventDefault()
    setDragging(true)
    dragOffset.current = {
      dx: event.clientX - position.x,
      dy: event.clientY - position.y,
    }
    ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  }, [position.x, position.y])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    event.preventDefault()
    const nx = event.clientX - dragOffset.current.dx
    const ny = event.clientY - dragOffset.current.dy
    const maxX = window.innerWidth  - 320
    const maxY = window.innerHeight - 80
    const clampedX = Math.min(Math.max(0, nx), Math.max(0, maxX))
    const clampedY = Math.min(Math.max(0, ny), Math.max(0, maxY))
    setPosition({ x: clampedX, y: clampedY })
  }, [dragging])

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (!dragging) return
    setDragging(false)
    ;(event.currentTarget as Element).releasePointerCapture?.(event.pointerId)
    savePosition(position)
  }, [dragging, position])

  useEffect(() => {
    // Save on unmount and on resize-clamp.
    return () => savePosition(position)
  }, [position])

  function update<K extends keyof SetupDevControls>(key: K, value: SetupDevControls[K]): void {
    onChange({ ...controls, [key]: value })
  }

  return (
    <aside
      aria-label="Review setup preview controls"
      className={cn(
        'fixed z-50 w-[min(28rem,calc(100vw-2rem))]',
        'rounded-[2px] border border-sumi-ink/15 bg-sumi-ink text-warm-paper-raised',
        'shadow-lg select-none',
        dragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
      style={{ top: position.y, left: position.x }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Drag handle / header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-warm-paper-raised/10">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-block h-3 w-3 rounded-full bg-warm-paper-raised/30"
          />
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em]">
            Review setup · dev preview
          </p>
        </div>
        <button
          type="button"
          data-drag-ignore=""
          onClick={onClose}
          className={cn(
            'inline-flex h-7 items-center rounded-[2px] border border-warm-paper-raised/20',
            'px-2 font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/85',
            'transition-colors duration-200 ease-out',
            'hover:bg-warm-paper-raised/10 hover:text-warm-paper-raised',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-warm-paper-raised focus-visible:outline-offset-2',
          )}
          aria-label="Close preview controls"
        >
          Close
        </button>
      </div>

      <div data-drag-ignore="" className="grid gap-3 px-4 py-3 sm:grid-cols-2 cursor-default">
        <ToolbarSelect
          label="State"
          value={controls.state}
          options={STATE_OPTIONS}
          onChange={(v) => update('state', v)}
        />
        <ToolbarSelect
          label="Queue shape"
          value={controls.queueShape}
          options={QUEUE_OPTIONS}
          onChange={(v) => update('queueShape', v)}
          disabled={
            controls.state === 'loading' ||
            controls.state === 'error' ||
            controls.state === 'no-reviews' ||
            controls.state === 'first-time'
          }
          hint={
            controls.state === 'normal' || controls.state === 'modified' || controls.state === 'catch-up' || controls.state === 'offline'
              ? undefined
              : 'no queue in this state'
          }
        />
      </div>

      <p
        data-drag-ignore=""
        className="px-4 pb-3 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-warm-paper-raised/50"
      >
        Drag header to move
      </p>
    </aside>
  )
}

function ToolbarSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label:     string
  value:     T
  options:   ReadonlyArray<{ value: T; label: string }>
  onChange:  (value: T) => void
  disabled?: boolean | undefined
  hint?:     string | undefined
}): React.JSX.Element {
  return (
    <label className="block" data-drag-ignore="">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-warm-paper-raised/55">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        disabled={disabled === true}
        className={cn(
          'mt-1 h-9 w-full rounded-[2px] border border-warm-paper-raised/15',
          'bg-warm-paper-raised/10 px-2 text-sm text-warm-paper-raised',
          'transition-colors duration-200 ease-out outline-none',
          'hover:border-warm-paper-raised/35',
          'focus-visible:border-warm-paper-raised focus-visible:ring-2 focus-visible:ring-warm-paper-raised/20',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            className="bg-sumi-ink text-warm-paper-raised"
          >
            {option.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <span className="mt-1 block font-mono text-[0.625rem] uppercase tracking-[0.1em] text-warm-paper-raised/45">
          {hint}
        </span>
      )}
    </label>
  )
}
