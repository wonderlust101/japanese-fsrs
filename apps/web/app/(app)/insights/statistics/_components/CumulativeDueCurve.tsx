import { smoothAreaPath, smoothLinePath, type Pt } from '../../_components/chartPaths'

import type { CumulativeDueDay } from './types'

interface CumulativeDueCurveProps {
  data: ReadonlyArray<CumulativeDueDay>
}

const VIEW_W     = 1200
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46

function shortMonth(iso: string): string {
  const m = Number(iso.slice(5, 7))
  return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1] ?? ''
}

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function niceTickStep(rough: number): number {
  if (rough <= 0) return 1
  const pow  = Math.pow(10, Math.floor(Math.log10(rough)))
  const norm = rough / pow
  let step: number
  if      (norm <= 1)   step = 1
  else if (norm <= 2)   step = 2
  else if (norm <= 2.5) step = 2.5
  else if (norm <= 5)   step = 5
  else                  step = 10
  return step * pow
}

function computeYAxis(max: number, targetTicks = 5): { yMax: number; ticks: number[] } {
  const step = niceTickStep(Math.max(1, max / targetTicks))
  const yMax = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= yMax + 0.0001; v += step) ticks.push(Math.round(v))
  return { yMax, ticks }
}

/**
 * Cumulative-due area chart. Shows how the total number of cards-due
 * accumulates over the next 90 days, drawn as a vermillion area below
 * a smooth curve. The slope reveals scheduling density: steep ramps
 * mean heavy upcoming weeks; gentle ones mean a manageable horizon.
 */
export function CumulativeDueCurve({
  data,
}: CumulativeDueCurveProps): React.JSX.Element | null {
  if (data.length < 2) return null

  const max = data[data.length - 1]?.cumulative ?? 0
  if (max === 0) return null
  const { yMax, ticks: yTicks } = computeYAxis(max, 5)

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP  - PAD_BOTTOM

  const xFor = (i: number): number => PAD_LEFT + (i / Math.max(1, data.length - 1)) * innerW
  const yFor = (v: number): number => PAD_TOP  + (1 - v / yMax) * innerH

  const points: ReadonlyArray<Pt> = data.map((d, i) => [xFor(i), yFor(d.cumulative)] as Pt)
  const baseY     = PAD_TOP + innerH
  const linePath  = smoothLinePath(points)
  const areaPath  = smoothAreaPath(points, baseY) ?? ''

  // X axis tick positions
  const tickIndices: number[] = []
  for (let i = 0; i < 5; i += 1) {
    tickIndices.push(Math.round((data.length - 1) * (i / 4)))
  }

  return (
    <figure className="flex flex-col gap-y-3">
      <svg
        role="img"
        aria-label={`Cumulative due cards over the next ${data.length} days. Ending at ${max} cards.`}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Y gridlines + labels */}
        {yTicks.map((tick, idx) => {
          const y = yFor(tick)
          return (
            <g key={idx}>
              <line
                x1={PAD_LEFT}
                x2={VIEW_W - PAD_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--color-soft-hairline)"
                strokeOpacity={idx === 0 ? 1 : 0.7}
                strokeWidth={1}
              />
              <text
                x={PAD_LEFT - 10}
                y={y + 4}
                textAnchor="end"
                fontSize={13}
                fontFamily="ui-monospace, monospace"
                fill="var(--color-faded-sumi)"
              >
                {Math.round(tick)}
              </text>
            </g>
          )
        })}

        {/* Gradient area fill */}
        <defs>
          <linearGradient id="cumulative-due-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--color-inari-vermillion)"      stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-inari-vermillion-deep)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#cumulative-due-area)" />

        {/* Curve */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--color-inari-vermillion-deep)"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* X axis labels */}
        {tickIndices.map((i, idx) => {
          const d = data[i]
          if (d === undefined) return null
          return (
            <text
              key={`xt-${idx}`}
              x={xFor(i)}
              y={VIEW_H - PAD_BOTTOM + 20}
              textAnchor="middle"
              fontSize={12}
              fontFamily="ui-monospace, monospace"
              fill="var(--color-faded-sumi)"
            >
              {shortMonth(d.date)} {dayOfMonth(d.date)}
            </text>
          )
        })}
      </svg>

      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
        <span>
          Cumulative due <span className="text-sumi-ink/70">·</span> next {data.length} days
        </span>
        <span className="text-sumi-ink/85">
          Ends at <span className="text-inari-vermillion-deep">{max}</span> cards
        </span>
      </figcaption>
    </figure>
  )
}
