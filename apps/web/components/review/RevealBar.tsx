'use client'

import { cn } from '@/lib/utils'

interface RevealBarProps {
  onReveal: () => void
}

// Fixed-bottom counterpart to RatingBar that lives on the front-of-card
// state. Gives mouse-only users an explicit "Reveal answer" affordance in
// the same chrome slot the rating grid occupies after flip. Keyboard users
// keep Space/Enter (handled at the page level); the kbd chip on the right
// surfaces that on desktop.
//
// Size + padding match RatingBar so the bar's footprint stays identical
// across front and back states — no layout shift on flip.
export function RevealBar({ onReveal }: RevealBarProps): React.JSX.Element {
  return (
    <div
      role="group"
      aria-label="Reveal answer"
      className={cn(
        'fixed bottom-0 left-0 right-0 z-30',
        'bg-warm-paper-raised border-t border-soft-hairline/60',
        'px-4 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]',
      )}
    >
      <div className="mx-auto max-w-[560px]">
        <button
          type="button"
          onClick={onReveal}
          aria-keyshortcuts="space"
          className={cn(
            'group relative flex h-14 w-full items-center justify-center gap-3',
            'rounded-[2px] border border-inari-vermillion bg-inari-vermillion text-warm-paper-raised',
            'transition-[background-color,border-color,transform] duration-200 ease-out',
            'cursor-pointer hover:bg-inari-vermillion-deep hover:border-inari-vermillion-deep active:translate-y-[1px]',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
          )}
        >
          <span className="font-medium text-sm md:text-base leading-none tracking-tight">
            Reveal answer
          </span>
        </button>
      </div>
    </div>
  )
}
