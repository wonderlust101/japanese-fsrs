'use client'

import { useEffect, useState } from 'react'

import { PeekPanel } from './PeekPanel'
import { cn } from '@/lib/utils'

export type ToastKind = 'info' | 'error'

interface ToastProps {
  message:     string
  kind?:       ToastKind
  onDismiss:   () => void
  /** Auto-dismiss delay in ms. Default 3200 for 'info', 0 (persist) for 'error'. */
  durationMs?: number
  /** Position offset — 'above-bar' clears a sticky action bar. */
  offset?:     'edge' | 'above-bar'
  /** Max-width override (e.g. 'max-w-[32rem]'). Default 'max-w-[28rem]'. */
  maxWidth?:   string
  /** Optional trailing action (e.g. "Undo" after a reversible mutation).
   *  When present, renders as a quiet inline button right of the message.
   *  Click dismisses the toast and invokes the handler. */
  action?:     { label: string; onClick: () => void }
}

const TONE_CLASS: Record<ToastKind, string> = {
  info:  '',
  error: 'border-inari-vermillion/40 text-inari-vermillion-deep',
}

export function Toast({
  message,
  kind         = 'info',
  onDismiss,
  durationMs,
  offset       = 'edge',
  maxWidth,
  action,
}: ToastProps): React.JSX.Element {
  const effectiveDuration = durationMs ?? (kind === 'info' ? 3200 : 0)

  useEffect(() => {
    if (effectiveDuration <= 0) return
    const id = window.setTimeout(onDismiss, effectiveDuration)
    return () => window.clearTimeout(id)
  }, [effectiveDuration, onDismiss])

  return (
    <PeekPanel
      onDismiss={onDismiss}
      offset={offset}
      {...(maxWidth !== undefined ? { maxWidth } : {})}
      className={cn(TONE_CLASS[kind])}
    >
      <span className="flex items-center gap-2">
        <span className="flex-1">{message}</span>
        {action !== undefined && (
          <button
            type="button"
            onClick={() => { action.onClick(); onDismiss() }}
            className="shrink-0 rounded-[2px] px-2 py-1 font-mono text-sm font-semibold uppercase tracking-[0.06em] text-inari-vermillion underline-offset-2 hover:bg-cream-inset/70 hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            {action.label}
          </button>
        )}
      </span>
    </PeekPanel>
  )
}

export interface ToastState {
  message: string
  kind:    ToastKind
  key:     number
  /** Optional trailing action propagated through to the rendered Toast. */
  action?: { label: string; onClick: () => void }
}

export function useToast(): {
  toast:        ToastState | null
  showToast:    (
    message: string,
    kind?:   ToastKind,
    action?: { label: string; onClick: () => void },
  ) => void
  dismissToast: () => void
} {
  const [toast, setToast] = useState<ToastState | null>(null)

  return {
    toast,
    showToast: (message, kind = 'info', action) => setToast({
      message,
      kind,
      key: Date.now(),
      ...(action !== undefined && { action }),
    }),
    dismissToast: () => setToast(null),
  }
}
