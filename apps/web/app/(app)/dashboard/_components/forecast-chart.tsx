'use client'

import { motion, useReducedMotion } from 'motion/react'

import {
  formatCompactCount,
  formatExactCount,
  safeNonNegativeInteger,
} from './dashboard-format'
import { DASHBOARD_EASE } from './dashboard-motion'
import {
  CardHeader,
  CHART_MODULE_CHROME,
  ConnectionErrorNotice,
  EmptyState,
  type ModuleState,
  SkeletonBlock,
  UnavailableState,
} from './section-primitives'

interface ForecastDay {
  /** Three-letter day label (Sun, Mon, Tue, ...). */
  label:   string
  /** Calendar date number (1-31), shown below the day glyph for context. */
  dateNum: number
  /** Total cards represented in this column. */
  count:   number
  isToday: boolean
  /** Older due reviews represented in this forecast column. */
  backlogCount?: number
  /** Reviews due on this calendar day. */
  reviewCount?:  number
  /** New cards represented in this forecast column. */
  newCount?:     number
}

interface ForecastChartProps {
  state: ModuleState
  /**
   * Up to 14 days starting from today. Mobile + tablet (< lg) renders the
   * first 7; desktop (lg+) renders all 14. Pass at least 7.
   */
  days?: ForecastDay[]
}

const CHART_HEIGHT = 168

type ForecastSegmentKey = 'backlog' | 'review' | 'new'

type ForecastSegment = {
  key:   ForecastSegmentKey
  label: string
  color: string
}

const FORECAST_SEGMENT_BY_KEY = {
  backlog: { key: 'backlog', label: 'Overdue reviews', color: 'var(--color-queue-backlog-mark)' },
  review:  { key: 'review',  label: 'Due reviews',     color: 'var(--color-queue-review-mark)' },
  new:     { key: 'new',     label: 'New cards',       color: 'var(--color-queue-new-mark)' },
} satisfies Record<ForecastSegmentKey, ForecastSegment>

const FORECAST_SEGMENTS: ForecastSegment[] = [
  FORECAST_SEGMENT_BY_KEY.backlog,
  FORECAST_SEGMENT_BY_KEY.review,
  FORECAST_SEGMENT_BY_KEY.new,
]
const FORECAST_LEGEND_SEGMENTS: ForecastSegment[] = [
  FORECAST_SEGMENT_BY_KEY.new,
  FORECAST_SEGMENT_BY_KEY.review,
  FORECAST_SEGMENT_BY_KEY.backlog,
]
const FORECAST_DESCRIPTION = 'Due reviews and available new cards for the next stretch.'

export function ForecastChart({ state, days = [] }: ForecastChartProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="forecast-label" aria-busy="true" className={CHART_MODULE_CHROME}>
        <CardHeader
          id="forecast-label"
          kanji="予測"
          label="Review forecast"
          variant="chart"
          description={FORECAST_DESCRIPTION}
          rightContent={<SkeletonBlock width={88} height={12} />}
        />
        <ForecastSkeletonChart />
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="forecast-label" className={CHART_MODULE_CHROME}>
        <CardHeader
          id="forecast-label"
          kanji="予測"
          label="Review forecast"
          variant="chart"
          description={FORECAST_DESCRIPTION}
        />
        <div className="min-h-[15rem] pt-3 pb-8">
          <ConnectionErrorNotice sectionName="The forecast" />
        </div>
      </section>
    )
  }

  if (state === 'unavailable') {
    return (
      <section aria-labelledby="forecast-label" className={CHART_MODULE_CHROME}>
        <CardHeader
          id="forecast-label"
          kanji="予測"
          label="Review forecast"
          variant="chart"
          description={FORECAST_DESCRIPTION}
        />
        <UnavailableState
          title="Forecast data is not connected yet"
          body="Reviews still work. Once forecast data is available, this chart will show the next stretch of due reviews and new cards."
          action={{ href: '/review', label: "Review today's stack" }}
          className="pt-3 pb-8"
        />
      </section>
    )
  }

  const days14 = days.slice(0, 14).map(normalizeForecastDay)
  const days7  = days14.slice(0, 7)
  const { total, peakDay } = summarizeForecastDays(days14)
  const isEmpty = days14.length === 0 || total === 0

  return (
    <section aria-labelledby="forecast-label" className={CHART_MODULE_CHROME}>
      <CardHeader
        id="forecast-label"
        kanji="予測"
        label="Review forecast"
        variant="chart"
        description={FORECAST_DESCRIPTION}
        rightContent={!isEmpty ? <ForecastFacts total={total} peakDay={peakDay} /> : undefined}
      />

      {!isEmpty && (
        <>
          <ForecastLegend />
          <div className="mb-5">
            <ForecastWindowNote dayCount={days7.length} className="lg:hidden" />
            <ForecastWindowNote dayCount={days14.length} className="hidden lg:block" />
          </div>
        </>
      )}

      {/* Mobile / tablet: 7 days */}
      <div className="lg:hidden">
        {isEmpty ? <ForecastEmptyChart /> : <BarChart days={days7} />}
      </div>

      {/* Desktop: 14 days */}
      <div className="hidden lg:block">
        {isEmpty ? <ForecastEmptyChart /> : <BarChart days={days14} />}
      </div>
    </section>
  )
}

