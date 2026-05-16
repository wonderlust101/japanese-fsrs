'use client'

import { useMemo } from 'react'
import type {
  ApiForecastDay,
  ApiHeatmapDay,
  ApiJlptGap,
  ApiLayoutAccuracy,
} from '@fsrs-japanese/shared-types'

import { JlptPill } from '@/components/ui/Pill'
import { QuietLink } from '@/components/ui/QuietLink'
import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'

import { HeadlineInsight } from './HeadlineInsight'
import {
  buildHeadlineInputs,
  pickHeadlineInsight,
  MIN_ACTIVE_DAYS_FOR_INSIGHTS,
  type InsightTone,
} from './headline-insight'
import { InsightsSection } from './InsightsSection'
import { Sparkline } from './Sparkline'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function sortByDateAsc<T extends { date: string }>(items: ReadonlyArray<T>): T[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : 1))
}

function progressTone(
  heatmap: ReadonlyArray<ApiHeatmapDay>,
  headlineTone: InsightTone,
): 'celebratory' | 'attention' | 'neutral' {
  if (headlineTone === 'celebratory') return 'celebratory'
  if (headlineTone === 'attention') {
    // Only color the Progress section when the *progress* signal itself is the
    // concerning one — falls back to neutral when the issue lives in Mistakes.
    const active = heatmap.filter((d) => d.count > 0)
    if (active.length === 0) return 'neutral'
    const trailing = active.slice(0, -7)
    const recent = active.slice(-7)
    if (trailing.length < 3 || recent.length < 3) return 'neutral'
    const avg = (xs: ReadonlyArray<ApiHeatmapDay>): number =>
      xs.reduce((a, b) => a + b.retention, 0) / xs.length
    return avg(recent) < avg(trailing) - 0.05 ? 'attention' : 'neutral'
  }
  return 'neutral'
}

function weakestLayoutPick(
  accuracy: ReadonlyArray<ApiLayoutAccuracy>,
): ApiLayoutAccuracy | null {
  const filtered = [...accuracy]
    .filter((a) => a.total >= 5)
    .sort((a, b) => a.accuracyPct - b.accuracyPct)
  return filtered[0] ?? null
}

function activeJlptPick(
  gap: ReadonlyArray<ApiJlptGap>,
): ApiJlptGap | null {
  const ranked = [...gap]
    .filter((g) => g.total > 0 && g.learned > 0 && g.learned < g.total)
    .sort((a, b) => b.progressPct - a.progressPct)
  return ranked[0] ?? null
}

function forecastWindow(forecast: ReadonlyArray<ApiForecastDay>): {
  values:  number[]
  tomorrow: number
  weekTotal: number
  peak:    number
} {
  const sorted = sortByDateAsc(forecast).slice(0, 14)
  const values = sorted.map((d) => d.count)
  const tomorrow = values[1] ?? values[0] ?? 0
  const weekTotal = values.slice(0, 7).reduce((a, b) => a + b, 0)
  const peak = Math.max(0, ...values)
  return { values, tomorrow, weekTotal, peak }
}

function loadCharacter(weekTotal: number): 'light' | 'steady' | 'heavy' {
  if (weekTotal < 60)  return 'light'
  if (weekTotal < 250) return 'steady'
  return 'heavy'
}

function loadPhrase(character: 'light' | 'steady' | 'heavy'): string {
  switch (character) {
    case 'light':  return 'a light week'
    case 'steady': return 'a steady week'
    case 'heavy':  return 'a heavier week than usual'
  }
}

function jlptLabelFor(level: ApiJlptGap['jlptLevel']): string {
  return level === 'beyond_jlpt' ? 'Beyond' : level
}

function jlptPillLevelFor(level: ApiJlptGap['jlptLevel']): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | 'beyond_jlpt' {
  return level
}

function formatLayout(layout: ApiLayoutAccuracy['layout']): string {
  return layout.charAt(0).toUpperCase() + layout.slice(1)
}

