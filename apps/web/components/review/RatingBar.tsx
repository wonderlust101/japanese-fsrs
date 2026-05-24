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
  /** Static Tailwind classes derived from the --color-rating-{kind} tokens
   *  in globals.css. Static strings so Tailwind's class scanner picks them
   *  up at build time, no inline style runtime work needed. */
  tone:  string
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

/**
 * Format an FSRS `scheduledDays` value into a compact Anki-style label.
 * Exported so the orchestrator (ReviewCard) can map the four-rating preview
 * coming back from `GET /reviews/:cardId/preview` without duplicating the
 * unit thresholds.
 */
export function formatInterval(days: number): string {
  if (days < 1 / 1440) return '<1m'                            // under a minute
  if (days < 1 / 24)   return `${Math.round(days * 1440)}m`    // 1m–59m
  if (days < 1)        return `${Math.round(days * 24)}h`      // 1h–23h
  if (days < 30)       return `${Math.round(days)}d`           // 1d–29d
  if (days < 365)      return `${Math.round(days / 30)}mo`     // 1mo–11mo
  return `${(days / 365).toFixed(1)}y`                         // 1.0y+
}

const RATINGS: readonly Spec[] = [
  { value: 'again', label: 'Again', key: '1', tone: 'bg-rating-again border-rating-again', icon: <AgainIcon /> },
  { value: 'hard',  label: 'Hard',  key: '2', tone: 'bg-rating-hard border-rating-hard',   icon: <HardIcon /> },
  { value: 'good',  label: 'Good',  key: '3', tone: 'bg-rating-good border-rating-good',   icon: <GoodIcon /> },
  { value: 'easy',  label: 'Easy',  key: '4', tone: 'bg-rating-easy border-rating-easy',   icon: <EasyIcon /> },
] as const

export function RatingBar({ onRate, nextIntervals }: RatingBarProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="Rate this card"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-[var(--z-bar)]',
        'bg-warm-paper-raised border-t border-soft-hairline/60',
        'px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
      )}
    >
      <div className="mx-auto max-w-[560px]">
        {nextIntervals !== undefined && (
          <div className="mb-1.5 grid grid-cols-4 gap-2" aria-hidden="true">
            {RATINGS.map((spec) => {
              const interval = nextIntervals[spec.value]
              return (
                <span
                  key={spec.value}
                  className="text-center font-mono text-sm tabular-nums leading-none text-faded-sumi"
                >
                  {framedInterval(interval)}
                </span>
              )
            })}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((spec) => {
            const interval = nextIntervals?.[spec.value]
            return (
              <button
                key={spec.value}
                type="button"
                onClick={() => onRate(spec.value)}
                aria-label={
                  interval !== undefined
                    ? `${spec.label} (press ${spec.key}). Next review approximately ${interval}.`
                    : `${spec.label} (press ${spec.key})`
                }
                aria-keyshortcuts={spec.key}
                className={cn(
                  // Two-row column: glyph (top), label (bottom). The keyboard
                  // shortcut is still wired via `aria-keyshortcuts` + the
                  // aria-label so SR/keyboard users keep the affordance; the
                  // visible numeral is gone for a slimmer touch chrome.
                  'group relative flex flex-col items-center justify-center gap-0.5',
                  'h-14 rounded-md border px-3',
                  'text-warm-paper-raised',
                  spec.tone,
                  'transition-[filter,transform] duration-200 ease-out',
                  'cursor-pointer hover:brightness-95 active:translate-y-[1px]',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
                )}
              >
                <span className="text-warm-paper-raised/95 leading-none inline-flex">
                  {spec.icon}
                </span>

                <span className="font-medium text-sm md:text-base leading-none tracking-tight">
                  {spec.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
