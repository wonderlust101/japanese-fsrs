'use client'

import { useEffect, useRef, useState } from 'react'

import type { FuriganaMode } from '@/stores/useSessionPreferencesStore'
import { cn } from '@/lib/utils'

interface OverflowMenuProps {
  deckName:        string | null
  audioMuted:      boolean
  onToggleAudio:   () => void
  furiganaMode:    FuriganaMode
  onCycleFurigana: () => void
  trigger:         React.ReactNode
}

// Card-scoped overflow menu. Single source of truth for learner prefs (Mute
// audio, Sentence furigana) and session end. The top bar carries identity,
// state, and pause only; everything else lives here at every breakpoint.

export function OverflowMenu({
  deckName,
  audioMuted,
  onToggleAudio,
  furiganaMode,
  onCycleFurigana,
  trigger,
}: OverflowMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown',  onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown',  onKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Card menu"
        className="block cursor-pointer"
      >
        {trigger}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full mt-2 z-40 w-64',
            'rounded-md border border-soft-hairline bg-warm-paper-raised shadow-card',
            'py-2',
          )}
        >
          {deckName !== null && (
            <div className="px-3 pb-2 pt-1 border-b border-soft-hairline/60">
              <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">Deck</p>
              <p className="text-sm text-sumi-ink truncate">{deckName}</p>
            </div>
          )}

          <p className="px-3 pt-2 pb-1 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi/85">
            Preferences
          </p>
          <MenuRow
            label="Mute audio"
            value={audioMuted ? 'Muted' : 'On'}
            onClick={onToggleAudio}
          />
          <MenuRow
            label="Sentence furigana"
            value={furiganaMode === 'hover' ? 'Hover' : furiganaMode === 'always' ? 'Always' : 'Off'}
            onClick={onCycleFurigana}
          />
          <div className="my-1 h-px bg-soft-hairline/60" />

          <p className="px-3 pt-2 pb-1 font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi/85">
            This card
          </p>
          <MenuItem label="Edit card"            disabled />
          <MenuItem label="Suspend card"         disabled />
          <MenuItem label="Report an issue"      disabled />
          <MenuItem label="View scheduling info" disabled />
        </div>
      )}
    </div>
  )
}

function MenuRow({
  label,
  value,
  onClick,
}: { label: string; value: string; onClick: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-baseline justify-between px-3 py-1.5 text-sm text-sumi-ink hover:bg-cream-inset/60 cursor-pointer transition-colors duration-100"
    >
      <span>{label}</span>
      <span className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi">{value}</span>
    </button>
  )
}

function MenuItem({
  label,
  onClick,
  disabled = false,
}: { label: string; onClick?: () => void; disabled?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full text-left px-3 py-1.5 text-sm transition-colors duration-100',
        disabled ? 'text-faded-sumi/55 cursor-not-allowed' : 'text-sumi-ink hover:bg-cream-inset/60 cursor-pointer',
      )}
    >
      {label}
    </button>
  )
}
