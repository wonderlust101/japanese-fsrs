'use client'

import { useMemo, useState } from 'react'

import type { ApiForecastDay } from '@fsrs-japanese/shared-types'

import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

import {
  smoothAreaPath,
  smoothLinePath,
  type Pt,
} from '../../_components/chartPaths'

interface NewCardImpactCardProps {
  forecast: ReadonlyArray<ApiForecastDay>
}

const SLIDER_MIN  = 0
const SLIDER_MAX  = 20
const SLIDER_STEP = 1
const PACE_HARD_MAX = 999 // Number input only — keeps a sane upper guard.

/**
 * Multiplier used to estimate the review-load consequences of changing the
 * new-card pace. Each new card generates roughly this many extra reviews
 * across the following seven days (rough FSRS-typical schedule: day 1, 3,
 * 7 plus a couple of relearns on average). Honest estimate, not precise.
 */
const REVIEWS_PER_NEW_OVER_7D = 2.4

// Chart geometry — matches the other Insights charts' canonical scale.
const VIEW_W     = 1200
const VIEW_H     = 240
const PAD_LEFT   = 54
const PAD_RIGHT  = 14
const PAD_TOP    = 32
const PAD_BOTTOM = 46
const DAYS       = 7

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`)
}

function isoFromDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return isoFromDate(d)
}

function dayLetter(iso: string): string {
  const dow = (parseIso(iso).getUTCDay() + 6) % 7
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S'][dow] as string
}

function dayOfMonth(iso: string): string {
  return iso.slice(8, 10).replace(/^0/, '')
}

function niceCeil(n: number): number {
  if (n <= 5)   return 5
  if (n <= 10)  return 10
  if (n <= 25)  return 25
  if (n <= 50)  return 50
  if (n <= 100) return 100
  if (n <= 200) return 200
  if (n <= 500) return 500
  return Math.ceil(n / 250) * 250
}

interface DayPoint {
  date:      string
  letter:    string
  baseline:  number
  projected: number
}

/**
 * Interactive new-card pace explorer. A slider lets the learner explore
 * what changing their new-card rate would do to the next seven days of
 * review load. The chart renders two curves: the baseline daily review
 * counts (sumi line, filled below in soft sumi-wash) and the projected
 * daily counts at the chosen pace (vermillion-deep line, with a vermillion
 * "delta band" between baseline and projected showing the added load).
 * Math is a client-side estimate, labeled as such.
 */
export function NewCardImpactCard({
  forecast,
}: NewCardImpactCardProps): React.JSX.Element {
  const ordered = useMemo(
    () => [...forecast].sort((a, b) => (a.date < b.date ? -1 : 1)),
    [forecast],
  )

  const startIso = ordered[0]?.date ?? isoFromDate(new Date())
  const byDate   = useMemo(
    () => new Map(ordered.map((d) => [d.date, d])),
    [ordered],
  )

  const baselineDaily = useMemo(() => {
    const out: { date: string; letter: string; count: number; newCount: number }[] = []
    for (let i = 0; i < DAYS; i += 1) {
      const date = addDays(startIso, i)
      const d    = byDate.get(date)
      out.push({
        date,
        letter:   dayLetter(date),
        count:    d?.count    ?? 0,
        newCount: d?.newCount ?? 0,
      })
    }
    return out
  }, [startIso, byDate])

  const currentPace = useMemo(() => {
    const total = baselineDaily.reduce((acc, d) => acc + d.newCount, 0)
    return Math.round(total / Math.max(1, baselineDaily.length))
  }, [baselineDaily])

  // Pace can exceed the slider's visible range; the slider thumb just pegs
  // at SLIDER_MAX when the typed value is higher. Initial value tracks the
  // user's current pace, even if that's above 20.
  const [paceValue, setPaceValue] = useState<number>(
    Math.max(SLIDER_MIN, Math.min(PACE_HARD_MAX, currentPace)),
  )

  const handlePaceTyped = (raw: string): void => {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      setPaceValue(0)
      return
    }
    setPaceValue(Math.max(SLIDER_MIN, Math.min(PACE_HARD_MAX, parsed)))
  }

  // Slider thumb position (clamped to its visible range).
  const sliderPosition = Math.min(paceValue, SLIDER_MAX)
  const paceOverSliderMax = paceValue > SLIDER_MAX

  // Projected per-day load. The added new-card pace generates roughly
  // (REVIEWS_PER_NEW_OVER_7D - 1) extra reviews across the following six
  // days, distributed forward with a light linear growth so the curve
  // diverges as new cards accumulate.
  const dayPoints = useMemo<DayPoint[]>(() => {
    const delta = paceValue - currentPace
    const extraDownstream = delta * (REVIEWS_PER_NEW_OVER_7D - 1) // reviews from past new cards
    return baselineDaily.map((d, i) => {
      // Today's new cards register as +delta; their downstream impact ramps
      // up linearly across the rest of the week.
      const todayNew     = delta
      const downstreamI  = extraDownstream * (i / Math.max(1, DAYS - 1))
      const projected    = Math.max(0, d.count + todayNew + downstreamI)
      return {
        date:      d.date,
        letter:    d.letter,
        baseline:  d.count,
        projected,
      }
    })
  }, [baselineDaily, currentPace, paceValue])

  const baselineWeek  = baselineDaily.reduce((acc, d) => acc + d.count, 0)
  const projectedWeek = Math.round(dayPoints.reduce((acc, d) => acc + d.projected, 0))
  const delta = projectedWeek - baselineWeek
  const deltaLabel =
    delta === 0
      ? 'No change to next week.'
      : delta > 0
        ? `≈ ${delta} more reviews next week.`
        : `≈ ${Math.abs(delta)} fewer reviews next week.`

  // Y range — anchored to the larger of the two curves.
  const dataMax = Math.max(0, ...dayPoints.map((d) => Math.max(d.baseline, d.projected)))
  const yMax   = niceCeil(Math.max(5, dataMax))
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax]

  const innerW = VIEW_W - PAD_LEFT - PAD_RIGHT
  const innerH = VIEW_H - PAD_TOP  - PAD_BOTTOM

  const xFor = (i: number): number =>
    PAD_LEFT + (i / Math.max(1, dayPoints.length - 1)) * innerW
  const yFor = (v: number): number =>
    PAD_TOP + (1 - v / yMax) * innerH

  // Smooth Catmull-Rom curves through both series.
  const projPoints: Pt[] = dayPoints.map((d, i) => [xFor(i), yFor(d.projected)] as Pt)
  const basePoints: Pt[] = dayPoints.map((d, i) => [xFor(i), yFor(d.baseline)]  as Pt)

  const baselinePath  = smoothLinePath(basePoints)
  const projectedPath = smoothLinePath(projPoints)

  const baseY = PAD_TOP + innerH
  const baselineArea = smoothAreaPath(basePoints, baseY) ?? ''

  // Delta area: top is the smooth projected curve; bottom is the smooth
  // baseline curve traced in reverse. Replace the reversed run's leading
  // `M` with `L` so the cursor flows continuously from the end of the top
  // curve into the start of the bottom curve.
  const deltaArea = ((): string => {
    if (projPoints.length < 2) return ''
    const reversedBase = [...basePoints].reverse()
    const bottomLine   = smoothLinePath(reversedBase).replace(/^M/, 'L')
    return `${projectedPath} ${bottomLine} Z`
  })()

  return (
    <SectionCard
      kanji="増"
      label="New-card impact"
      description="A rough estimate of how changing your new-card pace would shift the next seven days."
    >
      <div className="pb-1 lg:py-2 xl:py-3">
        <svg
          role="img"
          aria-label={
            `Two-curve chart comparing baseline daily review load against the projected load at ${paceValue} new cards per day. Projected total over 7 days: ${projectedWeek} reviews.`
          }
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="block h-auto w-full"
        >
          {/* Y gridlines + axis labels */}
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

          {/* Delta band (only visible when projected > baseline) */}
          {delta > 0 && (
            <path
              d={deltaArea}
              fill="var(--color-inari-vermillion)"
              opacity={0.22}
            />
          )}

          {/* Baseline area (sumi-wash) */}
          <path
            d={baselineArea}
            fill="var(--color-sumi-ink)"
            opacity={0.08}
          />

          {/* Baseline line (sumi) */}
          <path
            d={baselinePath}
            fill="none"
            stroke="var(--color-sumi-ink)"
            strokeOpacity={0.7}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Projected line (vermillion) */}
          <path
            d={projectedPath}
            fill="none"
            stroke="var(--color-inari-vermillion-deep)"
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Per-day projected dots so the eye can find individual values */}
          {dayPoints.map((d, i) => (
            <circle
              key={d.date}
              cx={xFor(i)}
              cy={yFor(d.projected)}
              r={3.2}
              fill="var(--color-inari-vermillion-deep)"
            />
          ))}

          {/* X axis labels */}
          {dayPoints.map((d, i) => {
            const showDate = (parseIso(d.date).getUTCDay() + 6) % 7 === 6
            return (
              <g key={`x-${d.date}`}>
                <text
                  x={xFor(i)}
                  y={VIEW_H - PAD_BOTTOM + 20}
                  textAnchor="middle"
                  fontSize={13}
                  fontFamily="ui-monospace, monospace"
                  fontWeight={i === 0 ? 600 : 400}
                  fill={i === 0 ? 'var(--color-inari-vermillion-deep)' : 'var(--color-faded-sumi)'}
                >
                  {d.letter}
                </text>
                {showDate && (
                  <text
                    x={xFor(i)}
                    y={VIEW_H - PAD_BOTTOM + 34}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontFamily="ui-monospace, monospace"
                    fill="var(--color-faded-sumi)"
                    opacity={0.7}
                  >
                    {dayOfMonth(d.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>

        <figcaption className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[0.8125rem] uppercase tracking-[0.14em] tabular-nums text-faded-sumi">
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <LegendLine color="var(--color-sumi-ink)" opacity={0.7} label={`At current · ${baselineWeek}`} />
            <LegendLine color="var(--color-inari-vermillion-deep)" label={`At chosen · ${projectedWeek}`} bold />
          </span>
          <span className="text-sumi-ink/85">7-day projection</span>
        </figcaption>

        {/* Pace control: editable number + slider for quick exploration. */}
        <div className="mt-7 flex flex-col gap-y-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <label
              htmlFor="newcard-pace-number"
              className="font-mono text-[0.8125rem] uppercase tracking-[0.18em] text-faded-sumi"
            >
              Set your pace
            </label>
            <label
              htmlFor="newcard-pace-number"
              className={cn(
                'inline-flex cursor-text items-baseline gap-x-2 rounded-[2px]',
                'border border-soft-hairline bg-cream-inset px-3.5 py-2',
                'transition-colors duration-150',
                'hover:border-faded-sumi/60',
                'focus-within:border-inari-vermillion focus-within:bg-vermillion-wash/40',
              )}
            >
              <input
                id="newcard-pace-number"
                type="number"
                inputMode="numeric"
                min={SLIDER_MIN}
                max={PACE_HARD_MAX}
                step={SLIDER_STEP}
                value={paceValue}
                onChange={(e) => handlePaceTyped(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="New cards per day"
                className={cn(
                  'w-[3.5ch] cursor-text bg-transparent text-right',
                  'font-mono text-[2rem] font-semibold leading-none tabular-nums text-inari-vermillion-deep',
                  'focus:outline-none',
                  '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                )}
              />
              <span className="font-mono text-[0.8125rem] uppercase tracking-[0.14em] text-faded-sumi">
                new / day
              </span>
            </label>
          </div>

          <input
            id="newcard-pace"
            type="range"
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={SLIDER_STEP}
            value={sliderPosition}
            onChange={(e) => setPaceValue(Number(e.target.value))}
            aria-label="New cards per day (slider, 0 to 20)"
            className={cn(
              'block w-full appearance-none bg-transparent',
              '[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-[2px] [&::-webkit-slider-runnable-track]:bg-soft-hairline',
              '[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-[2px] [&::-moz-range-track]:bg-soft-hairline',
              '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:-mt-[7px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-inari-vermillion-deep [&::-webkit-slider-thumb]:cursor-grab',
              '[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-inari-vermillion-deep [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-4',
            )}
          />

          <p className="text-[0.9375rem] leading-relaxed text-sumi-ink/90">
            <span className="font-mono text-[0.8125rem] uppercase tracking-[0.18em] text-faded-sumi">
              Current pace · {currentPace} new / day
              {paceOverSliderMax && (
                <span className="ml-2 text-inari-vermillion-deep">
                  · slider pegged at {SLIDER_MAX}
                </span>
              )}
            </span>
            <span className="block mt-1 italic text-sumi-ink/75">{deltaLabel}</span>
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Legend line (small horizontal stroke + label) ───────────────────────────

function LegendLine({
  color,
  opacity = 1,
  bold = false,
  label,
}: {
  color:    string
  opacity?: number
  bold?:    boolean
  label:    string
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-x-1.5">
      <span
        aria-hidden="true"
        className="inline-block h-[2px] w-4 rounded-[1px]"
        style={{ backgroundColor: color, opacity }}
      />
      <span className={bold ? 'font-medium text-inari-vermillion-deep' : undefined}>
        {label}
      </span>
    </span>
  )
}
