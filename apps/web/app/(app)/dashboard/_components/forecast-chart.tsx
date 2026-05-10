import { CardHeader, DATA_CARD_CHROME, ModuleError, type ModuleState, SkeletonBlock } from './section-primitives'

interface ForecastDay {
  label:   string
  count:   number
  isToday: boolean
}

interface ForecastChartProps {
  state: ModuleState
  /**
   * Up to 14 days starting from today. Mobile + tablet (< lg) renders the
   * first 7; desktop (lg+) renders all 14. Pass at least 7.
   */
  days?: ForecastDay[]
}

const CHART_HEIGHT = 140

export function ForecastChart({ state, days = [] }: ForecastChartProps): React.JSX.Element {
  if (state === 'loading') {
    return (
      <section aria-labelledby="forecast-label" className={DATA_CARD_CHROME}>
        <CardHeader id="forecast-label" kanji="予測" label="Forecast" rightContent={<SkeletonBlock width={64} height={12} />} />
        <SkeletonBlock width="100%" height={CHART_HEIGHT + 50} />
      </section>
    )
  }

  if (state === 'error') {
    return (
      <section aria-labelledby="forecast-label" className={DATA_CARD_CHROME}>
        <CardHeader id="forecast-label" kanji="予測" label="Forecast" />
        <ModuleError message="Couldn't load this week's forecast." />
      </section>
    )
  }

  const days7  = days.slice(0, 7)
  const days14 = days.slice(0, 14)
  const total  = days14.reduce((sum, d) => sum + d.count, 0)

  // When the dataset is fully empty, hide the "0 total" suffix in the header.
  // Otherwise the header reads as "0 of something" while the body says "No
  // forecast data." — a quiet copy contradiction.
  const headerRightContent = days14.length > 0
    ? (
        <span className="tabular-nums">
          <span className="text-sumi-ink">{total}</span>
          <span className="ml-1">total</span>
        </span>
      )
    : undefined

  return (
    <section aria-labelledby="forecast-label" className={DATA_CARD_CHROME}>
      <CardHeader
        id="forecast-label"
        kanji="予測"
        label="Forecast"
        rightContent={headerRightContent}
      />

      {/* Mobile / tablet: 7 days */}
      <div className="lg:hidden">
        <BarChart days={days7} />
      </div>

      {/* Desktop: 14 days */}
      <div className="hidden lg:block">
        <BarChart days={days14} />
      </div>
    </section>
  )
}

// ── Vertical-bar chart ───────────────────────────────────────────────────────

/**
 * Today bar: full vermillion + 2px vermillion-deep top stripe.
 * Future bars fade by temporal distance — closer days are darker, distant
 * days are lighter, so the chart reads as a "horizon" where tomorrow feels
 * solid and two-weeks-out feels like a ghost. Encodes time as opacity, height
 * still encodes magnitude.
 */
function opacityForDay(i: number, isToday: boolean): number {
  if (isToday)    return 1
  if (i <= 3)     return 0.80
  if (i <= 7)     return 0.65
  return 0.50  // days 8-13
}

function BarChart({ days }: { days: ForecastDay[] }): React.JSX.Element {
  if (days.length === 0) {
    return <div className="text-sm text-faded-sumi italic">No forecast data.</div>
  }

  const peak     = Math.max(...days.map((d) => d.count), 1)
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

      {/* Day glyphs */}
      <ol className="mt-3 flex items-baseline gap-1 sm:gap-1.5 lg:gap-2">
        {days.map((d, i) => (
          <li
            key={i}
            className={[
              'flex-1 text-center font-mono uppercase tracking-[0.06em] tabular-nums',
              'text-[0.6875rem]',
              d.isToday ? 'text-inari-vermillion font-medium' : 'text-faded-sumi',
            ].join(' ')}
          >
            {d.label}
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

  // Today's bar gets a 2px vermillion-deep top stripe over the vermillion fill.
  const topStripe = day.isToday
    ? { borderTopWidth: '2px', borderTopColor: 'var(--color-inari-vermillion-deep)', borderTopStyle: 'solid' as const }
    : undefined

  return (
    <li
      className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
      aria-label={`${day.label}: ${day.count} cards`}
    >
      {/* Count label above the bar */}
      <span
        className={[
          'font-mono tabular-nums leading-none mb-1',
          day.isToday
            ? 'text-[0.6875rem] font-medium text-inari-vermillion'
            : 'text-[0.625rem] text-faded-sumi',
        ].join(' ')}
      >
        {day.count}
      </span>

      {/* Bar */}
      <span
        aria-hidden="true"
        className={[
          'w-full max-w-[28px] sm:max-w-[40px] lg:max-w-[52px] rounded-t-[1px]',
          day.count === 0 ? 'bg-soft-hairline' : 'bg-inari-vermillion',
        ].join(' ')}
        style={{
          height: `${barHeight}px`,
          opacity,
          ...topStripe,
        }}
      />
    </li>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
