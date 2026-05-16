'use client'

import { useId, useRef, useEffect } from 'react'

export interface AddChipDescriptor {
  /** Stable id; also used as the key + as the id of the promoted slot for
   *  `aria-controls`. */
  id:     string
  /** Button label. Title-case noun, e.g. "Image", "Deck". */
  label:  string
  /** When true, the chip renders with a filled vermillion dot indicating the
   *  field carries a value. */
  filled: boolean
  /** Renders the inline editor when this chip is the active one. */
  render: () => React.JSX.Element
}

interface AddChipRowProps {
  chips:    ReadonlyArray<AddChipDescriptor>
  /** Currently promoted chip id, or null when nothing is expanded. */
  activeId: string | null
  onToggle: (id: string) => void
}

// ── Chip Row ──────────────────────────────────────────────────────────────────
//
// Quiet inline chips for optional capture fields (Image · Note · Deck · Source ·
// Card type). Each chip is a `<button>` with `aria-expanded` + `aria-controls`
// pointing at the promoted slot below. Only one chip is open at a time — keeps
// the page from feeling like a form, preserves the notebook tone.
//
// Filled chips persist a small vermillion dot so the user knows a value is set
// even when the editor is collapsed.

export function AddChipRow({ chips, activeId, onToggle }: AddChipRowProps): React.JSX.Element {
  const baseId       = useId()
  const slotId       = `${baseId}-slot`
  const promotedRef  = useRef<HTMLDivElement | null>(null)
  const previousId   = useRef<string | null>(null)
  const activeChip   = activeId !== null ? chips.find((c) => c.id === activeId) ?? null : null

  // When a chip opens, focus the first focusable inside the promoted slot so
  // keyboard users land on the new editor without an extra Tab.
  useEffect(() => {
    if (activeId === null || activeId === previousId.current) {
      previousId.current = activeId
      return
    }
    previousId.current = activeId
    const root = promotedRef.current
    if (root === null) return
    const focusable = root.querySelector<HTMLElement>(
      'input, textarea, select, button, [tabindex]:not([tabindex="-1"])',
    )
    focusable?.focus()
  }, [activeId])

  return (
    <div className="flex flex-col gap-3">
      <div
        role="group"
        aria-label="Optional details"
        className="flex flex-wrap items-center gap-x-1 gap-y-1.5"
      >
        {chips.map((chip, index) => {
          const isActive = chip.id === activeId
          return (
            <span key={chip.id} className="inline-flex items-center">
              {index > 0 && (
                <span aria-hidden="true" className="mx-0.5 text-faded-sumi/60 select-none">·</span>
              )}
              <button
                type="button"
                aria-expanded={isActive}
                aria-controls={slotId}
                onClick={() => onToggle(chip.id)}
                className={[
                  'ui-motion-colors group inline-flex items-center gap-1.5',
                  'rounded-[2px] px-2 py-1.5 -my-0.5',
                  'font-mono text-xs uppercase tracking-[0.12em]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-inari-vermillion/45',
                  isActive
                    ? 'text-sumi-ink bg-cream-inset'
                    : 'text-faded-sumi hover:text-sumi-ink hover:bg-cream-inset/60',
                ].join(' ')}
              >
                <span
                  aria-hidden="true"
                  className={[
                    'inline-block h-1.5 w-1.5 rounded-full transition-colors',
                    chip.filled ? 'bg-inari-vermillion' : 'bg-soft-hairline group-hover:bg-faded-sumi/60',
                  ].join(' ')}
                />
                <span>{chip.label}</span>
                {chip.filled && (
                  <span className="sr-only"> (set)</span>
                )}
              </button>
            </span>
          )
        })}
      </div>

      <div
        id={slotId}
        ref={promotedRef}
        className={activeChip !== null ? 'pt-1 pb-2' : 'hidden'}
      >
        {activeChip !== null && activeChip.render()}
      </div>
    </div>
  )
}
