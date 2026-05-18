'use client'

import { cn } from '@/lib/utils'

type CopySize = 'xs' | 'sm'

interface CopyButtonProps {
  onClick:    () => void
  copied:     boolean
  label:      string
  size?:      CopySize
  className?: string
  ariaLabel?: string
}

const SIZE_CLASS: Record<CopySize, string> = {
  xs: 'h-6 px-2 text-[0.625rem]',
  sm: 'h-7 px-2 text-[0.6875rem]',
}

/**
 * "Copy to clipboard" button that morphs to "✓ Copied" for ~1500ms after a
 * successful copy. Pairs with the `useCopyConfirmation` hook for the state.
 *
 * Anatomy is the mono-uppercase chip register: 2px corner, 1px soft-hairline
 * border (deck-n5 wash + green stroke in the confirmed state), warm-paper-raised
 * fill, sumi-ink 1px focus outline at offset 2. Used by the page-state dev
 * panel and the cards / decks dev fixtures.
 */
export function CopyButton({
  onClick,
  copied,
  label,
  size       = 'sm',
  className,
  ariaLabel,
}: CopyButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-live="polite"
      aria-label={ariaLabel ?? label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[2px] border font-mono uppercase tracking-[0.12em] transition-colors',
        SIZE_CLASS[size],
        copied
          ? 'border-deck-n5-mark/30 bg-deck-n5-wash text-deck-n5-mark'
          : 'border-soft-hairline bg-warm-paper-raised text-faded-sumi hover:border-faded-sumi hover:text-sumi-ink',
        'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-sumi-ink',
        className,
      )}
    >
      {copied ? (
        <>
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path
              d="M2 5 L 4.2 7 L 8 3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
          Copied
        </>
      ) : (
        label
      )}
    </button>
  )
}
