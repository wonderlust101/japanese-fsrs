'use client'

import { useMemo } from 'react'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { QuietLink } from '@/components/ui/QuietLink'
import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'
import { cn } from '@/lib/utils'

import { DailyMistakesChart } from './DailyMistakesChart'
import { EmptyInsights } from './EmptyInsights'
import { ForecastChart } from './ForecastChart'
import { InsightsMasthead } from './InsightsMasthead'
import { RankedNote, type NoteWeight } from './RankedNote'
import { ReportRecommendation } from './ReportRecommendation'
import { RetentionChart } from './RetentionChart'
import {
  buildWeeklyReport,
  buildWeeklyReportInputs,
  splitEmphasis,
  type FigureKind,
  type NoteTone,
  type ReportNote,
  type WeeklyReport,
  type WeeklyReportInputs,
} from './weekly-report'

import { useInsightsDevState } from './InsightsDevPanel'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Container — owns data fetching, derives the weekly report, and renders
 * `OverviewView`. The view is exported separately so the in-page dev panel
 * (and any future preview surface) can render the same composition against
 * fixture data.
 */
export function InsightsOverview(): React.JSX.Element {
  const dashboard = useAnalyticsDashboard()
  const forecast  = useReviewForecast()

  const liveInputs: WeeklyReportInputs = useMemo(
    () => buildWeeklyReportInputs(dashboard.data, forecast.data?.items),
    [dashboard.data, forecast.data],
  )
  const today = useMemo(() => todayIso(), [])

  const dev = useInsightsDevState()

  const effectiveInputs = dev.fixtureInputs ?? liveInputs
  const effectiveToday  = dev.todayIso      ?? today

  const report: WeeklyReport = useMemo(
    () => buildWeeklyReport(effectiveInputs, effectiveToday, dev.seed ?? effectiveToday),
    [effectiveInputs, effectiveToday, dev.seed],
  )

  const isError   = dev.forcedState === 'error'   || (dev.forcedState === null && dashboard.isError && forecast.isError)
  const isLoading = dev.forcedState === 'loading' || (dev.forcedState === null && (dashboard.isLoading || forecast.isLoading))

  if (isError) {
    return (
      <>
        <TopBar desktopHidden />
        <div className={PAGE_CONTAINER_CLASS}>
          <ErrorState />
        </div>
        {dev.panel}
      </>
    )
  }

  if (isLoading) {
    return (
      <>
        <TopBar desktopHidden />
        <div className={PAGE_CONTAINER_CLASS}>
          <OverviewSkeleton />
        </div>
        {dev.panel}
      </>
    )
  }

  return (
    <>
      <TopBar desktopHidden />
      <div className={PAGE_CONTAINER_CLASS}>
        <OverviewView report={report} inputs={effectiveInputs} todayIso={effectiveToday} />
      </div>
      {dev.panel}
    </>
  )
}

const PAGE_CONTAINER_CLASS =
  'mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-8 lg:px-16 lg:py-8'

// ── Presentational view ─────────────────────────────────────────────────────

export interface OverviewViewProps {
  report:   WeeklyReport
  inputs:   WeeklyReportInputs
  todayIso: string
}

/**
 * Pure-presentational view of the weekly report. Takes the report shape
 * already computed by `buildWeeklyReport`. The masthead anchors the
 * composition; an asymmetric vertical rhythm sets headline / recommendation
 * apart from the notes section; three ranked notes carry the body.
 */
