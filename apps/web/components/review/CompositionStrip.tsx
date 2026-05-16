'use client'

import { cn } from '@/lib/utils'

// CompositionStrip: one horizontal bar split into three segments proportional
// to the session's queue mix (overdue / review / new), with a labeled
// tickmark under each segment. Reuses the chart palette established by
// week-rhythm-strip (--color-queue-*-mark), so the dashboard and setup share
// a single visual vocabulary.
//
// Reads in 100ms: longest segment = most cards, tickmarks confirm which is
// which. No proportional-height puzzle, no kanji decoding, no shape recognition.

export interface CompositionBreakdown {
  reviewCount:  number
  newCount:     number
  backlogCount: number
}

export type CompositionTone = 'default' | 'catch-up' | 'muted'

interface CompositionStripProps {
  breakdown:  CompositionBreakdown
  tone?:      CompositionTone
  className?: string
}

interface Segment {
  key:   'backlog' | 'review' | 'new'
  count: number
  label: string
  color: string
}

const MIN_SEGMENT_FLEX = 0.05  // smallest visible segment is 5% of strip
const STRIP_HEIGHT_PX  = 28

export function CompositionStrip({
  breakdown,
  tone = 'default',
  className,
}: CompositionStripProps): React.JSX.Element {
  const segments: ReadonlyArray<Segment> = [
    {
      key:   'backlog',
      count: breakdown.backlogCount,
      label: 'overdue',
      color: 'var(--color-queue-backlog-mark)',
    },
    {
      key:   'review',
      count: breakdown.reviewCount,
      label: 'review',
      color: 'var(--color-queue-review-mark)',
    },
    {
      key:   'new',
      count: breakdown.newCount,
      label: 'new',
      color: 'var(--color-queue-new-mark)',
    },
  ]

  const total      = segments.reduce((s, x) => s + x.count, 0)
  const isEmpty    = total === 0
  const isMuted    = tone === 'muted' || isEmpty
  const visible    = segments.filter((s) => s.count > 0)

  return (
    <div className={cn('w-full', className)} aria-label={describe(segments, total)} role="img">
      {/* Strip */}
      <div
        className="relative flex w-full overflow-hidden rounded-[2px] border border-soft-hairline bg-cream-inset"
        style={{ height: STRIP_HEIGHT_PX }}
      >
        {isEmpty ? (
          <div className="flex-1" />
        ) : (
          visible.map((seg) => {
            const flex = Math.max(MIN_SEGMENT_FLEX, seg.count / total)
            return (
              <div
                key={seg.key}
                className="h-full"
                style={{
                  flexGrow:        flex,
                  flexShrink:      1,
                  flexBasis:       0,
                  backgroundColor: isMuted ? 'var(--color-soft-hairline)' : seg.color,
                }}
              />
            )
          })
        )}
      </div>

      {/* Tickmark legend */}
      <div className="mt-3 grid grid-cols-3 gap-3">
        {segments.map((seg) => (
          <Tick key={seg.key} segment={seg} muted={isMuted} />
        ))}
      </div>
    </div>
  )
}

function Tick({
  segment,
  muted,
}: {
  segment: Segment
  muted:   boolean
}): React.JSX.Element {
  return (
    <div className="flex items-start gap-2">
      <span
        aria-hidden="true"
        className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: muted ? 'var(--color-soft-hairline)' : segment.color }}
      />
      <div className="min-w-0">
        <div className="font-display text-[1.125rem] tabular-nums leading-none text-sumi-ink">
          {segment.count}
        </div>
        <div className="mt-1 font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
          {segment.label}
        </div>
      </div>
    </div>
  )
}

function describe(segments: ReadonlyArray<Segment>, total: number): string {
  if (total === 0) return 'No cards scheduled today.'
  const parts = segments.filter((s) => s.count > 0).map((s) => `${s.count} ${s.label}`)
  return `Session of ${total} cards: ${parts.join(', ')}.`
}