export function InsightsOverview(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()

  const isLoading = dashboard.isLoading || forecast.isLoading
  const isError   = dashboard.isError && forecast.isError

  const inputs = useMemo(
    () => buildHeadlineInputs(dashboard.data),
    [dashboard.data],
  )
  const headline = useMemo(
    () => pickHeadlineInsight(inputs, todayIso()),
    [inputs],
  )

  const heatmap   = inputs.heatmap
  const accuracy  = inputs.accuracy
  const jlptGap   = inputs.jlptGap
  const forecastItems = forecast.data?.items ?? []
  const activeDays = heatmap.filter((d) => d.count > 0).length
  const lowData = activeDays < MIN_ACTIVE_DAYS_FOR_INSIGHTS

  const retentionValues = sortByDateAsc(heatmap).map((d) =>
    d.count > 0 ? d.retention : 0,
  )
  const reviewedTotal = heatmap.reduce((acc, d) => acc + d.count, 0)
  const matureLevel = activeJlptPick(jlptGap)
  const weakLayout = weakestLayoutPick(accuracy)
  const forecastInfo = forecastWindow(forecastItems)
  const character = loadCharacter(forecastInfo.weekTotal)

  if (isError) {
    return (
      <div className="rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep">
        <p>Couldn&rsquo;t load your insights right now.</p>
        <p className="mt-1 text-error-deep/80">Refresh the page, or try again in a moment.</p>
      </div>
    )
  }

  const progressSectionTone = lowData
    ? 'neutral'
    : progressTone(heatmap, headline.tone)

  const mistakesTone: 'celebratory' | 'attention' | 'neutral' =
    !lowData && weakLayout !== null && weakLayout.accuracyPct < 75
      ? 'attention'
      : 'neutral'

  return (
    <div>
      <section className="pb-2 pt-1" aria-label="Headline observation">
        <HeadlineInsight text={headline.text} tone={headline.tone} isLoading={isLoading} />
      </section>

      <InsightsSection
        kanji="進"
        label="Progress"
        tone={progressSectionTone}
      >
        {lowData ? (
          <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
            Your progress trend will appear once you have a few sessions on the
            books. The schedule is patient.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr,auto] lg:items-end lg:gap-10">
            <div className="min-w-0">
              <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-sumi-ink/90">
                You&rsquo;ve reviewed{' '}
                <span className="font-semibold text-sumi-ink tabular-nums">
                  {reviewedTotal} cards
                </span>{' '}
                across {activeDays} active days.{' '}
                {matureLevel !== null && (
                  <>
                    Most of your weight is on{' '}
                    <JlptPill
                      level={jlptPillLevelFor(matureLevel.jlptLevel)}
                      label={jlptLabelFor(matureLevel.jlptLevel)}
                      size="sm"
                    />{' '}
                    — {matureLevel.learned} learned of {matureLevel.total}.
                  </>
                )}
              </p>
              <div className="mt-4">
                <QuietLink href="/insights/progress" tone="brand" trailingArrow size="sm">
                  See the full trend
                </QuietLink>
              </div>
            </div>
            {retentionValues.length >= 3 && (
              <div className="min-w-0 lg:w-[280px]">
                <Sparkline
                  values={retentionValues}
                  height={72}
                  ariaLabel={`Retention trend across ${retentionValues.length} days`}
                />
                <div className="mt-2 flex justify-between font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
                  <span>Retention</span>
                  <span>{retentionValues.length} days</span>
                </div>
              </div>
            )}
          </div>
        )}
      </InsightsSection>

      <InsightsSection
        kanji="弱"
        label="Where you're slipping"
        tone={mistakesTone}
      >
        {lowData || accuracy.length === 0 ? (
          <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
            Once you&rsquo;ve made a handful of mistakes, this is where the
            pattern shows up.
          </p>
        ) : (
          <>
            <ul className="grid gap-3">
              {[...accuracy]
                .filter((a) => a.total > 0)
                .sort((a, b) => a.accuracyPct - b.accuracyPct)
                .slice(0, 3)
                .map((row) => (
                  <li
                    key={row.layout}
                    className="grid grid-cols-[1fr,auto,auto] items-baseline gap-3 border-b border-soft-hairline/70 pb-3 last:border-b-0 last:pb-0"
                  >
                    <span className="text-[0.9375rem] text-sumi-ink">
                      {formatLayout(row.layout)} cards
                    </span>
                    <span className="font-mono text-[0.75rem] tabular-nums text-faded-sumi">
                      {row.total} reviewed
                    </span>
                    <span
                      className={cnAccuracyColor(row.accuracyPct)}
                      aria-label={`Accuracy ${Math.round(row.accuracyPct)} percent`}
                    >
                      {Math.round(row.accuracyPct)}%
                    </span>
                  </li>
                ))}
            </ul>
            <div className="mt-4">
              <QuietLink href="/insights/mistakes" tone="brand" trailingArrow size="sm">
                Review these mistakes
              </QuietLink>
            </div>
          </>
        )}
      </InsightsSection>

      <InsightsSection
        kanji="次"
        label="What's coming"
      >
        {forecastInfo.values.length === 0 ? (
          <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-faded-sumi">
            Forecast appears once a few cards are scheduled forward.
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr,auto] lg:items-end lg:gap-10">
            <div className="min-w-0">
              <p className="max-w-[58ch] text-[0.9375rem] leading-relaxed text-sumi-ink/90">
                Tomorrow looks{' '}
                <span className="font-semibold text-sumi-ink tabular-nums">
                  {forecastInfo.tomorrow} cards
                </span>
                . Across the next seven days, {loadPhrase(character)} —{' '}
                <span className="tabular-nums">
                  {forecastInfo.weekTotal} cards
                </span>{' '}
                scheduled in total, peaking at{' '}
                <span className="tabular-nums">{forecastInfo.peak}</span>.
              </p>
              <div className="mt-4">
                <QuietLink href="/insights/forecast" tone="brand" trailingArrow size="sm">
                  See your forecast
                </QuietLink>
              </div>
            </div>
            <div className="min-w-0 lg:w-[280px]">
              <Sparkline
                values={forecastInfo.values}
                height={72}
                stroke="var(--color-aizome-indigo, #2c3e64)"
                fill="var(--color-cream-inset, rgba(213,196,161,0.18))"
                ariaLabel={`Forecast for next ${forecastInfo.values.length} days`}
              />
              <div className="mt-2 flex justify-between font-mono text-[0.625rem] uppercase tracking-[0.14em] text-faded-sumi">
                <span>Forecast</span>
                <span>{forecastInfo.values.length} days</span>
              </div>
            </div>
          </div>
        )}
      </InsightsSection>

      <footer className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft-hairline pt-6">
        <QuietLink href="/insights/statistics" tone="sumi" trailingArrow size="sm">
          Open raw statistics
        </QuietLink>
        <QuietLink href="/settings" tone="sumi" trailingArrow size="sm">
          Insight settings
        </QuietLink>
      </footer>
    </div>
  )
}

function cnAccuracyColor(accuracyPct: number): string {
  const base = 'font-mono text-sm tabular-nums'
  if (accuracyPct < 70) return `${base} text-error-deep`
  if (accuracyPct < 85) return `${base} text-jlpt-beyond-amber-warn`
  return `${base} text-sumi-ink`
}
