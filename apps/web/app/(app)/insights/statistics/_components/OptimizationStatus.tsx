import { cn } from '@/lib/utils'

import type { FsrsState } from './types'

interface OptimizationStatusProps {
  status:          FsrsState['optimizationStatus']
  lastOptimizedAt: FsrsState['lastOptimizedAt']
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

function formatDate(iso: string | null): string | null {
  if (iso === null) return null
  const parts = iso.split('-')
  const y = parts[0]
  const m = Number(parts[1])
  const d = parts[2] ?? ''
  return `${MONTHS[m - 1] ?? ''} ${d.replace(/^0/, '')}, ${y}`
}

/**
 * Status indicator for FSRS parameter optimization. Three states:
 * `ready` (recently optimized, green dot), `pending` (data has drifted,
 * vermillion dot), `never-run` (no optimization yet, sumi dot). One
 * line of plain-English explanation per state.
 */
export function OptimizationStatus({
  status,
  lastOptimizedAt,
}: OptimizationStatusProps): React.JSX.Element {
  const dot = (() => {
    if (status === 'ready')   return 'bg-jlpt-n5-fresh-leaf'
    if (status === 'pending') return 'bg-inari-vermillion-deep'
    return 'bg-sumi-ink/65'
  })()

  const headline = (() => {
    if (status === 'ready')   return 'Parameters are current.'
    if (status === 'pending') return 'A re-optimization is recommended.'
    return 'Parameters have never been optimized.'
  })()

  const detail = (() => {
    if (status === 'ready') {
      const dateLabel = formatDate(lastOptimizedAt)
      return dateLabel === null
        ? 'FSRS is tuned to your review history.'
        : `Last tuned ${dateLabel}. FSRS is reading your review history accurately.`
    }
    if (status === 'pending') {
      const dateLabel = formatDate(lastOptimizedAt)
      return dateLabel === null
        ? 'Your review history has drifted from the current parameters. Re-optimization will sharpen the scheduling predictions.'
        : `Last tuned ${dateLabel}. Recent reviews diverge from the current parameters; re-optimization will sharpen the predictions.`
    }
    return 'After a few hundred reviews, optimization will tailor FSRS to how you actually answer.'
  })()

  return (
    <div className="flex items-start gap-x-3.5">
      <span
        aria-hidden="true"
        className={cn(
          'mt-1.5 inline-block h-[10px] w-[10px] shrink-0 rounded-full',
          dot,
        )}
      />
      <div className="flex flex-col gap-y-1">
        <p className="font-mono text-[0.8125rem] uppercase tracking-[0.14em] text-sumi-ink/85">
          {headline}
        </p>
        <p className="max-w-[58ch] text-[0.875rem] leading-relaxed text-faded-sumi">
          {detail}
        </p>
      </div>
    </div>
  )
}
