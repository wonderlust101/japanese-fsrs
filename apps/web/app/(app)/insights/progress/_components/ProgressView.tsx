'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { ApiAnalyticsDashboard } from '@fsrs-japanese/shared-types'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { useAnalyticsDashboard } from '@/lib/api/analytics'

import { JlptCoverageStrip } from './JlptCoverageStrip'
import { MatureStackedArea } from './MatureStackedArea'
import { ProgressEmpty } from './ProgressEmpty'
import { ProgressSummaryStrip } from './ProgressSummaryStrip'
import { RetentionRibbonChart } from './RetentionRibbonChart'
import { YearHeatmap } from './YearHeatmap'
import {
  buildHeaderLine,
  buildMatureLine,
  buildRetentionLine,
  buildConsistencyLine,
  classifyProgress,
} from './progressInterpretation'
import {
  JLPT_TOTALS,
  type HeatmapCell,
  type JlptCoverage,
  type ProgressData,
  type ProgressSummary,
  type RetentionPoint,
} from './progressTypes'
import { useProgressDevState } from './ProgressDevPanel'

const PAGE_SHELL_CLASS     = 'min-h-screen bg-cool-paper-base pb-16'
const PAGE_CONTAINER_CLASS = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16'
const HEADER_PADDING_CLASS = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

// ── Page chrome ─────────────────────────────────────────────────────────────

function ProgressTopBar(): React.JSX.Element {
  return (
    <TopBar>
      <Link
        href="/insights"
        className="flex shrink-0 items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
      >
        <span aria-hidden="true">←</span>
        <span>Insights</span>
      </Link>
      <span aria-hidden="true" className="shrink-0 text-faded-sumi">·</span>
      <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">Progress</h1>
    </TopBar>
  )
}

interface ProgressHeaderProps {
  subtitle: string
}

function ProgressHeader({ subtitle }: ProgressHeaderProps): React.JSX.Element {
  return (
    <div className={HEADER_PADDING_CLASS}>
      <PageHeader
        kanji="進"
        label="Progress"
        title="Progress"
        subtitle={subtitle}
      />
    </div>
  )
}

// ── Live-data adapter ──────────────────────────────────────────────────────

/**
 * Convert the live `useAnalyticsDashboard` response into the ProgressData
 * shape the page components consume. The mature pipeline section requires
 * per-day snapshots the API doesn't yet expose, so `mature` and
 * `milestones` come back empty; the Mature SectionCard handles that by
 * suppressing its chart and showing a single-line note.
 *
 * Default `desiredRetention` is 0.9 (the FSRS default) until the user's
 * personal setting is plumbed through.
 */
function adaptDashboard(
  dashboard: ApiAnalyticsDashboard,
  desiredRetention: number,
): ProgressData {
  const heatmap: HeatmapCell[] = dashboard.heatmap.items.map((h) => ({
    date:      h.date,
    count:     h.count,
    retention: h.retention / 100,
  }))

  const retention: RetentionPoint[] = heatmap.map((h) => ({
    date:      h.date,
    retention: h.count > 0 ? h.retention : null,
    reviews:   h.count,
  }))

  const jlpt: JlptCoverage[] = dashboard.jlptGap.items
    .filter((j): j is typeof j & { jlptLevel: keyof typeof JLPT_TOTALS } => j.jlptLevel !== 'beyond_jlpt')
    .map((j) => ({
      level:       j.jlptLevel,
      total:       JLPT_TOTALS[j.jlptLevel],
      encountered: j.learned + j.due,
      owned:       j.learned,
    }))

  const recent30 = heatmap.slice(-30).filter((d) => d.count > 0)
  const retention30d = recent30.length === 0
    ? 0
    : recent30.reduce((acc, d) => acc + d.retention, 0) / recent30.length
  const activeDaysLast30 = recent30.length

  const summary: ProgressSummary = {
    matureCount:         0,
    retention30d,
    activeDaysLast30,
    cardsAddedThisMonth: 0,
    daysSinceStart:      heatmap.filter((d) => d.count > 0).length,
  }

  const firstActive = heatmap.find((d) => d.count > 0)
  const firstReviewDate = firstActive?.date ?? heatmap[0]?.date ?? new Date().toISOString().slice(0, 10)

  const state = classifyProgress({
    retention,
    mature: [],
    desiredRetention,
    summary,
  })

  return {
    state,
    firstReviewDate,
    summary,
    retention,
    mature: [],
    milestones: [],
    jlpt,
    heatmap,
    desiredRetention,
  }
}

// ── View ───────────────────────────────────────────────────────────────────

/**
 * Container for /insights/progress. Five SectionCards stack vertically:
 * Summary, Retention, Mature, JLPT, Consistency. Data flows from the
 * dev panel when a fixture is selected, otherwise from the live
 * analytics dashboard. Limited-data and error/loading states branch
 * before chart rendering.
 */