function ForecastFacts({
  total,
  peakDay,
}: {
  total:   number
  peakDay: ForecastDay | null
}): React.JSX.Element {
  return (
    <dl className="flex flex-wrap gap-2 sm:justify-end">
      <ForecastFact label="total" value={formatExactCount(total)} />
      {peakDay !== null && peakDay.count > 0 && (
        <ForecastFact label="busiest" value={`${peakDay.label} ${formatCompactCount(peakDay.count)}`} />
      )}
    </dl>
  )
}

function ForecastFact({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-[5.75rem] rounded-[2px] border border-soft-hairline bg-cream-inset/45 px-2.5 py-1.5">
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-faded-sumi">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-sm tabular-nums text-sumi-ink">
        {value}
      </dd>
    </div>
  )
}

function ForecastLegend(): React.JSX.Element {
  return (
    <ul className="mb-2.5 flex flex-wrap gap-x-4 gap-y-2" aria-label="Forecast categories">
      {FORECAST_LEGEND_SEGMENTS.map((segment) => (
        <li
          key={segment.key}
          className="inline-flex items-center gap-1.5 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-faded-sumi"
        >
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-[1px] border border-sumi-ink/10"
            style={{ backgroundColor: segment.color }}
          />
          {segment.label}
        </li>
      ))}
    </ul>
  )
}

function ForecastWindowNote({
  dayCount,
  className = '',
}: {
  dayCount:  number
  className?: string
}): React.JSX.Element {
  const trailingDays = Math.max(0, dayCount - 1)
  const windowText = trailingDays === 0
    ? 'Today only'
    : `Today + next ${trailingDays} ${trailingDays === 1 ? 'day' : 'days'}`

  return (
    <p className={`font-mono text-[0.625rem] uppercase tracking-[0.1em] text-faded-sumi/80 ${className}`}>
      {windowText}. Future days fade by distance.
    </p>
  )
}

function ForecastSkeletonChart(): React.JSX.Element {
  return (
    <div className="pt-1 pb-5">
      <div className="mb-5 flex flex-wrap gap-x-4 gap-y-2">
        <SkeletonBlock width={96} height={11} />
        <SkeletonBlock width={88} height={11} />
        <SkeletonBlock width={108} height={11} />
      </div>
      <div className="flex items-end gap-1.5 lg:gap-2" style={{ height: `${CHART_HEIGHT}px` }}>
        {[46, 72, 34, 88, 58, 26, 64, 42, 20, 52, 78, 36, 22, 48].map((height, i) => (
          <div key={i} className="flex-1 flex items-end justify-center">
            <SkeletonBlock width="72%" height={height} className="rounded-t-[1px]" />
          </div>
        ))}
      </div>
      <hr aria-hidden="true" className="mt-0 border-0 border-t border-soft-hairline" />
      <div className="mt-3 grid grid-cols-7 gap-1.5 lg:grid-cols-14 lg:gap-2">
        {[...Array(14)].map((_, i) => (
          <SkeletonBlock key={i} width="100%" height={12} />
        ))}
      </div>
    </div>
  )
}

function ForecastEmptyChart(): React.JSX.Element {
  return (
    <EmptyState
      title="The next stretch is open"
      body="Add a deck or study ahead and this route will fill with the next two weeks of cards."
      action={{ href: '/decks/browse', label: 'Browse decks' }}
      visual="forecast"
      className="pt-3 pb-8"
    />
  )
}

