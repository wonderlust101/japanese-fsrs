'use client'

import { useRef } from 'react'

interface RangeOption<K extends string> {
  key:   K
  label: string
}

interface ChartRangeToggleProps<K extends string> {
  /** Accessible group name, e.g. "Retention time range". */
  label:    string
  options:  ReadonlyArray<RangeOption<K>>
  value:    K
  onChange: (next: K) => void
}

/**
 * Single-select range selector shared by the Insights charts (Progress's
 * time range, the Forecast's 7/14/28 window). Modeled as a `radiogroup` of
 * `radio`s, not a `tablist`: there is no associated tabpanel and the chart
 * updates in place, so the radio pattern matches the behavior (pick exactly
 * one of a set). It carries the full keyboard contract that role implies: a
 * single tab stop (roving tabindex), Arrow keys to move and select, and
 * Home/End to jump to the ends.
 *
 * Touch targets meet 44px at the base breakpoint (the mobile surface the
 * product is used on); desktop tightens back to a compact chip.
 */
export function ChartRangeToggle<K extends string>({
  label,
  options,
  value,
  onChange,
}: ChartRangeToggleProps<K>): React.JSX.Element {
  const buttonsRef = useRef<Array<HTMLButtonElement | null>>([])

  const moveTo = (index: number): void => {
    const count = options.length
    const next = options[((index % count) + count) % count]
    if (next === undefined) return
    onChange(next.key)
    buttonsRef.current[options.indexOf(next)]?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        moveTo(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        moveTo(index - 1)
        break
      case 'Home':
        e.preventDefault()
        moveTo(0)
        break
      case 'End':
        e.preventDefault()
        moveTo(options.length - 1)
        break
      default:
        break
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-[2px] border border-soft-hairline bg-cream-inset/40 p-0.5"
    >
      {options.map((o, index) => {
        const active = o.key === value
        return (
          <button
            key={o.key}
            ref={(el) => { buttonsRef.current[index] = el }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={[
              'inline-flex min-h-[2.75rem] items-center rounded-[2px] px-3 font-mono text-sm transition-colors',
              'sm:min-h-[1.75rem] sm:px-2.5',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
              active
                ? 'bg-vermillion-wash text-inari-vermillion-deep'
                : 'text-faded-sumi hover:text-sumi-ink',
            ].join(' ')}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
