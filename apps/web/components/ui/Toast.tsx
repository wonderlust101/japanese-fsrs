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
      {message}
    </PeekPanel>
  )
}

export interface ToastState {
  message: string
  kind:    ToastKind
  key:     number
}

export function useToast(): {
  toast:        ToastState | null
  showToast:    (message: string, kind?: ToastKind) => void
  dismissToast: () => void
} {
  const [toast, setToast] = useState<ToastState | null>(null)

  return {
    toast,
    showToast:    (message, kind = 'info') => setToast({ message, kind, key: Date.now() }),
    dismissToast: () => setToast(null),
  }
}
