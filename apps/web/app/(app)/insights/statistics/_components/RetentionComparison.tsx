import { cn } from '@/lib/utils'

interface RetentionComparisonProps {
  desired: number  // 0-1
  actual:  number  // 0-1
}

/**
 * Paired-bar comparison of desired retention against actual (true)
 * retention, with the delta as a quiet caption. Visualizes how close
 * the user's actual recall sits to their FSRS target.
 */
export function RetentionComparison({
  desired,
  actual,
}: RetentionComparisonProps): React.JSX.Element {
  const desiredPct = Math.round(desired * 100)
  const actualPct  = Math.round(actual  * 100)
  const deltaPts   = actualPct - desiredPct
  const onTarget   = Math.abs(deltaPts) <= 2

  // Scale bars relative to 100% with a small floor (so very low values still show)
  const desiredWidth = Math.max(2, desiredPct)
  const actualWidth  = Math.max(2, actualPct)

  return (
    <figure className="flex flex-col gap-y-5">
      <div className="flex flex-col gap-y-4">
        <Row
          label="Target"
          value={`${desiredPct}%`}
          pct={desiredWidth}
          color="var(--color-inari-vermillion-deep)"
          opacity={1}
        />
        <Row
          label="Actual"
          value={`${actualPct}%`}
          pct={actualWidth}
          color="var(--color-sumi-ink)"
          opacity={0.85}
        />
      </div>

      <p
        className={cn(
          'font-mono text-[0.8125rem] uppercase tracking-[0.14em]',
          onTarget
            ? 'text-sumi-ink/85'
            : deltaPts > 0
              ? 'text-jlpt-n5-fresh-leaf'
              : 'text-inari-vermillion-deep',
        )}
      >
        {onTarget
          ? 'On target.'
          : deltaPts > 0
            ? `Above target by ${deltaPts} points. Schedule is conservative.`
            : `Below target by ${Math.abs(deltaPts)} points. Cards are slipping faster than FSRS predicted.`}
      </p>
    </figure>
  )
}

function Row({
  label,
  value,
  pct,
  color,
  opacity,
}: {
  label:   string
  value:   string
  pct:     number
  color:   string
  opacity: number
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-y-1.5">
      <div className="flex items-baseline justify-between gap-x-3">
        <span className="font-mono text-[0.75rem] uppercase tracking-[0.18em] text-faded-sumi">
          {label}
        </span>
        <span className="font-mono text-[1rem] font-medium tabular-nums text-sumi-ink">
          {value}
        </span>
      </div>
      <div className="relative h-[8px] w-full overflow-hidden rounded-[2px] bg-soft-hairline/40">
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 block h-full motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out"
          style={{ width: `${pct}%`, backgroundColor: color, opacity }}
        />
      </div>
    </div>
  )
}