// ── Vertical-bar chart ───────────────────────────────────────────────────────

/**
 * Future bars fade by temporal distance. Today stays solid because it is the
 * actionable route.
 */
function opacityForDay(i: number, isToday: boolean): number {
  if (isToday)    return 1
  if (i <= 3)     return 0.80
  if (i <= 7)     return 0.65
  return 0.50  // days 8-13
}

function BarChart({ days }: { days: ForecastDay[] }): React.JSX.Element {
  if (days.length === 0) {
    return <ForecastEmptyChart />
  }

  const peak     = peakCountForDays(days)
  const scaleMax = roundUpToNice(peak)

  return (
    <div>
      {/* Bar columns */}
      <ol
        className="flex items-end gap-1 sm:gap-1.5 lg:gap-2"
        style={{ height: `${CHART_HEIGHT}px` }}
        aria-label={`Review forecast: ${days.length} days`}
      >
        {days.map((d, i) => (
          <BarColumn
            key={i}
            day={d}
            dayIndex={i}
            scaleMax={scaleMax}
          />
        ))}
      </ol>

      {/* Baseline */}
      <hr aria-hidden="true" className="border-0 border-t border-soft-hairline" />

      {/* Day labels + calendar date numbers (stacked) */}
      <ol aria-hidden="true" className="mt-3 flex items-start gap-1 sm:gap-1.5 lg:gap-2">
        {days.map((d, i) => (
          <li
            key={i}
            className={[
              'flex-1 text-center',
              d.isToday ? 'text-sumi-ink font-semibold' : 'text-faded-sumi/60',
            ].join(' ')}
          >
            <div className="font-mono uppercase tracking-[0.06em] tabular-nums text-[0.6875rem]">
              {d.label}
            </div>
            <div className="font-mono tabular-nums text-[0.625rem] mt-0.5 text-faded-sumi/60">
              {d.isToday ? <span className="text-sumi-ink">{d.dateNum}</span> : d.dateNum}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

interface BarColumnProps {
  day:      ForecastDay
  dayIndex: number
  scaleMax: number
}

function BarColumn({ day, dayIndex, scaleMax }: BarColumnProps): React.JSX.Element {
  const ratio   = scaleMax > 0 ? day.count / scaleMax : 0
  // Bars with count > 0 always render at least 2px so they're visible; bars
  // with count === 0 render as a 1px placeholder line at the baseline.
  const barHeight = day.count === 0
    ? 1
    : Math.max(2, Math.round(ratio * (CHART_HEIGHT - 24)))  // -24 to leave room for label
  const opacity = opacityForDay(dayIndex, day.isToday)

  return (
    <li
      className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
      aria-label={forecastDayAriaLabel(day)}
    >
      {/* Count label above the bar */}
      <span
        className={[
          'mb-1 max-w-full truncate font-mono tabular-nums leading-none',
          day.isToday
            ? 'text-[0.6875rem] font-semibold text-sumi-ink'
            : 'text-[0.625rem] text-faded-sumi/60',
        ].join(' ')}
      >
        {formatCompactCount(day.count)}
      </span>

      <StackedForecastBar day={day} dayIndex={dayIndex} height={barHeight} opacity={opacity} />
    </li>
  )
}

function StackedForecastBar({
  day,
  dayIndex,
  height,
  opacity,
}: {
  day:      ForecastDay
  dayIndex: number
  height:   number
  opacity:  number
}): React.JSX.Element {
  const reducedMotion = useReducedMotion()
  const values = segmentValuesForDay(day)
  const visibleSegments = FORECAST_SEGMENTS
    .map((segment) => ({ ...segment, value: values[segment.key] }))
    .filter((segment) => segment.value > 0)
  const animationKey = `${day.label}-${day.dateNum}-${day.count}-${values.backlog}-${values.review}-${values.new}`
  const transition = {
    duration: reducedMotion === true ? 0 : 0.24,
    ease:     DASHBOARD_EASE,
    delay:    reducedMotion === true ? 0 : Math.min(dayIndex * 0.018, 0.14),
  }

  if (day.count === 0 || visibleSegments.length === 0) {
    return (
      <motion.span
        key={`empty-${animationKey}`}
        aria-hidden="true"
        className="w-full max-w-[28px] origin-bottom rounded-t-[1px] bg-soft-hairline sm:max-w-[40px] lg:max-w-[52px]"
        initial={reducedMotion === true ? false : { opacity: 0, scaleY: 0.45 }}
        animate={{ opacity, scaleY: 1 }}
        transition={transition}
        style={{ height: `${height}px` }}
      />
    )
  }

  return (
    <motion.span
      key={animationKey}
      aria-hidden="true"
      className="flex w-full max-w-[28px] origin-bottom flex-col-reverse overflow-hidden rounded-t-[1px] bg-soft-hairline sm:max-w-[40px] lg:max-w-[52px]"
      initial={reducedMotion === true ? false : { opacity: 0, scaleY: 0.2 }}
      animate={{ opacity, scaleY: 1 }}
      transition={transition}
      style={{ height: `${height}px` }}
    >
      {visibleSegments.map((segment, index) => (
        <span
          key={segment.key}
          className="min-h-0"
          style={{
            flexGrow:        segment.value,
            minHeight:       visibleSegments.length > 1 ? '2px' : undefined,
            backgroundColor: segment.color,
            boxShadow:       index > 0 ? 'inset 0 -1px 0 var(--color-warm-paper-raised)' : undefined,
          }}
        />
      ))}
    </motion.span>
  )
}

function segmentValuesForDay(day: ForecastDay): Record<ForecastSegmentKey, number> {
  const backlog = safeNonNegativeInteger(day.backlogCount ?? 0)
  const review  = safeNonNegativeInteger(day.reviewCount ?? 0)
  const newCards = safeNonNegativeInteger(day.newCount ?? 0)
  const explicitTotal = backlog + review + newCards

  if (explicitTotal > 0 || day.count === 0) {
    return { backlog, review, new: newCards }
  }

  return { backlog: 0, review: day.count, new: 0 }
}

function forecastDayAriaLabel(day: ForecastDay): string {
  if (day.count === 0) return `${day.label}: no cards`

  const values = segmentValuesForDay(day)
  const parts = FORECAST_SEGMENTS
    .map((segment) => ({ ...segment, value: values[segment.key] }))
    .filter((segment) => segment.value > 0)
    .map((segment) => {
      const label = segment.key === 'review' && !day.isToday
        ? 'due reviews'
        : segment.label.toLowerCase()
      return `${formatExactCount(segment.value)} ${label}`
    })

  return `${day.label}: ${formatExactCount(day.count)} cards, ${parts.join(', ')}`
}

function normalizeForecastDay(day: ForecastDay): ForecastDay {
  const backlogCount = safeNonNegativeInteger(day.backlogCount ?? 0)
  const reviewCount  = safeNonNegativeInteger(day.reviewCount ?? 0)
  const newCount     = safeNonNegativeInteger(day.newCount ?? 0)
  const explicitTotal = backlogCount + reviewCount + newCount

  return {
    ...day,
    label:        day.label.trim() || 'Day',
    dateNum:      safeNonNegativeInteger(day.dateNum),
    count:        explicitTotal > 0 ? explicitTotal : safeNonNegativeInteger(day.count),
    backlogCount,
    reviewCount,
    newCount,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function summarizeForecastDays(days: ForecastDay[]): {
  total:   number
  peakDay: ForecastDay | null
} {
  let total = 0
  let peakDay: ForecastDay | null = null

  for (const day of days) {
    total += day.count
    if (peakDay === null || day.count > peakDay.count) {
      peakDay = day
    }
  }

  return { total, peakDay }
}

function peakCountForDays(days: ForecastDay[]): number {
  let peak = 1
  for (const day of days) {
    if (day.count > peak) peak = day.count
  }
  return peak
}

/**
 * Round a peak value up to a "nice" gridline maximum so bar heights resolve
 * to clean ratios. e.g. peak=22 → 30; peak=14 → 20; peak=8 → 10.
 */
function roundUpToNice(peak: number): number {
  if (peak <= 5)   return 5
  if (peak <= 10)  return 10
  if (peak <= 20)  return 20
  if (peak <= 30)  return 30
  if (peak <= 50)  return 50
  return Math.ceil(peak / 25) * 25
}
