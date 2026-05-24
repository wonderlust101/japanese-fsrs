'use client'

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type {
  CardMissingField,
  CardPresentField,
  CardStatusFilter,
  PitchPattern,
} from '@fsrs-japanese/shared-types'

import { CommandList, type CommandItem } from '@/components/ui/CommandList'

import {
  chipsFromState,
  clearChip,
  hasAnyChip,
  type CardsFilterState,
  type ChipDimension,
  type FilterChip,
  type JlptFilter,
} from './cards-filter-state'

type ChipsVariant = 'desktop' | 'mobile'

interface Props {
  state:      CardsFilterState
  onChange:   (next: CardsFilterState) => void
  onClearAll: () => void
  /**
   * `desktop` (default): chips are interactive, body opens an inline
   * editor, ✕ removes. Wraps to multiple lines.
   *
   * `mobile`: chips render in a horizontal-scroll rail; body taps do
   * nothing (no inline editor — editing routes through the bottom
   * filter sheet). ✕ remains tap-to-remove at touch-comfortable size.
   * Established in the audit fix brief: editing on touch is harder
   * than tapping a single 'remove' affordance, and we want a single
   * gesture model on small screens.
   */
  variant?:   ChipsVariant
}

export function CardsActiveChips({
  state, onChange, onClearAll, variant = 'desktop',
}: Props): React.JSX.Element | null {
  const chips = chipsFromState(state)
  if (chips.length === 0) return null

  if (variant === 'mobile') {
    return (
      <section
        aria-label="Active filters"
        // Horizontal rail with overflow scroll so any number of chips
        // fits without consuming vertical space. `-mx-4 px-4` lets
        // chips scroll edge-to-edge while keeping their initial offset
        // aligned with the page gutter. The mask-image fade on the
        // right edge signals that more chips exist off-screen when the
        // rail overflows; without it, users couldn't tell at a glance
        // whether to scroll.
        className="-mx-4 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,black_0%,black_calc(100%-2.5rem),transparent_100%)]"
      >
        <div className="flex min-w-max items-center gap-2 py-1">
          {chips.map((chip) => (
            <MobileChipPill
              key={`${chip.dim}:${chip.value}`}
              chip={chip}
              onRemove={() => onChange(clearChip(state, chip.dim))}
            />
          ))}
          {hasAnyChip(state) && (
            <button
              type="button"
              onClick={onClearAll}
              className="inline-flex h-11 shrink-0 items-center px-2 font-mono text-xs text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </section>
    )
  }

  return (
    <section
      aria-label="Active filters"
      className="flex flex-wrap items-center gap-x-2 gap-y-2"
    >
      {chips.map((chip) => (
        <DesktopChipPill
          key={`${chip.dim}:${chip.value}`}
          chip={chip}
          state={state}
          onChange={onChange}
          onRemove={() => onChange(clearChip(state, chip.dim))}
        />
      ))}
      {hasAnyChip(state) && (
        <button
          type="button"
          onClick={onClearAll}
          className="ml-1 inline-flex items-center px-1.5 py-1 font-mono text-sm text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
        >
          Clear all
        </button>
      )}
    </section>
  )
}

// ─── Desktop chip pill (interactive body + ✕) ───────────────────────────

function DesktopChipPill({
  chip, state, onChange, onRemove,
}: {
  chip:     FilterChip
  state:    CardsFilterState
  onChange: (next: CardsFilterState) => void
  onRemove: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLButtonElement | null>(null)

  return (
    <div className="relative inline-flex items-stretch">
      <button
        ref={bodyRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={[
          'ui-motion-colors inline-flex h-7 items-center gap-2 rounded-l-[2px] border border-r-0 pl-2 pr-1.5',
          'font-mono text-sm tabular-nums',
          'border-soft-hairline bg-cream-inset text-sumi-ink',
          'hover:border-faded-sumi hover:bg-warm-paper-raised',
          'active:bg-warm-paper-raised',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ].join(' ')}
      >
        <span className="text-faded-sumi">{chipPrefix(chip.dim)}</span>
        <span>{chipDisplay(chip)}</span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.label} filter`}
        className={[
          'ui-motion-colors inline-flex h-7 w-6 items-center justify-center rounded-r-[2px] border',
          'border-soft-hairline bg-cream-inset text-faded-sumi',
          'hover:border-faded-sumi hover:bg-warm-paper-raised hover:text-sumi-ink',
          'active:bg-warm-paper-raised',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ].join(' ')}
      >
        <CloseGlyph />
      </button>

      {open && (
        <ChipEditorPopover
          chip={chip}
          state={state}
          anchorRef={bodyRef}
          onPick={(next) => {
            onChange(next)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

// ─── Mobile chip pill (display + ✕ only, touch-comfortable) ─────────────

function MobileChipPill({
  chip, onRemove,
}: {
  chip:     FilterChip
  onRemove: () => void
}): React.JSX.Element {
  return (
    <div className="inline-flex shrink-0 items-stretch">
      {/* Body is a <span> (not a button) so taps on it do nothing.
          Visual treatment matches desktop chip body but with a larger
          height for touch comfort. */}
      <span
        className={[
          'inline-flex h-11 items-center gap-2 rounded-l-[2px] border border-r-0 pl-3 pr-2',
          'font-mono text-xs tabular-nums',
          'border-soft-hairline bg-cream-inset text-sumi-ink',
        ].join(' ')}
      >
        <span className="text-faded-sumi">{chipPrefix(chip.dim)}</span>
        <span>{chipDisplay(chip)}</span>
      </span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${chip.label} filter`}
        className={[
          'ui-motion-colors inline-flex h-11 w-11 items-center justify-center rounded-r-[2px] border',
          'border-soft-hairline bg-cream-inset text-faded-sumi',
          'hover:border-faded-sumi hover:bg-warm-paper-raised hover:text-sumi-ink',
          'active:bg-warm-paper-raised',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        ].join(' ')}
      >
        <CloseGlyph />
      </button>
    </div>
  )
}

// ─── Chip label helpers ─────────────────────────────────────────────────

function chipPrefix(dim: ChipDimension): string {
  switch (dim) {
    case 'jlpt':         return 'Level'
    case 'status':       return 'Status'
    case 'missing':      return 'Missing'
    case 'present':      return 'Has'
    case 'pitchPattern': return 'Pattern'
  }
}

function chipDisplay(chip: FilterChip): string {
  return chip.label
    .replace(/^JLPT\s*/i, '')
    .replace(/^Missing\s*/i, '')
    .replace(/^Has\s*/i, '')
    .replace(/^Pattern:\s*/i, '')
}

// ─── Chip editor popover (uses CommandList for keyboard nav) ────────────

interface EditorProps {
  chip:      FilterChip
  state:     CardsFilterState
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onPick:    (next: CardsFilterState) => void
  onClose:   () => void
}

function ChipEditorPopover({
  chip, state, anchorRef, onPick, onClose,
}: EditorProps): React.JSX.Element | null {
  const headingId = useId()
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useLayoutEffect(() => {
    const update = (): void => {
      const trigger = anchorRef.current
      if (trigger === null) return
      const rect = trigger.getBoundingClientRect()
      setPosition({ top: rect.bottom + 6, left: rect.left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRef])

  useEffect(() => {
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) === true) return
      if (anchorRef.current?.contains(target) === true) return
      onClose()
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [anchorRef, onClose])

  // Pull DOM focus into the listbox itself when the popover opens so
  // arrow keys are received without the user having to click first.
  useEffect(() => {
    if (!mounted || position === null) return
    const t = window.setTimeout(() => {
      const list = popoverRef.current?.querySelector<HTMLUListElement>('[role="listbox"]')
      list?.focus()
    }, 0)
    return () => window.clearTimeout(t)
  }, [mounted, position])

  if (!mounted || position === null) return null

  const items = optionsFor(chip.dim).map((opt) => ({
    value: opt.value,
    label: opt.label,
    badge: isOptionCurrent(chip.dim, state, opt.value) ? '●' : undefined,
  } as CommandItem<string>))

  // Pre-highlight the currently-applied value so the editor opens with
  // the cursor on the user's existing choice, not on the first row.
  const currentIndex = items.findIndex((it) => it.badge === '●')
  const initialIndex = currentIndex >= 0 ? currentIndex : 0

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      style={{ top: position.top, left: position.left, position: 'fixed' }}
      className="z-[var(--z-popover)] min-w-[14rem] rounded-xs border border-soft-hairline bg-warm-paper-raised shadow-card animate-page-enter"
    >
      <div className="px-3 pt-3 pb-2 border-b border-soft-hairline">
        <h2 id={headingId} className="font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
          Edit {chipPrefix(chip.dim)}
        </h2>
      </div>
      <CommandList<string>
        items={items}
        initialIndex={initialIndex}
        ariaLabel={`Choose ${chipPrefix(chip.dim)}`}
        onSelect={(value) => onPick(applyOption(state, chip.dim, value))}
        onEscape={onClose}
      />
    </div>,
    document.body,
  )
}

// ─── Per-dimension options + value application ──────────────────────────

interface Option { value: string; label: string }

function optionsFor(dim: ChipDimension): ReadonlyArray<Option> {
  switch (dim) {
    case 'jlpt': return [
      { value: 'all',    label: 'All levels' },
      { value: 'N5',     label: 'N5' },
      { value: 'N4',     label: 'N4' },
      { value: 'N3',     label: 'N3' },
      { value: 'N2',     label: 'N2' },
      { value: 'N1',     label: 'N1' },
      { value: 'beyond', label: 'Beyond JLPT' },
    ]
    case 'status': return [
      { value: 'all',       label: 'All' },
      { value: 'new',       label: 'New' },
      { value: 'learning',  label: 'Learning' },
      { value: 'review',    label: 'Review' },
      { value: 'suspended', label: 'Suspended' },
    ]
    case 'missing': return [
      { value: 'reading',  label: 'Missing reading' },
      { value: 'meaning',  label: 'Missing meaning' },
      { value: 'example',  label: 'Missing example' },
      { value: 'mnemonic', label: 'Missing mnemonic' },
      { value: 'picture',  label: 'Missing picture' },
      { value: 'nuance',   label: 'Missing nuance' },
      { value: 'pitch',    label: 'Missing pitch' },
    ]
    case 'present': return [
      { value: 'picture', label: 'Has picture' },
      { value: 'pitch',   label: 'Has pitch' },
    ]
    case 'pitchPattern': return [
      { value: 'heiban',    label: 'Heiban (平板)' },
      { value: 'atamadaka', label: 'Atamadaka (頭高)' },
      { value: 'nakadaka',  label: 'Nakadaka (中高)' },
      { value: 'odaka',     label: 'Odaka (尾高)' },
    ]
  }
}

function isOptionCurrent(dim: ChipDimension, state: CardsFilterState, value: string): boolean {
  switch (dim) {
    case 'jlpt':         return state.jlpt === value
    case 'status':       return state.status === value
    case 'missing':      return state.missingField === value
    case 'present':      return state.presentField === value
    case 'pitchPattern': return state.pitchPattern === value
  }
}

function applyOption(state: CardsFilterState, dim: ChipDimension, value: string): CardsFilterState {
  switch (dim) {
    case 'jlpt':
      return { ...state, jlpt: value as JlptFilter }
    case 'status':
      return { ...state, status: value as CardStatusFilter }
    case 'missing':
      return { ...state, missingField: value as CardMissingField }
    case 'present': {
      const nextPresent = value as CardPresentField
      const next: CardsFilterState = { ...state, presentField: nextPresent }
      if (nextPresent !== 'pitch') next.pitchPattern = null
      return next
    }
    case 'pitchPattern':
      return { ...state, presentField: 'pitch', pitchPattern: value as PitchPattern }
  }
}

// ─── Inline glyphs ──────────────────────────────────────────────────────

function CloseGlyph(): React.JSX.Element {
  return (
    <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M2 2l6 6M8 2l-6 6" />
    </svg>
  )
}
