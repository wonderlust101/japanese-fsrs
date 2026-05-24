'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import type {
  CardMissingField,
  CardPresentField,
  CardSortField,
  CardStatusFilter,
  PitchPattern,
} from '@fsrs-japanese/shared-types'

import { Button } from '@/components/ui/Button'
import { TomoSelect, type TomoSelectOption } from '@/components/ui/TomoSelect'

import type { DeckOption } from './cards-toolbar'
import {
  chipsFromState,
  clearChip,
  hasAnyFilter,
  type CardsFilterState,
  type JlptFilter,
} from './cards-filter-state'

interface Props {
  open:    boolean
  state:   CardsFilterState
  decks:   ReadonlyArray<DeckOption>
  onChange:   (next: CardsFilterState) => void
  onClearAll: () => void
  onClose:    () => void
}

/**
 * Mobile filter sheet. Bottom-anchored `<dialog>` that hosts every
 * filter dimension on small screens, replacing the desktop right cluster
 * + add-filter menu with a single tap target.
 *
 * Anatomy: native `<dialog>` (top-layer + focus trap + Esc) positioned
 * to the viewport bottom via CSS so the surface feels like a sheet
 * without us having to build the gesture-driven primitive. Live count
 * is provided by the parent via the count line on results once the
 * sheet closes; we deliberately don't echo the count inside the sheet
 * to keep it from competing visually.
 */