export function OverviewView({
  report,
  inputs,
  todayIso,
}: OverviewViewProps): React.JSX.Element {
  if (report.lowData) {
    return (
      <article className="w-full">
        <InsightsMasthead
          weekStart={report.window.weekStart}
          weekEnd={report.window.weekEnd}
          weekNumber={report.window.weekNumber}
        />
        <div className="mt-12 lg:mt-16">
          <EmptyInsights />
        </div>
      </article>
    )
  }

  return (
    <article className="w-full">
      <InsightsMasthead
        weekStart={report.window.weekStart}
        weekEnd={report.window.weekEnd}
        weekNumber={report.window.weekNumber}
      />

      {/* Headline + Recommendation — paired side-by-side on lg+, stacked below.
          The split distributes weight across 1440px in newspaper-grid fashion:
          the headline sits left as the dominant statement, the recommendation
          parks on the right as the action callout. */}
      <div className="mt-9 grid grid-cols-1 gap-x-10 gap-y-8 lg:mt-11 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-x-14">
        <section aria-label="This week's headline">
          <Headline tone={report.headline.tone} text={report.headline.text} />
        </section>

        <ReportRecommendation
          tone={report.recommendation.tone}
          kanji={report.recommendation.kanji}
          headline={report.recommendation.headline}
          {...(report.recommendation.body !== undefined
            ? { body: report.recommendation.body }
            : {})}
          action={report.recommendation.action}
        />
      </div>

      {/* Notes — lead spans full width with internal prose/sketch split; medium
          and compact share a 2-col grid below, so the lead's importance is
          preserved while the canvas still distributes across 1440px. */}
      <section
        aria-label="This week's notes"
        className="mt-12 flex flex-col gap-y-6 lg:mt-14 lg:gap-y-7"
      >
        <NoteSlot
          note={report.notes.lead}
          weight="lead"
          inputs={inputs}
          todayIso={todayIso}
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-2 lg:gap-x-7 lg:gap-y-7">
          <NoteSlot
            note={report.notes.second}
            weight="medium"
            inputs={inputs}
            todayIso={todayIso}
          />
          <NoteSlot
            note={report.notes.third}
            weight="compact"
            inputs={inputs}
            todayIso={todayIso}
          />
        </div>
      </section>

      <footer className="mt-12 lg:mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft-hairline pt-6">
        <QuietLink href="/insights/statistics" tone="sumi" trailingArrow size="sm">
          Open raw statistics
        </QuietLink>
        <QuietLink href="/settings" tone="sumi" trailingArrow size="sm">
          Insight settings
        </QuietLink>
        {report.lowData && (
          <span className="text-xs italic text-faded-sumi">
            Your report will fill out after a few more sessions.
          </span>
        )}
      </footer>
    </article>
  )
}

// ── Headline ────────────────────────────────────────────────────────────────

interface HeadlineProps {
  tone: NoteTone | 'new-user'
  text: string
}

const HEADLINE_TONE_CLASS: Record<NoteTone | 'new-user', string> = {
  attention:   'text-inari-vermillion-deep',
  celebratory: 'text-inari-vermillion-deep',
  neutral:     'text-sumi-ink',
  'new-user':  'text-sumi-ink',
}

