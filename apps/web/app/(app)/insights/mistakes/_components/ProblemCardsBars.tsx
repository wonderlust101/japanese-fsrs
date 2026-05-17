'use client'

import { useMemo, useState } from 'react'

import { MistakeRowList } from './MistakeRowList'
import { buildProblemCardsLine } from './mistakesInterpretation'
import type { MistakeCard, MistakesData } from './mistakesTypes'

interface ProblemCardsBarsProps {
  data: MistakesData
}

const VB_W = 1200
const VB_H = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46
const PLOT_W = VB_W - PAD_LEFT - PAD_RIGHT
const PLOT_H = VB_H - PAD_TOP - PAD_BOTTOM

/**
 * Per-bucket fill. Sumi-ink ramp from /35 to /75 across the first three
 * buckets, then a jump to full vermillion-deep on the open-ended "leech
 * zone" bucket. The leap from monochrome to vermillion is the visual
 * argument that this bucket is qualitatively different, not just
 * incrementally more.
 */
const BUCKET_FILLS = [
  'rgb(31 26 24 / 0.35)',
  'rgb(31 26 24 / 0.55)',
  'rgb(31 26 24 / 0.75)',
  'rgb(126 31 42)',
] as const

function niceCeil(max: number): number {
  if (max <= 4)  return 4
  if (max <= 10) return 10
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const norm = max / pow
  const step = norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * pow
}

/**
 * Stem-and-leaf bars for the Problem Cards section. Four buckets along
 * the x-axis; bar height encodes the number of cards in the bucket;
 * the leech-zone bucket paints in full vermillion to signal the
 * qualitative threshold.
 *
 * Clicking a bar expands an inline list of the cards in that bucket
 * below the chart, using the shared MistakeRowList primitive for the
 * row UI and bulk-select behavior. Clicking the same bar again
 * collapses the drill-in.
 */
export function ProblemCardsBars({ data }: ProblemCardsBarsProps): React.JSX.Element {
  const [openBucket, setOpenBucket] = useState<number | null>(null)

  const buckets = data.lapseBuckets
  const maxCount = useMemo(
    () => Math.max(1, ...buckets.map((b) => b.cardIds.length)),
    [buckets],
  )
  const yMax = niceCeil(maxCount)

  const yOf = (v: number): number => PAD_TOP + (1 - v / yMax) * PLOT_H

  const slotW = PLOT_W / buckets.length
  const barW  = Math.min(140, slotW * 0.55)

  const xOf = (i: number): number => PAD_LEFT + (i + 0.5) * slotW

  const yTicks = useMemo(() => {
    const step = yMax / 4
    return [0, step, step * 2, step * 3, yMax].map((v) => ({
      value: Math.round(v),
      y:     yOf(v),
    }))
  }, [yMax])

  const drillCards = useMemo<ReadonlyArray<MistakeCard>>(() => {
    if (openBucket === null) return []
    const ids = buckets[openBucket]?.cardIds ?? []
    const idSet = new Set(ids)
    return data.problemCards.filter((c) => idSet.has(c.id))
  }, [openBucket, buckets, data.problemCards])

  return (
    <div className="flex flex-col gap-y-5">
      <p className="max-w-prose text-sm italic leading-relaxed text-sumi-ink/85">
        {buildProblemCardsLine(data)}
      </p>

      <svg
        role="img"
        aria-label="Distribution of problem cards by lapse count"
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto w-full"
      >
        {/* Y gridlines */}
        {yTicks.map((t) => (
          <line
            key={`grid-${t.value}`}
            x1={PAD_LEFT}
            x2={VB_W - PAD_RIGHT}
            y1={t.y}
            y2={t.y}
            stroke="rgb(94 72 67 / 0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Bars */}
        {buckets.map((b, i) => {
          const count = b.cardIds.length
          const top   = yOf(count)
          const bottom = yOf(0)
          const x = xOf(i) - barW / 2
          const fill = BUCKET_FILLS[i] ?? BUCKET_FILLS[0]
          const isOpen = openBucket === i
          return (
            <g key={b.label}>
              <rect
                x={x}
                y={top}
                width={barW}
                height={Math.max(0, bottom - top)}
                fill={fill}
                onClick={() => count > 0 && setOpenBucket(isOpen ? null : i)}
                style={count > 0 ? { cursor: 'pointer' } : undefined}
                className={isOpen ? 'opacity-100' : 'transition-opacity duration-150 hover:opacity-90'}
              />
              {count > 0 && (
                <text
                  x={xOf(i)}
                  y={top - 8}
                  textAnchor="middle"
                  className="fill-sumi-ink font-mono"
                  fontSize="13"
                >
                  {count}
                </text>
              )}
              <text
                x={xOf(i)}
                y={VB_H - PAD_BOTTOM + 22}
                textAnchor="middle"
                className="fill-faded-sumi font-mono"
                fontSize="13"
              >
                {b.label} lapses
              </text>
              {i === buckets.length - 1 && (
                <text
                  x={xOf(i)}
                  y={VB_H - PAD_BOTTOM + 38}
                  textAnchor="middle"
                  className="fill-inari-vermillion-deep font-mono"
                  fontSize="10"
                >
                  leech zone
                </text>
              )}
            </g>
          )
        })}

        {/* Y axis labels */}
        {yTicks.map((t) => (
          <text
            key={`ylabel-${t.value}`}
            x={PAD_LEFT - 10}
            y={t.y + 4}
            textAnchor="end"
            className="fill-faded-sumi font-mono"
            fontSize="13"
          >
            {t.value}
          </text>
        ))}

        {/* Baseline */}
        <line
          x1={PAD_LEFT}
          x2={VB_W - PAD_RIGHT}
          y1={VB_H - PAD_BOTTOM}
          y2={VB_H - PAD_BOTTOM}
          stroke="rgb(94 72 67 / 0.25)"
          strokeWidth={1}
        />
      </svg>

      {/* Drill-in instruction (no rows expanded) */}
      {openBucket === null && data.problemCards.length > 0 && (
        <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
          Click a bar to see the cards in that bucket.
        </p>
      )}

      {/* Drill-in list */}
      {openBucket !== null && (
        <div className="flex flex-col gap-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[0.75rem] uppercase tracking-[0.14em] text-sumi-ink">
              <span className="tabular-nums">{drillCards.length}</span>{' '}
              {drillCards.length === 1 ? 'card' : 'cards'} with{' '}
              <span className="text-sumi-ink/85">{buckets[openBucket]?.label}</span> lapses
            </p>
            <button
              type="button"
              onClick={() => setOpenBucket(null)}
              className="font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-faded-sumi underline-offset-2 hover:text-sumi-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Close
            </button>
          </div>
          <MistakeRowList rows={drillCards} emptyText="No cards in this bucket." />
        </div>
      )}
    </div>
  )
}