export function CardsFilterSheet({
  open, state, decks, onChange, onClearAll, onClose,
}: Props): React.JSX.Element | null {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Escape closes. The native <dialog> we replaced gave this for
  // free; here we wire it manually.
  useEffect(() => {
    if (!open) return undefined
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Body scroll lock while the sheet is open so iOS doesn't let the
  // page scroll underneath. We restore the prior value on close so
  // nested sheets (none today, but defensively) compose cleanly.
  useEffect(() => {
    if (!open) return undefined
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  if (!mounted || !open) return null

  const chips = chipsFromState(state)

  // Portal-based custom sheet. Replaced the native <dialog> + showModal()
  // path entirely because iOS WebKit's top-layer rendering doesn't
  // honor `display: flex` / `flex-direction: column` / `mt-auto` the
  // way Blink does — children stacked on top of each other on iPhone
  // Chrome instead of flowing into a bottom-anchored column. This
  // portal-based version uses explicit `position: fixed` so layout is
  // predictable across all WebKit/Blink builds.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Filter cards"
      className="fixed inset-0 z-50 flex flex-col items-stretch justify-end"
    >
      {/* Dim backdrop. Tap dismisses. Sits BEHIND the sheet via DOM
          order; the sheet's higher z within this stacking context
          handles the rest. */}
      <button
        type="button"
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-sumi-ink/40 backdrop-blur-[2px]"
      />
      {/* Sheet itself. Relative positioning over the absolute backdrop
          so taps inside don't bubble to the close handler. */}
      <div
        className={[
          'relative w-full max-w-full max-h-[88dvh]',
          'flex flex-col',
          'rounded-t-[2px] border-t border-soft-hairline bg-warm-paper-raised',
          'animate-page-enter',
        ].join(' ')}
      >
      {/* ── Sheet handle + header ─────────────────────────────────── */}
      <div className="shrink-0 border-b border-soft-hairline">
        <div
          aria-hidden="true"
          className="mx-auto mt-2 h-1 w-10 rounded-full bg-soft-hairline"
        />
        <div className="flex items-baseline justify-between px-4 pt-3 pb-3">
          <h2 className="text-base font-semibold text-sumi-ink">Filter cards</h2>
          {hasAnyFilter(state) && (
            <button
              type="button"
              onClick={onClearAll}
              className="font-mono text-xs text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {/* Active chips, mirrored from the desktop strip so the user
            sees what's already on without scrolling back. */}
        {chips.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span
                key={`${chip.dim}:${chip.value}`}
                className="inline-flex h-7 items-center gap-2 rounded-[2px] border border-soft-hairline bg-cream-inset px-2 font-mono text-sm text-sumi-ink"
              >
                {chip.label}
                <button
                  type="button"
                  onClick={() => onChange(clearChip(state, chip.dim))}
                  aria-label={`Remove ${chip.label}`}
                  className="-mr-1 inline-flex h-5 w-5 items-center justify-center text-faded-sumi hover:text-sumi-ink"
                >
                  <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                    <path d="M2 2l6 6M8 2l-6 6" />
                  </svg>
                </button>
              </span>
            ))}
          </div>
        )}

        {/* All seven dimensions render through TomoSelect for a single
            consistent control vocabulary inside the sheet. The previous
            mix of segmented rows + native selects was the audit's #2
            P3 finding; committing to TomoSelect closes that gap. The
            null-state for the missing/has/pattern dims is encoded as a
            sentinel 'any' value because TomoSelect requires a non-empty
            string token, then translated back at the boundary. */}

        <Section label="Deck">
          <TomoSelect<string>
            value={state.deckId}
            onValueChange={(deckId) => onChange({ ...state, deckId })}
            options={[
              { value: 'all', label: 'All decks' },
              ...decks.map((d) => ({ value: d.id, label: d.name })),
            ]}
            ariaLabel="Filter by deck"
          />
        </Section>

        <Section label="JLPT level">
          <TomoSelect<JlptFilter>
            value={state.jlpt}
            onValueChange={(jlpt) => onChange({ ...state, jlpt })}
            options={JLPT_OPTIONS}
            ariaLabel="Filter by JLPT level"
          />
        </Section>

        <Section label="Status">
          <TomoSelect<CardStatusFilter>
            value={state.status}
            onValueChange={(status) => onChange({ ...state, status })}
            options={STATUS_OPTIONS}
            ariaLabel="Filter by status"
          />
        </Section>

        <Section label="Sort">
          <TomoSelect<CardSortField>
            value={state.sort}
            onValueChange={(sort) => onChange({ ...state, sort })}
            options={SORT_OPTIONS}
            ariaLabel="Sort by"
          />
        </Section>

        <Section label="Missing field">
          <TomoSelect<MissingFieldSentinel>
            value={state.missingField ?? 'any'}
            onValueChange={(v) => onChange({
              ...state,
              missingField: v === 'any' ? null : (v as CardMissingField),
            })}
            options={MISSING_OPTIONS}
            ariaLabel="Filter by missing field"
          />
        </Section>

        <Section label="Has">
          <TomoSelect<PresentFieldSentinel>
            value={state.presentField ?? 'any'}
            onValueChange={(v) => {
              const next: CardsFilterState = {
                ...state,
                presentField: v === 'any' ? null : (v as CardPresentField),
              }
              if (next.presentField !== 'pitch') next.pitchPattern = null
              onChange(next)
            }}
            options={PRESENT_OPTIONS}
            ariaLabel="Filter by present field"
          />
        </Section>

        {state.presentField === 'pitch' && (
          <Section label="Pitch pattern">
            <TomoSelect<PatternSentinel>
              value={state.pitchPattern ?? 'any'}
              onValueChange={(v) => onChange({
                ...state,
                pitchPattern: v === 'any' ? null : (v as PitchPattern),
              })}
              options={PATTERN_OPTIONS}
              ariaLabel="Filter by pitch pattern"
            />
          </Section>
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-soft-hairline bg-warm-paper-raised px-4 py-3">
        <Button variant="primary" onClick={onClose} className="w-full">
          Show results
        </Button>
      </div>
      </div>
    </div>,
    document.body,
  )
}

// ─── Sub-components + option constants ──────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="mb-4">
      <h3 className="mb-1.5 font-mono text-sm uppercase tracking-[0.08em] text-faded-sumi">
        {label}
      </h3>
      {children}
    </section>
  )
}

// Sentinels for the null-state of nullable filter dims. TomoSelect needs
// a non-empty string token for "no value selected", so each nullable dim
// uses `any` as the placeholder and translates at the onChange boundary.
type MissingFieldSentinel = 'any' | CardMissingField
type PresentFieldSentinel = 'any' | CardPresentField
type PatternSentinel      = 'any' | PitchPattern

const JLPT_OPTIONS: ReadonlyArray<TomoSelectOption<JlptFilter>> = [
  { value: 'all',    label: 'All levels' },
  { value: 'N5',     label: 'N5' },
  { value: 'N4',     label: 'N4' },
  { value: 'N3',     label: 'N3' },
  { value: 'N2',     label: 'N2' },
  { value: 'N1',     label: 'N1' },
  { value: 'beyond', label: 'Beyond JLPT' },
]

const STATUS_OPTIONS: ReadonlyArray<TomoSelectOption<CardStatusFilter>> = [
  { value: 'all',       label: 'All statuses' },
  { value: 'new',       label: 'New' },
  { value: 'learning',  label: 'Learning' },
  { value: 'review',    label: 'Review' },
  { value: 'suspended', label: 'Suspended' },
]

const SORT_OPTIONS: ReadonlyArray<TomoSelectOption<CardSortField>> = [
  { value: 'recent', label: 'Recently added' },
  { value: 'due',    label: 'Due date' },
  { value: 'lapses', label: 'Most lapses' },
]

const MISSING_OPTIONS: ReadonlyArray<TomoSelectOption<MissingFieldSentinel>> = [
  { value: 'any',      label: 'Any' },
  { value: 'reading',  label: 'Reading' },
  { value: 'meaning',  label: 'Meaning' },
  { value: 'example',  label: 'Example' },
  { value: 'mnemonic', label: 'Mnemonic' },
  { value: 'picture',  label: 'Picture' },
  { value: 'nuance',   label: 'Nuance' },
  { value: 'pitch',    label: 'Pitch' },
]

const PRESENT_OPTIONS: ReadonlyArray<TomoSelectOption<PresentFieldSentinel>> = [
  { value: 'any',     label: 'Any' },
  { value: 'picture', label: 'Picture' },
  { value: 'pitch',   label: 'Pitch' },
]

const PATTERN_OPTIONS: ReadonlyArray<TomoSelectOption<PatternSentinel>> = [
  { value: 'any',       label: 'Any pattern' },
  { value: 'heiban',    label: 'Heiban (平板)' },
  { value: 'atamadaka', label: 'Atamadaka (頭高)' },
  { value: 'nakadaka',  label: 'Nakadaka (中高)' },
  { value: 'odaka',     label: 'Odaka (尾高)' },
]

