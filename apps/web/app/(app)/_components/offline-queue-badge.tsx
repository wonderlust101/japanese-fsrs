'use client'

import { useOfflineQueueStatus } from '@/lib/api/reviews'

interface Props {
  /** When true, render as a floating dot suitable for icon-only nav (mobile bottom bar).
   *  When false (default), render inline next to a label (desktop sidebar). */
  floating?: boolean
}

/**
 * Numeric badge that surfaces the offline review queue state in nav chrome.
 * Renders nothing when the queue is empty. Switches to a danger color and
 * a "!" suffix when the queue has tipped into the stuck state — at which
 * point auto-retry is disabled and the user must visit /review to act.
 */
export function OfflineQueueBadge({ floating = false }: Props): React.JSX.Element | null {
  const { count, stuck } = useOfflineQueueStatus()
  if (count === 0) return null

  const tone = stuck
    ? 'bg-error text-warm-paper-raised'
    : 'bg-inari-vermillion text-warm-paper-raised'

  const ariaLabel = stuck
    ? `${count} review${count === 1 ? '' : 's'} stuck — tap Review to resolve`
    : `${count} review${count === 1 ? '' : 's'} waiting to sync`

  const label = stuck ? `${count}!` : String(count)

  if (floating) {
    return (
      <span
        aria-label={ariaLabel}
        className={[
          'absolute -top-0.5 -right-1 min-w-[16px] h-[16px] px-1 rounded-full',
          'text-[10px] font-bold leading-[16px] text-center tabular-nums',
          tone,
        ].join(' ')}
      >
        {label}
      </span>
    )
  }

  return (
    <span
      aria-label={ariaLabel}
      className={[
        'ml-auto min-w-[20px] h-[20px] px-1.5 rounded-full',
        'text-[11px] font-semibold leading-[20px] text-center tabular-nums',
        tone,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
