import { cn } from '@/lib/utils'

interface RetentionComparisonProps {
  desired: number  // 0-1
  actual:  number  // 0-1
}

// Points of gap mapped to the full half-width of the diverging track. A gap
// beyond this clamps to the edge; ±15 points is already a large miss.
const MAX_GAP_PTS = 15

/**
 * Gap-to-target readout. Where the dial answers "what are my retention
 * numbers" (absolute), this answers "am I above or below my target, and by
 * how much" (the signed delta). A diverging bar grows right when actual beats
 * target (calm green) and left when it trails (vermillion), from a center tick
 * that marks the target itself.
 */
export function RetentionComparison({
  desired,
  actual,
}: RetentionComparisonProps): React.JSX.Element {
  const desiredPct = Math.round(desired * 100)
  const actualPct  = Math.round(actual  * 100)
  const delta      = actualPct - desiredPct
  const onTarget   = Math.abs(delta) <= 2
  const above      = delta > 0

  const frac = Math.min(1, Math.abs(delta) / MAX_GAP_PTS)
  const verdictColor = onTarget
    ? 'text-sumi-ink'
    : above
      ? 'text-jlpt-n5-fresh-leaf'
      : 'text-inari-vermillion-deep'
  const barColor = onTarget
    ? 'var(--color-faded-sumi)'
    : above
      ? 'var(--color-jlpt-n5-fresh-leaf)'
      : 'var(--color-inari-vermillion-deep)'

  return (
    <figure className="flex flex-col gap-y-4">
      <div className="flex flex-col gap-y-1">
        <p className="font-mono text-sm text-faded-sumi">Gap to target</p>
        <p className={cn('font-display text-[2.5rem] font-medium leading-none tabular-nums', verdictColor)}>
          {onTarget ? 'On target' : `${above ? '+' : '−'}${Math.abs(delta)} pts`}
        </p>
        <p className="font-mono text-sm tabular-nums text-faded-sumi">
          target {desiredPct}% <span className="text-sumi-ink/40">·</span> actual {actualPct}%
        </p>
      </div>

      {/* Diverging track: center tick = target, bar grows toward the gap. */}
      <div className="flex flex-col gap-y-2">
        <div className="relative h-[10px] w-full rounded-xs bg-soft-hairline/40">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-sumi-ink/45"
          />
          <span
            aria-hidden="true"
            className="absolute inset-y-0 block rounded-xs"
            style={{
              backgroundColor: barColor,
              left:  above ? '50%' : `${50 - frac * 50}%`,
              width: `${frac * 50}%`,
            }}
          />
        </div>
        {/* Axis labels: which direction means what, and where the target sits. */}
        <div
          aria-hidden="true"
          className="grid grid-cols-3 font-mono text-sm uppercase tracking-[0.08em]"
        >
          <span className="flex items-center gap-x-2 justify-self-start text-inari-vermillion-deep">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-inari-vermillion-deep" />
            below target
          </span>
          <span className="justify-self-center text-sumi-ink/70">target</span>
          <span className="flex items-center gap-x-2 justify-self-end text-jlpt-n5-fresh-leaf">
            above target
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-jlpt-n5-fresh-leaf" />
          </span>
        </div>
      </div>

      <p className={cn('font-mono text-sm leading-relaxed', verdictColor)}>
        {onTarget
          ? 'Close enough to your target that FSRS counts it as on track. Nothing to adjust.'
          : above
            ? 'Your recall is running ahead of target, so FSRS is scheduling conservatively. Intervals could safely stretch.'
            : 'Your recall is trailing target, so cards are slipping a little sooner than FSRS planned for.'}
      </p>
    </figure>
  )
}
