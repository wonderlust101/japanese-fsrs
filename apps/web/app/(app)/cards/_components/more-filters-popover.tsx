'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import type { PitchPattern } from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { Pill, PillGroup } from '@/components/ui/Pill'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'

/**
 * Tri-state presence selection. 'any' = no filter, 'has' = positive
 * presence (maps to backend p_present_field), 'missing' = negative
 * presence (maps to backend p_missing_field with the matching token).
 *
 * Kept as a UI-local enum rather than reusing CardPresentField directly
 * because CardPresentField has no 'any' / 'missing' tokens — the backend
 * splits the two directions across two params.
 */
export type PresenceState = 'any' | 'has' | 'missing'

export interface MoreFiltersValue {
  pitch:        PresenceState
  pitchPattern: PitchPattern | null
  image:        PresenceState
  audio:        PresenceState
}

export const DEFAULT_MORE_FILTERS: MoreFiltersValue = {
  pitch:        'any',
  pitchPattern: null,
  image:        'any',
  audio:        'any',
}

/** Count of non-default dimensions — drives the badge on the trigger chip. */
export function countMoreFilters(v: MoreFiltersValue): number {
  let n = 0
  if (v.pitch !== 'any')           n += 1
  if (v.image !== 'any')           n += 1
  if (v.audio !== 'any')           n += 1
  if (v.pitchPattern !== null)     n += 1
  return n
}

interface MoreFiltersPopoverProps {
  open:        boolean
  anchorRef:   React.RefObject<HTMLElement | null>
  value:       MoreFiltersValue
  onApply:     (next: MoreFiltersValue) => void
  onClose:     () => void
}

const PRESENCE_OPTIONS: ReadonlyArray<{ value: PresenceState; label: string }> = [
  { value: 'any',     label: 'Any' },
  { value: 'has',     label: 'Has' },
  { value: 'missing', label: 'Missing' },
]

const PATTERN_OPTIONS: ReadonlyArray<TomoSelectOption<'any' | PitchPattern>> = [
  { value: 'any',       label: 'Any pattern' },
  { value: 'heiban',    label: 'Heiban (平板)' },
  { value: 'atamadaka', label: 'Atamadaka (頭高)' },
  { value: 'nakadaka',  label: 'Nakadaka (中高)' },
  { value: 'odaka',     label: 'Odaka (尾高)' },
]

/**
 * Floating "More filters" popover for the cards browser. Surfaces three
 * presence dimensions (pitch / image / audio) plus an optional pitch-
 * pattern select. Staged state — Apply commits, Reset clears in-popover
 * only, Escape closes without commit.
 *
 * Anatomy mirrors TomoSelect's portal + positioned popover so it's never
 * clipped by ancestor overflow. Animation is opacity + 2px translateY,
 * gated on prefers-reduced-motion. Focus is moved into the popover on
 * open and restored to the trigger on close.
 */
