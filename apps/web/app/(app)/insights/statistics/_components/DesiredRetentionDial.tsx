import { AxisText, DATA_INK } from '@/components/charts'

interface DesiredRetentionDialProps {
  desired: number  // 0-1
  actual:  number  // 0-1
}

const SIZE   = 220       // viewBox dimensions
const RADIUS = 76
const CENTER = SIZE / 2

/**
 * Circular gauge for the user's desired retention target, overlaid with
 * their true retention as a smaller inner arc. A clear 270-degree arc
 * starts from the bottom-left and sweeps to the bottom-right, leaving
 * a 90-degree gap at the bottom for the label.
 */
export function DesiredRetentionDial({
  desired,
  actual,
}: DesiredRetentionDialProps): React.JSX.Element {
  // Arc spans 270 degrees, from 135° (bottom-left) clockwise to 45° (bottom-right).
  // We use standard math: 0° = right, 90° = top.
  // Map 0 → start (225° in screen-space = 135° from positive x, going clockwise from top)
  // Simpler: think in terms of "fraction of arc traveled".
  const startAngleDeg = 135  // svg-coordinate space, where 0 is right and clockwise is positive
  const endAngleDeg   = 45 + 360  // wraps past 360 to maintain clockwise sweep
  const sweepDeg      = endAngleDeg - startAngleDeg  // 270

  const desiredPct = Math.max(0, Math.min(1, desired))
  const actualPct  = Math.max(0, Math.min(1, actual))

  function polar(angleDeg: number, r: number): [number, number] {
    const rad = (angleDeg * Math.PI) / 180
    return [CENTER + r * Math.cos(rad), CENTER + r * Math.sin(rad)]
  }

  function arcPath(fromPct: number, toPct: number, r: number): string {
    const a0 = startAngleDeg + sweepDeg * fromPct
    const a1 = startAngleDeg + sweepDeg * toPct
    const [x0, y0] = polar(a0, r)
    const [x1, y1] = polar(a1, r)
    const largeArc = a1 - a0 > 180 ? 1 : 0
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${largeArc} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }

  const trackOuter = arcPath(0, 1, RADIUS)
  const desiredArc = arcPath(0, desiredPct, RADIUS)
  const actualArc  = arcPath(0, actualPct, RADIUS - 14)

  return (
    <figure className="flex flex-col items-center gap-y-4">
      <svg
        role="img"
        aria-label={`Desired retention ${Math.round(desiredPct * 100)}%, actual retention ${Math.round(actualPct * 100)}%.`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full max-w-[280px]"
      >
        {/* Outer track */}
        <path
          d={trackOuter}
          fill="none"
          stroke="var(--color-soft-hairline)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Inner track */}
        <path
          d={arcPath(0, 1, RADIUS - 14)}
          fill="none"
          stroke="var(--color-soft-hairline)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Desired arc (vermillion-deep) */}
        <path
          d={desiredArc}
          fill="none"
          stroke="var(--color-inari-vermillion-deep)"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Actual arc (sumi-ink) */}
        <path
          d={actualArc}
          fill="none"
          stroke="var(--color-sumi-ink)"
          strokeWidth={6}
          strokeOpacity={0.85}
          strokeLinecap="round"
        />
        {/* Center label */}
        <AxisText x={CENTER} y={CENTER - 6} size={36} weight={600} fill={DATA_INK}>
          {Math.round(desiredPct * 100)}%
        </AxisText>
        <AxisText x={CENTER} y={CENTER + 16} size={11} letterSpacing="0.16em">
          DESIRED
        </AxisText>
      </svg>
      <figcaption className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-sm tabular-nums text-faded-sumi">
        <span className="flex items-center gap-x-2">
          <span
            aria-hidden="true"
            className="inline-block h-[2px] w-4 rounded-[1px] bg-inari-vermillion-deep"
          />
          <span>
            Target <span className="text-sumi-ink">{Math.round(desiredPct * 100)}%</span>
          </span>
        </span>
        <span className="flex items-center gap-x-2">
          <span
            aria-hidden="true"
            className="inline-block h-[2px] w-4 rounded-[1px] bg-sumi-ink opacity-85"
          />
          <span>
            Actual <span className="text-sumi-ink">{Math.round(actualPct * 100)}%</span>
          </span>
        </span>
      </figcaption>
    </figure>
  )
}
