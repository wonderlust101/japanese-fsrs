'use client'

import { useMemo } from 'react'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { TopBarTitle } from '@/app/(app)/_components/top-bar-title'
import { PageLoader } from '@/components/ui/TomoLoader'
import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useReviewForecast } from '@/lib/api/reviews'
import { cn } from '@/lib/utils'

import { MistakeBudgetChart } from './MistakeBudgetChart'
import { EmptyInsights } from './EmptyInsights'
import { ForecastChart } from './ForecastChart'
import { InsightsMasthead } from './InsightsMasthead'
import { InsightsErrorAlert } from './InsightsErrorAlert'
import { InsightsPageShell } from './InsightsPageShell'
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

import { useInsightsDevState } from '@/dev/panels/insights-overview'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Titled top bar for the Overview, matching the eyebrow chrome on the deeper
 * Insights tabs (Progress / Forecast / Statistics). No back link — Overview is
 * the section root, reached from the sidebar rather than a deeper page.
 */
function OverviewTopBar(): React.JSX.Element {
  return (
    <TopBar>
      <TopBarTitle kanji="観" label="Overview" />
    </TopBar>
  )
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
      <InsightsPageShell topBar={<OverviewTopBar />}>
        <InsightsErrorAlert
          label="your insights"
          onRetry={() => {
            void dashboard.refetch()
            void forecast.refetch()
          }}
        />
      </InsightsPageShell>
    )
  }

  if (isLoading) {
    return (
      <InsightsPageShell topBar={<OverviewTopBar />}>
        <PageLoader />
      </InsightsPageShell>
    )
  }

  return (
    <InsightsPageShell topBar={<OverviewTopBar />}>
      <OverviewView report={report} inputs={effectiveInputs} todayIso={effectiveToday} />
    </InsightsPageShell>
  )
}

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
        <EmptyInsights />
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

      {/* Headline + Recommendation — paired side-by-side once the content
          column reaches 4xl (~896px, a container query on the page shell),
          stacked below. The split distributes weight across 1440px in
          newspaper-grid fashion: the headline sits left as the dominant
          statement, the recommendation parks on the right as the action
          callout. Keyed to the column's own width so the pair each gets its
          own full-width row while the sidebar squeezes the column. */}
      <div className="mt-9 grid grid-cols-1 gap-x-10 gap-y-8 lg:mt-11 @4xl/insights:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] @4xl/insights:items-start @4xl/insights:gap-x-14">
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
          {...(report.recommendation.action !== undefined
            ? { action: report.recommendation.action }
            : {})}
        />
      </div>

      {/* Notes — lead spans full width with internal prose/sketch split; medium
          and compact share a 2-col grid below, so the lead's importance is
          preserved while the canvas still distributes across 1440px. The 2-col
          split waits for the content column to reach 4xl (~896px, a container
          query on the page shell) so each note (and its chart sketch) holds a
          full row while the sidebar squeezes the column. */}
      <section
        aria-label="This week's notes"
        className="mt-12 flex flex-col gap-y-6 lg:mt-14 lg:gap-y-6"
      >
        <NoteSlot
          note={report.notes.lead}
          weight="lead"
          inputs={inputs}
          todayIso={todayIso}
        />
        <div className="grid grid-cols-1 gap-x-6 gap-y-6 @4xl/insights:grid-cols-2 @4xl/insights:gap-x-7">
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
  // The week's headline is the page's most important statement, so it carries
  // the document <h1> (the masthead above is identity chrome, not the title).
  // Emphasis is purely visual color/weight, so it renders as <span>, not <em>:
  // there's no stress-emphasis meaning for a screen reader to announce.
  return (
    <h1 className="max-w-[26ch] font-display text-[1.875rem] font-normal leading-[1.15] tracking-tight text-sumi-ink sm:max-w-[32ch] sm:text-[2.25rem] lg:max-w-[44ch] lg:text-[2.75rem] xl:text-[3.125rem]">
      {parts.map((p, i) =>
        p.kind === 'em' ? (
          <span
            key={i}
            className={cn('font-semibold', HEADLINE_TONE_CLASS[tone])}
          >
            {p.text}
          </span>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </h1>
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
    return <MistakeBudgetChart heatmap={inputs.heatmap} />
  }
  return (
    <ForecastChart
      heatmap={inputs.heatmap}
      forecast={inputs.forecast}
      todayIso={todayIso}
    />
  )
}

// Chrome, error (shared <InsightsErrorAlert/> with retry), and loading
// (<PageLoader/>) all run through the shared <InsightsPageShell/>.
