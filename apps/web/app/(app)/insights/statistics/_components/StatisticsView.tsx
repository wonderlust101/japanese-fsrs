'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Logo } from '@/components/ui/Logo'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { useAnalyticsDashboard } from '@/lib/api/analytics'
import { useMaturityHistory } from '@/lib/api/insights'
import { useDecks } from '@/lib/api/decks'
import { useReviewForecast } from '@/lib/api/reviews'
import { queryKeys } from '@/lib/api/queryKeys'
import { getProfileAction } from '@/lib/actions/profile.actions'

import { ActivitySection } from './ActivitySection'
import { adaptLiveStatistics, hasMeaningfulData } from './adapt-live'
import { CardsSection } from './CardsSection'
import { FsrsSection } from './FsrsSection'
import { RetentionSection } from './RetentionSection'
import { SchedulingSection } from './SchedulingSection'
import { StatisticsSectionTabs } from './StatisticsSectionTabs'
import { useStatisticsDevState } from './StatisticsDevPanel'

const PAGE_SHELL_CLASS     = 'min-h-screen bg-cool-paper-base pb-16'
const PAGE_CONTAINER_CLASS = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16'
const HEADER_PADDING_CLASS = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

function StatisticsTopBar(): React.JSX.Element {
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
      <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">Statistics</h1>
    </TopBar>
  )
}

function StatisticsHeader(): React.JSX.Element {
  return (
    <div className={HEADER_PADDING_CLASS}>
      <PageHeader
        kanji="数"
        label="Statistics"
        title="Statistics"
        subtitle="Detailed numbers from your practice: activity, retention, collection, schedule, and FSRS state. Grouped by question rather than by metric."
      />
    </div>
  )
}

/**
 * Statistics container. Renders chrome (TopBar + PageHeader + sticky section
 * tabs) and the five sections in order. Data flows from the live insights /
 * analytics endpoints (dashboard + maturity-history + decks + forecast +
 * profile); the dev panel's fixture data, when selected, overrides the live
 * inputs so designers can preview every state in development without
 * leaving the route.
 */
export function StatisticsView(): React.JSX.Element {
  const dev   = useStatisticsDevState()
  const isDev = process.env.NODE_ENV === 'development'

  const dashboardQuery       = useAnalyticsDashboard()
  const maturityHistoryQuery = useMaturityHistory('90')
  const decksQuery           = useDecks(50)
  const forecastQuery        = useReviewForecast()
  // Profile carries `retentionTarget` — the only piece of FSRS state we can
  // surface without a dedicated optimizer-state endpoint.
  const profileQuery = useQuery({
    queryKey:  queryKeys.profile.me(),
    queryFn:   getProfileAction,
    staleTime: 1000 * 60 * 60,
  })

  const liveData = useMemo(() => {
    return adaptLiveStatistics({
      dashboard:       dashboardQuery.data,
      maturityHistory: maturityHistoryQuery.data,
      decks:           decksQuery.data?.items,
      forecast:        forecastQuery.data?.items,
      retentionTarget: profileQuery.data?.retentionTarget,
    })
  }, [
    dashboardQuery.data,
    maturityHistoryQuery.data,
    decksQuery.data,
    forecastQuery.data,
    profileQuery.data,
  ])

  // Forced dev states override live state classification entirely.
  if (dev.forcedState === 'error') {
    return (
      <PageShell>
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }
  if (dev.forcedState === 'loading') {
    return (
      <PageShell>
        <StatisticsSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  const isLoading =
    dev.fixtureData === null
    && (dashboardQuery.isLoading || maturityHistoryQuery.isLoading || forecastQuery.isLoading)

  // Treat dashboard as the load-bearing query; the others either fall back
  // to empty (`apiCallSafe`) or aren't blocking (profile, maturity history).
  const isError = dev.fixtureData === null && dashboardQuery.isError

  if (isError) {
    return (
      <PageShell>
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }

  if (isLoading) {
    return (
      <PageShell>
        <StatisticsSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  const data = dev.fixtureData ?? liveData

  if (!hasMeaningfulData(data)) {
    return (
      <PageShell>
        <StatisticsEmpty isDev={isDev} />
        {dev.panel}
      </PageShell>
    )
  }

  return (
    <PageShell>
      <StatisticsSectionTabs />

      <div className="mt-9 flex flex-col gap-y-14 lg:mt-12 lg:gap-y-16">
        <ActivitySection
          days={data.activity}
          stats={data.activityStats}
        />
        <RetentionSection
          days={data.retention}
          answers={data.answerButtons}
        />
        <CardsSection
          maturity={data.maturity}
          decks={data.decks}
        />
        <SchedulingSection
          intervals={data.intervals}
          cumulative={data.cumulative}
          overdue={data.overdue}
        />
        <FsrsSection
          fsrs={data.fsrs}
        />
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

// ── Shared page shell ───────────────────────────────────────────────────────
// Centralizes the TopBar + container + PageHeader so each return branch
// doesn't repeat the chrome wiring.

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <>
      <StatisticsTopBar />
      <div className={PAGE_SHELL_CLASS}>
        <div className={PAGE_CONTAINER_CLASS}>
          <StatisticsHeader />
          {children}
        </div>
      </div>
    </>
  )
}

// ── States ──────────────────────────────────────────────────────────────────

function ErrorAlert(): React.JSX.Element {
  return (
    <div
      role="alert"
      className="mx-auto w-full max-w-[760px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
    >
      <p>Couldn&rsquo;t load your statistics right now.</p>
      <p className="mt-1 text-error-deep/80">
        Refresh the page, or try again in a moment.
      </p>
    </div>
  )
}

function StatisticsEmpty({ isDev }: { isDev: boolean }): React.JSX.Element {
  return (
    <section
      aria-label="Statistics needs data"
      className="mx-auto mt-12 flex flex-col items-center gap-y-7 py-6 text-center lg:mt-20"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-[40ch] font-display text-[1.25rem] leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        Statistics fills in after a few weeks of practice.
      </p>

      <p className="max-w-[52ch] text-sm leading-relaxed text-faded-sumi">
        {isDev
          ? 'No reviews yet (or pick a fixture from the dev panel in the bottom-left to preview each section).'
          : 'Come back when you have a couple weeks of reviews. The page will show your activity, retention, collection, scheduling, and FSRS state.'}
      </p>

      <div className="pt-2">
        <QuietLink href="/today" tone="brand" trailingArrow size="md">
          Start a review
        </QuietLink>
      </div>
    </section>
  )
}

function StatisticsSkeleton(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your statistics"
      className="mt-9 flex flex-col gap-y-14 lg:mt-12 lg:gap-y-16"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex flex-col gap-y-5">
          <div className="flex items-baseline gap-x-3 border-b border-soft-hairline pb-4">
            <div className="dashboard-skeleton h-7 w-7 rounded-[2px]" />
            <div className="dashboard-skeleton h-3 w-[6rem] rounded-[2px]" />
          </div>
          <div className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6">
            <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion/40" />
            <div className="dashboard-skeleton h-3 w-[8rem] rounded-[2px]" />
            <div className="dashboard-skeleton mt-5 h-40 w-full rounded-[2px]" />
          </div>
        </div>
      ))}
    </div>
  )
}