function Headline({ tone, text }: HeadlineProps): React.JSX.Element {
  const parts = splitEmphasis(text)
  return (
    <p className="max-w-[26ch] font-display text-[1.875rem] leading-[1.15] tracking-tight text-sumi-ink sm:max-w-[32ch] sm:text-[2.25rem] lg:max-w-[34ch] lg:text-[2.75rem] xl:text-[3.125rem]">
      {parts.map((p, i) =>
        p.kind === 'em' ? (
          <em
            key={i}
            className={cn('not-italic font-semibold', HEADLINE_TONE_CLASS[tone])}
          >
            {p.text}
          </em>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  )
}

// ── Note slot (renders sketch for lead only) ────────────────────────────────

interface NoteSlotProps {
  note:     ReportNote
  weight:   NoteWeight
  inputs:   WeeklyReportInputs
  todayIso: string
}

function NoteSlot({
  note,
  weight,
  inputs,
  todayIso,
}: NoteSlotProps): React.JSX.Element {
  return (
    <RankedNote
      weight={weight}
      tone={note.tone}
      kanji={note.kanji}
      label={note.label}
      body={note.body}
      deepLink={note.deepLink}
    >
      {note.figure !== null
        ? renderSketch(note.figure, inputs, todayIso)
        : undefined}
    </RankedNote>
  )
}

function renderSketch(
  kind:     FigureKind,
  inputs:   WeeklyReportInputs,
  todayIso: string,
): React.ReactNode {
  if (kind === 'retention') {
    return <RetentionChart heatmap={inputs.heatmap} />
  }
  if (kind === 'mistakes') {
    return <DailyMistakesChart heatmap={inputs.heatmap} />
  }
  return (
    <ForecastChart
      heatmap={inputs.heatmap}
      forecast={inputs.forecast}
      todayIso={todayIso}
    />
  )
}

// ── Error state ─────────────────────────────────────────────────────────────

function ErrorState(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-[760px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p>Couldn&rsquo;t load your insights right now.</p>
      <p className="mt-1 text-error-deep/80">
        Refresh the page, or try again in a moment.
      </p>
    </div>
  )
}

// ── Loading skeleton ────────────────────────────────────────────────────────

function OverviewSkeleton(): React.JSX.Element {
  return (
    <article
      aria-busy="true"
      aria-label="Loading your weekly report"
      className="w-full"
    >
      {/* Masthead skeleton */}
      <div className="flex flex-col gap-y-5">
        <div className="flex items-center gap-x-4 sm:gap-x-5">
          <div className="dashboard-skeleton h-12 w-12 rounded-[2px]" />
          <div className="flex flex-col gap-y-2">
            <div className="dashboard-skeleton h-3 w-[10rem] rounded-[2px]" />
            <div className="dashboard-skeleton h-3 w-[14rem] rounded-[2px]" />
          </div>
        </div>
        <hr aria-hidden="true" className="border-0 border-t border-sumi-ink/15" />
      </div>

      {/* Headline + Recommendation skeleton — mirrors the live 2-col grid */}
      <div className="mt-9 grid grid-cols-1 gap-x-10 gap-y-8 lg:mt-11 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start lg:gap-x-14">
        <div className="flex flex-col gap-y-3">
          <div className="dashboard-skeleton h-10 w-full rounded-[2px] sm:h-11 lg:h-14" />
          <div className="dashboard-skeleton h-10 w-4/5 rounded-[2px] sm:h-11 lg:h-14" />
        </div>
        <div className="grid grid-cols-[auto,1fr] gap-x-5 rounded-[2px] bg-cream-inset/70 px-5 py-5 sm:px-6 sm:py-6">
          <div className="dashboard-skeleton h-12 w-12 rounded-[2px]" />
          <div className="flex flex-col gap-y-3">
            <div className="dashboard-skeleton h-3 w-1/3 rounded-[2px]" />
            <div className="dashboard-skeleton h-5 w-3/4 rounded-[2px]" />
            <div className="dashboard-skeleton mt-1 h-10 w-[10rem] rounded-[2px]" />
          </div>
        </div>
      </div>

      {/* Notes skeleton — lead full width with internal 2-col split on lg+,
          medium + compact in a 2-col grid below */}
      <div className="mt-12 flex flex-col gap-y-6 lg:mt-14 lg:gap-y-7">
        <NoteCardSkeleton bodyLines={3} sketchHeight="h-28" wide />
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 lg:grid-cols-2 lg:gap-x-7 lg:gap-y-7">
          <NoteCardSkeleton bodyLines={2} sketchHeight="h-24" />
          <NoteCardSkeleton bodyLines={2} sketchHeight="h-20" />
        </div>
      </div>
    </article>
  )
}

function NoteCardSkeleton({
  bodyLines,
  sketchHeight,
  wide = false,
}: {
  bodyLines:    number
  sketchHeight: string
  /** When true, the body + sketch render in a 2-col grid on lg+ (the lead card). */
  wide?:        boolean
}): React.JSX.Element {
  const body = (
    <div className="flex flex-col gap-y-2">
      {Array.from({ length: bodyLines }, (_, i) => (
        <div
          key={i}
          className={`dashboard-skeleton h-4 rounded-[2px] ${i === bodyLines - 1 ? 'w-3/4' : 'w-full'}`}
        />
      ))}
    </div>
  )
  const sketch = (
    <div className={`dashboard-skeleton ${sketchHeight} w-full rounded-[2px]`} />
  )

  return (
    <div className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion/40" />
      <div className="flex items-baseline gap-x-3">
        <div className="dashboard-skeleton h-6 w-6 rounded-[2px]" />
        <div className="dashboard-skeleton h-3 w-[6rem] rounded-[2px]" />
      </div>
      {wide ? (
        <div className="mt-5 grid grid-cols-1 gap-y-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-x-12">
          {body}
          {sketch}
        </div>
      ) : (
        <>
          <div className="mt-4">{body}</div>
          <div className="mt-5">{sketch}</div>
        </>
      )}
    </div>
  )
}
