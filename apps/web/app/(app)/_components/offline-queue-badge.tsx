'use client'

import Link from 'next/link'

import { useOfflineQueueStatus } from '@/lib/api/reviews'

interface Props {
  /** When true, render as a floating dot suitable for icon-only nav (mobile bottom bar / collapsed rail).
   *  When false (default), render inline next to a label (desktop sidebar). */
  floating?: boolean
}

/**
 * Numeric badge that surfaces the offline review queue state in nav chrome.
 * Renders nothing when the queue is empty. Switches to a danger color and
 * a "!" suffix when the queue has tipped into the stuck state.
 *
 * When stuck, the badge IS the recovery affordance: it renders as a Link
 * to /review so the user doesn't have to find Reviews separately. When
 * syncing (non-stuck), it stays an indicator-only span.
 */
export function OfflineQueueBadge({ floating = false }: Props): React.JSX.Element | null {
  const { count, stuck } = useOfflineQueueStatus()
  if (count === 0) return null

  const tone = stuck
    ? 'bg-error text-warm-paper-raised'
    : 'bg-inari-vermillion text-warm-paper-raised'

  const ariaLabel = stuck
    ? `${count} review${count === 1 ? '' : 's'} stuck. Open Reviews to resolve.`
    : `${count} review${count === 1 ? '' : 's'} waiting to sync`

  const label = stuck ? `${count}!` : String(count)

  const floatingClasses = [
    'absolute -top-0.5 -right-1 min-w-[16px] h-[16px] px-1 rounded-full',
    'text-[10px] font-bold leading-[16px] text-center tabular-nums',
    tone,
  ].join(' ')

  const inlineClasses = [
    'ml-auto inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 rounded-full',
    'text-[11px] font-semibold leading-none text-center tabular-nums',
    tone,
  ].join(' ')

  // Stuck state IS the recovery affordance. Linking the badge removes the
  // friction of "tooltip says click Reviews, badge isn't clickable."
  if (stuck) {
    const linkClasses = (floating ? floatingClasses : inlineClasses) +
      ' hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error'
    return (
      <Link
        href="/review"
        aria-label={ariaLabel}
        title={ariaLabel}
        className={linkClasses}
      >
        {label}
      </Link>
    )
  }

  return (
    <span
      aria-label={ariaLabel}
      title={ariaLabel}
      className={floating ? floatingClasses : inlineClasses}
    >
      {label}
    </span>
  )
}
