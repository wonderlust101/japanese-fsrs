'use client'

import { useEffect, useRef } from 'react'

import { cn } from '@/lib/utils'

interface SessionTeachSheetProps {
  open: boolean
  /** Auto-show on first session dismisses on any keypress or click (the
   *  learner exercising the model is the dismissal). Manual opens dismiss
   *  on Esc, click-outside, or the close button only. */
  mode: 'auto' | 'manual'
  onClose: () => void
}

interface Shortcut {
  keys:  string[]
  label: string
}

const SHORTCUTS: readonly Shortcut[] = [
  { keys: ['Space'],           label: 'Reveal the answer' },
  { keys: ['1', '2', '3', '4'], label: 'Rate the card (Again / Hard / Good / Easy)' },
  { keys: ['M'],               label: 'Toggle the mnemonic tab' },
  { keys: ['K'],               label: 'Toggle the kanji-breakdown tab' },
] as const

export function SessionTeachSheet({
  open,
  mode,
  onClose,
}: SessionTeachSheetProps): React.JSX.Element | null {
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return

    function handleKey(e: KeyboardEvent): void {
      if (mode === 'auto') {
        // Any non-modifier keypress dismisses the ghost teach. The user is
        // engaging with the model; the lesson is already happening.
        if (e.metaKey || e.ctrlKey || e.altKey) return
        onClose()
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    function handleAutoClick(): void {
      if (mode === 'auto') onClose()
    }

    document.addEventListener('keydown', handleKey)
    if (mode === 'auto') {
      // Pointerdown fires before the click reaches any target; pairs with
      // the keydown handler to make the ghost truly fade-on-engagement.
      document.addEventListener('pointerdown', handleAutoClick)
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('pointerdown', handleAutoClick)
    }
  }, [open, mode, onClose])

  useEffect(() => {
    if (!open || mode !== 'manual') return
    closeRef.current?.focus()
  }, [open, mode])

  if (!open) return null

  return (
    <div
      role={mode === 'manual' ? 'dialog' : 'presentation'}
      aria-modal={mode === 'manual' ? 'true' : undefined}
      aria-labelledby={mode === 'manual' ? 'teach-sheet-title' : undefined}
      className="fixed inset-0 z-[55] flex items-center justify-center px-5"
    >
      {/* Backdrop: paper-tone, no blur (brand: paper laid on paper).
          Click-outside dismisses in manual mode; in auto mode the document
          listener handles the dismissal. */}
      <button
        type="button"
        aria-label="Close keyboard shortcuts"
        onClick={mode === 'manual' ? onClose : undefined}
        tabIndex={mode === 'manual' ? 0 : -1}
        className={cn(
          'absolute inset-0',
          mode === 'auto' ? 'bg-warm-paper-base/55' : 'bg-warm-paper-base/80',
          'cursor-default',
        )}
      />

      <div
        className={cn(
          'relative w-full max-w-[26rem] rounded-md',
          'border border-soft-hairline bg-warm-paper-raised',
          'px-7 py-6 shadow-card',
          mode === 'auto' && 'pointer-events-none',
        )}
      >
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-faded-sumi">
          {mode === 'auto' ? 'A few keys, then we step out of the way' : 'Keyboard shortcuts'}
        </p>
        <h2 id="teach-sheet-title" className="mt-1.5 font-serif text-xl text-sumi-ink">
          {mode === 'auto' ? 'Welcome.' : 'Quick reference'}
        </h2>

        <ul className="mt-5 flex flex-col gap-3">
          {SHORTCUTS.map((s) => (
            <li key={s.label} className="flex items-baseline gap-3">
              <span className="flex flex-shrink-0 items-center gap-1">
                {s.keys.map((k, i) => (
                  <span key={`${s.label}-${k}-${i}`} className="flex items-center gap-1">
                    <kbd
                      className={cn(
                        'inline-flex min-w-[24px] h-[22px] items-center justify-center px-1.5',
                        'rounded-[5px] bg-warm-paper-base/70 text-sumi-ink',
                        'font-mono text-[0.6875rem] font-medium leading-none',
                        'border border-soft-hairline',
                        'shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_0_rgba(31,26,24,0.08)]',
                      )}
                    >
                      {k}
                    </kbd>
                    {i < s.keys.length - 1 && (
                      <span aria-hidden="true" className="text-faded-sumi/60 text-xs">·</span>
                    )}
                  </span>
                ))}
              </span>
              <span className="text-sm text-sumi-ink/85 leading-snug">{s.label}</span>
            </li>
          ))}
        </ul>

        {mode === 'auto' ? (
          <p className="mt-6 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi/85">
            Press anything to begin.
          </p>
        ) : (
          <div className="mt-6 flex justify-end pointer-events-auto">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className={cn(
                'inline-flex h-9 items-center justify-center rounded-md px-3.5 cursor-pointer',
                'border border-soft-hairline bg-warm-paper-raised text-sm text-sumi-ink',
                'hover:border-sumi-ink/35 hover:bg-cream-inset/60 transition-colors duration-150',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
              )}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
