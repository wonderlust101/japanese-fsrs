'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface FrequencySource {
  label: string
  rank:  number
}

interface FrequencyBadgeProps {
  rank:    number | null | undefined
  sources?: FrequencySource[]
}

// Top-left frequency rank badge. Lapis-faithful: a small numeric chip with a
// click-to-expand list of per-source ranks. When only the legacy single rank
// is present, the dropdown shows a single line; when no rank is present, the
// badge hides entirely so the layout doesn't carry an empty affordance.

export function FrequencyBadge({ rank, sources }: FrequencyBadgeProps): React.JSX.Element | null {
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

  if (rank === null || rank === undefined) return null

  const formatted = rank.toLocaleString('en-US')
  const list: FrequencySource[] = sources !== undefined && sources.length > 0
    ? sources
    : [{ label: 'Frequency rank', rank }]

  return (
    <div ref={wrapperRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-2 px-2 py-1 rounded-[2px]',
          'border border-soft-hairline bg-warm-paper-raised',
          'font-mono text-xs text-faded-sumi',
          'hover:border-sumi-ink/35 hover:text-sumi-ink cursor-pointer transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-1 focus-visible:outline-sumi-ink focus-visible:outline-offset-2',
        )}
      >
        <span aria-hidden="true" className="text-sumi-ink/80">№</span>
        <span className="tabular-nums text-sumi-ink">{formatted}</span>
        <svg width="9" height="9" viewBox="0 0 9 9" aria-hidden="true">
          <path d="M2 3.5l2.5 2.5L7 3.5" stroke="currentColor" strokeWidth="1" fill="none" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="dialog"
          className={cn(
            // z-50 sits above the rating bar (z-30) and the fixed top bar
            // (z-40) so the dropdown is never visually clipped by chrome
            // when the badge is near the card's edges.
            'absolute left-0 top-full mt-1 z-50 min-w-[14rem]',
            'rounded-[2px] border border-soft-hairline bg-warm-paper-raised shadow-card',
            'py-2',
          )}
        >
          <p className="px-3 pb-1 font-display text-xs font-medium text-faded-sumi">
            Frequency
          </p>
          <ul>
            {list.map((s, i) => (
              <li key={`${s.label}-${i}`} className="flex items-baseline justify-between gap-3 px-3 py-1">
                <span className="text-sm text-sumi-ink">{s.label}</span>
                <span className="font-mono tabular-nums text-sm text-faded-sumi">{s.rank.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