export function MoreFiltersPopover({
  open, anchorRef, value, onApply, onClose,
}: MoreFiltersPopoverProps): React.JSX.Element | null {
  const headingId = useId()
  const popoverRef = useRef<HTMLDivElement | null>(null)

  const [mounted, setMounted] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  // Staged state — initialised from `value` whenever the popover opens.
  // This is the source of truth while open; we only call `onApply` on
  // explicit commit so the live query doesn't refetch per-keystroke.
  const [staged, setStaged] = useState<MoreFiltersValue>(value)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) setStaged(value)
  }, [open, value])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (): void => setReducedMotion(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Position relative to the trigger; recompute on resize/scroll while open.
  useLayoutEffect(() => {
    if (!open) return undefined
    const update = (): void => {
      const trigger = anchorRef.current
      if (trigger === null) return
      const rect = trigger.getBoundingClientRect()
      setPosition({ top: rect.bottom + 8, left: rect.left })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open, anchorRef])

  // Move focus into the popover on open; restore to trigger on close.
  useEffect(() => {
    if (!open) return undefined
    const previouslyFocused = document.activeElement as HTMLElement | null
    const t = window.setTimeout(() => {
      const firstButton = popoverRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      firstButton?.focus()
    }, 0)
    return () => {
      window.clearTimeout(t)
      // Restore to the trigger by default; if focus has moved elsewhere
      // (user clicked another element), respect that.
      if (document.activeElement === document.body) {
        previouslyFocused?.focus()
      }
    }
  }, [open])

  // Outside-click and Escape close.
  useEffect(() => {
    if (!open) return undefined
    const onPointer = (e: PointerEvent): void => {
      const target = e.target as Node
      if (popoverRef.current?.contains(target) === true) return
      if (anchorRef.current?.contains(target) === true) return
      onClose()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef, onClose])

  const patternDisabled = staged.pitch !== 'has'

  const handlePresence = useCallback(
    (dim: 'pitch' | 'image' | 'audio', next: PresenceState) => {
      setStaged((prev) => {
        // Switching pitch away from 'has' must clear any committed pattern
        // so the resulting query never contains pitchPattern without
        // presentField=pitch — same invariant the API enforces.
        if (dim === 'pitch' && next !== 'has') {
          return { ...prev, pitch: next, pitchPattern: null }
        }
        return { ...prev, [dim]: next }
      })
    },
    [],
  )

  const handlePattern = useCallback((next: 'any' | PitchPattern) => {
    setStaged((prev) => ({ ...prev, pitchPattern: next === 'any' ? null : next }))
  }, [])

  const handleApply = useCallback(() => { onApply(staged) }, [onApply, staged])
  const handleReset = useCallback(() => { setStaged(DEFAULT_MORE_FILTERS) }, [])

  if (!open || !mounted || position === null) return null

  const transitionClass = reducedMotion
    ? ''
    : 'transition-[opacity,transform] duration-100 ease-out'

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={headingId}
      style={{ top: position.top, left: position.left, position: 'fixed' }}
      className={[
        'z-50 w-[22rem] rounded-[2px]',
        'border border-soft-hairline bg-warm-paper-raised',
        'shadow-[var(--shadow-card)]',
        'animate-page-enter',
        transitionClass,
      ].filter(Boolean).join(' ')}
    >
      <div className="px-4 pt-4 pb-3 border-b border-soft-hairline">
        <h2 id={headingId} className="text-sm font-semibold text-sumi-ink">
          More filters
        </h2>
        <p className="mt-1 text-xs text-faded-sumi">
          Narrow by what each card has or is missing.
        </p>
      </div>

      <div className="px-4 py-4 space-y-4">
        <Dimension label="Pitch">
          <PresenceSegmented
            dim="pitch"
            value={staged.pitch}
            onChange={(next) => handlePresence('pitch', next)}
          />
          <div className="mt-2.5">
            <label
              className={[
                'block text-xs mb-1',
                patternDisabled ? 'text-faded-sumi/70' : 'text-faded-sumi',
              ].join(' ')}
            >
              Pattern
            </label>
            <TomoSelect<'any' | PitchPattern>
              value={staged.pitchPattern ?? 'any'}
              options={PATTERN_OPTIONS}
              onValueChange={handlePattern}
              disabled={patternDisabled}
              ariaLabel="Pitch pattern"
            />
            {patternDisabled && (
              <p className="mt-1 text-[11px] text-faded-sumi">
                Choose <span className="text-sumi-ink">Has</span> pitch to filter by pattern.
              </p>
            )}
          </div>
        </Dimension>

        <Dimension label="Image">
          <PresenceSegmented
            dim="image"
            value={staged.image}
            onChange={(next) => handlePresence('image', next)}
          />
        </Dimension>

        <Dimension label="Audio">
          <PresenceSegmented
            dim="audio"
            value={staged.audio}
            onChange={(next) => handlePresence('audio', next)}
          />
        </Dimension>
      </div>

      <div className="px-4 py-3 border-t border-soft-hairline flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleReset}>
          Reset
        </Button>
        <Button variant="primary" size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>,
    document.body,
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Dimension({
  label, children,
}: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section>
      <h3 className="text-xs font-semibold text-sumi-ink mb-1.5">{label}</h3>
      {children}
    </section>
  )
}

function PresenceSegmented({
  dim, value, onChange,
}: {
  dim:      'pitch' | 'image' | 'audio'
  value:    PresenceState
  onChange: (next: PresenceState) => void
}): React.JSX.Element {
  return (
    <PillGroup compact>
      {PRESENCE_OPTIONS.map((opt) => (
        <Pill
          key={opt.value}
          variant="interactive"
          size="lg"
          selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          ariaLabel={`${opt.label} ${dim}`}
        >
          {opt.label}
        </Pill>
      ))}
    </PillGroup>
  )
}
