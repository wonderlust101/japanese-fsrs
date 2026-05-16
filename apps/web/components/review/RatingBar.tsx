'use client'

import type { UserRating } from '@fsrs-japanese/shared-types'
import { cn }              from '@/lib/utils'

// Rating bar v4. Fixed to the bottom of the viewport on every breakpoint.
// Each button stacks an icon (~24px) above a label, with a real keycap chip
// at the bottom-center showing the 1/2/3/4 keyboard mapping. Colors come
// from the new --color-rating-{again,hard,good,easy} tokens defined in
// globals.css (Anki convention through Tomo OKLCH tones).
//
// The keycap chip is a styled `<kbd>` with an inner shadow that reads as a
// physical key. Each button is therefore a literal keyboard cue, not just
// a coloured pill.

export interface NextIntervals {
  again: string
  hard:  string
  good:  string
  easy:  string
}

interface RatingBarProps {
  onRate:         (rating: UserRating) => void
  nextIntervals?: NextIntervals
}

interface Spec {
  value: UserRating
  label: string
  key:   string
  // Inline style values keep the saturated tokens off Tailwind's arbitrary
  // class scanner (which can't see custom CSS vars).
  fill:  string
  // Icon node, sized in the component below.
  icon:  React.ReactNode
}

const ICON_SIZE = 18

function AgainIcon(): React.JSX.Element {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 3.2-6.9" />
      <path d="M3 4v5h5" />
    </svg>
  )
}
function HardIcon(): React.JSX.Element {
  // AlertTriangle-style: a rounded equilateral triangle with a centered
  // exclamation. Reads as "warning / this was difficult" without leaning
  // on partial-fill metaphors.
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4.5L21 19.5H3L12 4.5z" />
      <path d="M12 11v4" />
      <path d="M12 17.5h.01" strokeWidth="2" />
    </svg>
  )
}
function GoodIcon(): React.JSX.Element {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  )
}
function EasyIcon(): React.JSX.Element {
  return (
    <svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 11l5 5L20 5" />
      <path d="M4 17l5 5L20 11" />
    </svg>
  )
}

// Frame interval strings with a `~` prefix so they read as honest
// approximations. Special-cases values that already lead with `<` or `~` or
// other non-numeric symbols (e.g. `<10m` stays `<10m` because `<` already
// communicates "less than").
function framedInterval(s: string): string {
  if (s === '') return s
  const first = s.charAt(0)
  if (first === '~' || first === '<' || first === '>' || first === '≈') return s
  return `~${s}`
}

const RATINGS: readonly Spec[] = [
  { value: 'again', label: 'Again', key: '1', fill: 'var(--color-rating-again)', icon: <AgainIcon /> },
  { value: 'hard',  label: 'Hard',  key: '2', fill: 'var(--color-rating-hard)',  icon: <HardIcon /> },
  { value: 'good',  label: 'Good',  key: '3', fill: 'var(--color-rating-good)',  icon: <GoodIcon /> },
  { value: 'easy',  label: 'Easy',  key: '4', fill: 'var(--color-rating-easy)',  icon: <EasyIcon /> },
] as const

export function RatingBar({ onRate, nextIntervals }: RatingBarProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="Rate this card"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-warm-paper-raised border-t border-soft-hairline/60',
        'px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
      )}
    >
      <div className="mx-auto grid max-w-[560px] grid-cols-4 gap-2">
        {RATINGS.map((spec) => {
          const interval = nextIntervals?.[spec.value]
          return (
            <button
              key={spec.value}
              type="button"
              onClick={() => onRate(spec.value)}
              aria-label={`${spec.label} (press ${spec.key})`}
              aria-keyshortcuts={spec.key}
              style={{ backgroundColor: spec.fill, borderColor: spec.fill }}
              className={cn(
                // Single horizontal row: icon (where it fits) + label.
                // The keyboard shortcut is announced via aria-keyshortcuts
                // and lives in the per-card help (1=Again … 4=Easy), so
                // the substrate stays clean.
                'group relative inline-flex items-center justify-center gap-2',
                'h-12 md:h-14 rounded-md border px-3',
                'text-warm-paper-raised',
                'transition-[filter,transform] duration-200 ease-out',
                'cursor-pointer hover:brightness-95 active:translate-y-[1px]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
              )}
            >
              {interval !== undefined && (
                <span
                  aria-label={`Next review: approximately ${interval}`}
                  className={cn(
                    'absolute right-2 top-1.5',
                    'font-mono text-[0.6875rem] tabular-nums leading-none font-medium',
                    'text-warm-paper-raised/90',
                  )}
                >
                  {framedInterval(interval)}
                </span>
              )}

              <span className="text-warm-paper-raised/95 leading-none hidden md:inline-flex">
                {spec.icon}
              </span>

              <span className="font-display text-sm md:text-[0.9375rem] leading-none tracking-tight">
                {spec.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
