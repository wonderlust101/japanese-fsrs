'use client'

import { SectionCard } from '@/components/ui/SectionCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { CompositionStrip } from '@/components/review/CompositionStrip'
import { cn } from '@/lib/utils'

import type { QueueBreakdown } from '@/lib/review/queue-classify'
import { totalFromBreakdown } from '@/lib/review/queue-classify'

export type SummaryTone = 'default' | 'catch-up' | 'empty' | 'loading'

interface SetupSummaryProps {
  tone:           SummaryTone
  breakdown:      QueueBreakdown
  timeLabel:      string
  deckCount:      number
  totalDeckCount: number
  modified:       boolean
  /** Sticky action area: composed by the orchestrator (Start button, reset link). */
  actions:        React.ReactNode
}

// The summary lives inside a SectionCard so it inherits the Today module
// chrome (2px vermillion stripe + kanji ornament + small-caps mono label +
// hairline rule beneath header). The CompositionStrip carries the chart;
// meta counts and the action area follow.

export function SetupSummary({
  tone,
  breakdown,
  timeLabel,
  deckCount,
  totalDeckCount,
  modified,
  actions,
}: SetupSummaryProps): React.JSX.Element {
  const total = totalFromBreakdown(breakdown)

  const description =
    tone === 'empty'
      ? 'Nothing scheduled today.'
      : tone === 'catch-up'
        ? `Heavier day than usual. ${breakdown.backlogCount} overdue.`
        : undefined

  return (
    <SectionCard
      id="review-setup-summary"
      kanji={tone === 'catch-up' ? '催' : '今'}
      label={tone === 'catch-up' ? "Today's session, catch-up" : "Today's session"}
      {...(description !== undefined && { description })}
      stripeTone={modified ? 'aizome' : 'brand'}
    >
      {tone === 'loading' ? (
        <SummarySkeleton />
      ) : (
        <>
          <CompositionStrip
            breakdown={breakdown}
            tone={tone === 'catch-up' ? 'catch-up' : tone === 'empty' ? 'muted' : 'default'}
            className="mt-1"
          />

          <dl
            className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-soft-hairline/70 pt-5"
            aria-live="polite"
          >
            <StatPair label="Total cards" value={total === 0 ? '0' : String(total)} />
            <StatPair
              label="Est. time"
              value={total === 0 ? 'none' : timeLabel.replace('≈ ', '')}
            />
            <StatPair
              label="Decks included"
              value={
                deckCount === totalDeckCount
                  ? `${totalDeckCount}`
                  : `${deckCount} of ${totalDeckCount}`
              }
            />
            <StatPair
              label="Scope"
              value={modified ? 'Tuned' : 'Defaults'}
              valueTone={modified ? 'aizome' : 'default'}
            />
          </dl>

          {modified && (
            <p
              className={cn(
                'mt-5 flex items-baseline gap-2 border-t border-aizome-indigo/20 pt-4',
                'font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-aizome-indigo',
              )}
            >
              <span aria-hidden="true">·</span>
              <span>Tuning just for this session.</span>
            </p>
          )}

          <div className="mt-6 hidden lg:block">
            {actions}
          </div>
        </>
      )}
    </SectionCard>
  )
}

function StatPair({
  label,
  value,
  valueTone = 'default',
}: {
  label:     string
  value:     string
  valueTone?: 'default' | 'aizome'
}): React.JSX.Element {
  return (
    <div className="flex flex-col">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
        {label}
      </dt>
      <dd
        className={cn(
          'mt-1 font-display text-[1.25rem] leading-none tabular-nums',
          valueTone === 'aizome' ? 'text-aizome-indigo' : 'text-sumi-ink',
        )}
      >
        {value}
      </dd>
    </div>
  )
}

function SummarySkeleton(): React.JSX.Element {
  return (
    <div>
      <Skeleton className="h-7 w-full" />
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  )
}