export function ProgressView(): React.JSX.Element {
  const dev = useProgressDevState()
  const isDev = process.env.NODE_ENV === 'development'
  const dashboardQuery = useAnalyticsDashboard()

  const data = useMemo<ProgressData | null>(() => {
    if (dev.fixtureData !== null) return dev.fixtureData
    if (dashboardQuery.data === undefined) return null
    return adaptDashboard(dashboardQuery.data, 0.9)
  }, [dev.fixtureData, dashboardQuery.data])

  // Forced dev states win first.
  if (dev.forcedState === 'error') {
    return (
      <PageShell>
        <ProgressHeader subtitle="What you've grown, where you stand, how you've been showing up." />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }
  if (dev.forcedState === 'loading') {
    return (
      <PageShell>
        <ProgressHeader subtitle="What you've grown, where you stand, how you've been showing up." />
        <ProgressSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.fixtureData === null && dashboardQuery.isError) {
    return (
      <PageShell>
        <ProgressHeader subtitle="What you've grown, where you stand, how you've been showing up." />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.fixtureData === null && dashboardQuery.isLoading) {
    return (
      <PageShell>
        <ProgressHeader subtitle="What you've grown, where you stand, how you've been showing up." />
        <ProgressSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  if (data === null || data.state === 'limited') {
    return (
      <PageShell>
        <ProgressHeader
          subtitle={
            data === null
              ? "What you've grown, where you stand, how you've been showing up."
              : buildHeaderLine(data)
          }
        />
        <ProgressEmpty
          firstReviewDate={data?.firstReviewDate ?? null}
          isDev={isDev && dev.fixtureData !== null}
        />
        {dev.panel}
      </PageShell>
    )
  }

  const headerLine = buildHeaderLine(data)
  const hasMature  = data.mature.length >= 14

  return (
    <PageShell>
      <ProgressHeader subtitle={headerLine} />

      <div className="flex flex-col gap-y-8 lg:gap-y-10">
        <SectionCard
          id="progress-summary"
          kanji="要"
          label="Summary"
          description="A quiet read of where you stand today."
          chrome="chart"
          variant="chart"
        >
          <ProgressSummaryStrip data={data} />
        </SectionCard>

        <SectionCard
          id="progress-retention"
          kanji="保"
          label="Retention"
          description={buildRetentionLine(data)}
          chrome="chart"
          variant="chart"
        >
          <RetentionRibbonChart
            series={data.retention}
            desiredRetention={data.desiredRetention}
          />
        </SectionCard>

        <SectionCard
          id="progress-mature"
          kanji="熟"
          label="Mature growth"
          description={
            hasMature
              ? buildMatureLine(data)
              : 'Per-day pipeline snapshots arrive in the next backend pass.'
          }
          chrome="chart"
          variant="chart"
        >
          {hasMature ? (
            <MatureStackedArea
              series={data.mature}
              milestones={data.milestones}
            />
          ) : (
            <MatureFallbackNote />
          )}
        </SectionCard>

        <SectionCard
          id="progress-jlpt"
          kanji="級"
          label="JLPT coverage"
          description="A proportional read across the five levels."
          chrome="chart"
          variant="chart"
        >
          <JlptCoverageStrip data={data} />
        </SectionCard>

        <SectionCard
          id="progress-consistency"
          kanji="続"
          label="Consistency"
          description={buildConsistencyLine(data)}
          chrome="chart"
          variant="chart"
        >
          <YearHeatmap cells={data.heatmap} />
        </SectionCard>
      </div>

      <footer className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft-hairline pt-6">
        <QuietLink href="/insights" tone="sumi" trailingArrow size="sm">
          Back to overview
        </QuietLink>
      </footer>
      {dev.panel}
    </PageShell>
  )
}

// ── PageShell + auxiliary blocks ───────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <ProgressTopBar />
      <div className={PAGE_SHELL_CLASS}>
        <div className={PAGE_CONTAINER_CLASS}>{children}</div>
      </div>
    </>
  )
}

function ErrorAlert(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-[760px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p>Couldn&rsquo;t load your progress right now.</p>
      <p className="mt-1 text-error-deep/80">Refresh the page, or try again in a moment.</p>
    </div>
  )
}

function ProgressSkeleton(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your progress"
      className="flex flex-col gap-y-8 lg:gap-y-10"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6"
        >
          <span
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion/40"
          />
          <div className="flex items-baseline gap-x-3 border-b border-soft-hairline pb-4">
            <div className="dashboard-skeleton h-7 w-7 rounded-[2px]" />
            <div className="dashboard-skeleton h-3 w-[8rem] rounded-[2px]" />
          </div>
          <div className="mt-5 flex flex-col gap-y-2">
            <div className="dashboard-skeleton h-4 w-full rounded-[2px]" />
            <div className="dashboard-skeleton h-4 w-3/4 rounded-[2px]" />
          </div>
          <div className="dashboard-skeleton mt-5 h-40 w-full rounded-[2px]" />
        </div>
      ))}
    </div>
  )
}

function MatureFallbackNote(): React.JSX.Element {
  return (
    <div className="rounded-[2px] border border-dashed border-soft-hairline bg-cream-inset/50 px-5 py-6 text-sm leading-relaxed text-faded-sumi">
      <p className="text-sumi-ink/85">
        The maturity pipeline chart needs per-day snapshots of card state
        that the analytics endpoint doesn&rsquo;t yet return.
      </p>
      <p className="mt-2">
        Once the backend pass is in, this section will show new, learning,
        young, and mature counts stacked over time, with milestone dots at
        100, 250, 500, and 1,000 mature cards.
      </p>
    </div>
  )
}
