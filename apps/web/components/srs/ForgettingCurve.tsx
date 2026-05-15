'use client'


interface ForgettingCurveProps {
  className?: string
}

/**
 * Animated visualization of the FSRS forgetting curve.
 *
 * Mathematically: retrievability R follows R = 0.9 ^ (t / S) where S is
 * stability in days. The plotted curve is the actual exponential-decay
 * shape, not a stylized one — it IS the FSRS retention model rendered
 * as ambient identity.
 *
 * The component renders responsively: the SVG fills its container width via
 * `width="100%"` and preserves the viewBox aspect ratio (480 × 200 → 12:5).
 * Style the wrapper from the outside via `className`; the SVG inside fills
 * the wrapper.
 */
export function ForgettingCurve({
  className = '',
}: ForgettingCurveProps): React.JSX.Element {
  const _reducedMotion = false

  // Plot 30 days. R = 0.9 ^ (t / S) with S=10 (a typical mid-stability card).
  // Bake the curve as an SVG path; the live "breath" is opacity-only.
  const W = 480
  const H = 200
  const PADDING = { left: 40, right: 16, top: 12, bottom: 32 }

  const stability = 10
  const days = 30
  const points = Array.from({ length: days + 1 }, (_, t) => {
    const r = Math.pow(0.9, t / stability)
    const x = PADDING.left + (t / days) * (W - PADDING.left - PADDING.right)
    const y = PADDING.top  + (1 - r)     * (H - PADDING.top  - PADDING.bottom)
    return { x, y, r }
  })

  const pathD = points.reduce<string>((d, p, i) => {
    const prev = points[i - 1]
    if (prev === undefined) return `M ${p.x} ${p.y}`
    const cpx = (prev.x + p.x) / 2
    return `${d} C ${cpx} ${prev.y}, ${cpx} ${p.y}, ${p.x} ${p.y}`
  }, '')

  const lastPoint  = points[points.length - 1]
  const firstPoint = points[0]
  const fillPathD  = lastPoint !== undefined && firstPoint !== undefined
    ? `${pathD} L ${lastPoint.x} ${H - PADDING.bottom} L ${firstPoint.x} ${H - PADDING.bottom} Z`
    : pathD

  // Y-axis tick lines at 100% / 80% / 50% / 20%
  const yTicks = [
    { label: '100%', y: PADDING.top },
    { label: ' 80%', y: PADDING.top + (1 - 0.8) * (H - PADDING.top - PADDING.bottom) },
    { label: ' 50%', y: PADDING.top + (1 - 0.5) * (H - PADDING.top - PADDING.bottom) },
    { label: ' 20%', y: PADDING.top + (1 - 0.2) * (H - PADDING.top - PADDING.bottom) },
  ]

  return (
    <div className={className} style={{ aspectRatio: `${W} / ${H}` }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Memory curve: how recall fades over time without practice"      >
        {/* Y-axis tick lines */}
        {yTicks.map((t) => (
          <g key={t.label}>
            <line
              x1={PADDING.left}
              y1={t.y}
              x2={W - PADDING.right}
              y2={t.y}
              stroke="var(--color-soft-hairline)"
              strokeWidth="1"
              strokeDasharray="2 4"
            />
            <text
              x={PADDING.left - 8}
              y={t.y + 4}
              textAnchor="end"
              fontSize="10"
              fill="var(--color-faded-sumi)"
              fontFamily="var(--font-mono)"
            >
              {t.label}
            </text>
          </g>
        ))}

        {/* X-axis labels: 0d / 10d / 20d / 30d */}
        {[0, 10, 20, 30].map((d) => {
          const x = PADDING.left + (d / days) * (W - PADDING.left - PADDING.right)
          return (
            <text
              key={d}
              x={x}
              y={H - PADDING.bottom + 18}
              textAnchor="middle"
              fontSize="10"
              fill="var(--color-faded-sumi)"
              fontFamily="var(--font-mono)"
            >
              {d}d
            </text>
          )
        })}

        {/* Curve fill (vermillion at low alpha) */}
        <path d={fillPathD} fill="var(--color-inari-vermillion)" opacity="0.08" />

        {/* Curve stroke (vermillion at full saturation) */}
        <path
          d={pathD}
          stroke="var(--color-inari-vermillion)"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />

        {/* Endpoint dot */}
        {lastPoint !== undefined && (
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3"
            fill="var(--color-inari-vermillion)"
          />
        )}

        {/* Caption: retention vs days since review */}
        <text
          x={W - PADDING.right}
          y={PADDING.top + 12}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-faded-sumi)"
          fontFamily="var(--font-mono)"
          letterSpacing="0.04em"
        >
          RECALL × DAYS
        </text>
      </svg>
    </div>
  )
}
