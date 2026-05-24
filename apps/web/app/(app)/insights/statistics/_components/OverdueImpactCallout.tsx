import { cn } from '@/lib/utils'

import type { OverdueImpact } from './types'

interface OverdueImpactCalloutProps {
  data: OverdueImpact
}

/**
 * Single-stat callout summarizing overdue impact. When backlog exists,
 * the card uses vermillion-wash to flag attention; when caught up, the
 * card stays calm with the standard cream-inset surface and a quiet
 * "no overdue cards" line.
 */
export function OverdueImpactCallout({
  data,
}: OverdueImpactCalloutProps): React.JSX.Element {
  const hasBacklog = data.overdueCount > 0

  return (
    <aside
      aria-label="Overdue impact"
      className={cn(
        'grid grid-cols-1 items-baseline gap-x-6 gap-y-4 rounded-[2px] px-5 py-5 sm:grid-cols-[auto,1fr] sm:px-6 sm:py-6',
        hasBacklog ? 'bg-vermillion-wash/55' : 'bg-cream-inset',
      )}
    >
      <div className="flex flex-col gap-y-2">
        <p className="font-mono text-sm text-faded-sumi">
          Overdue
        </p>
        <p
          className={cn(
            'font-display text-[3rem] font-medium leading-none tabular-nums sm:text-[3.5rem]',
            hasBacklog ? 'text-inari-vermillion-deep' : 'text-sumi-ink',
          )}
        >
          {data.overdueCount}
        </p>
      </div>
      <div className="flex flex-col gap-y-2">
        {hasBacklog ? (
          <>
            <p className="text-base leading-relaxed text-sumi-ink">
              <span className="font-medium text-inari-vermillion-deep">
                {data.overduePercent.toFixed(1)}%
              </span>{' '}
              of this week&rsquo;s load is overdue.
            </p>
            <p className="text-base leading-relaxed text-faded-sumi">
              Clearing overdue cards first will make the schedule feel lighter for the rest of the week.
            </p>
          </>
        ) : (
          <>
            <p className="text-base leading-relaxed text-sumi-ink">
              No overdue cards.
            </p>
            <p className="text-base leading-relaxed text-faded-sumi">
              Your queue is current. Whatever&rsquo;s on the schedule is what&rsquo;s actually due today.
            </p>
          </>
        )}
        <p className="mt-1 font-mono text-sm text-faded-sumi">
          {data.totalDueWeek} cards due this week
        </p>
      </div>
    </aside>
  )
}
