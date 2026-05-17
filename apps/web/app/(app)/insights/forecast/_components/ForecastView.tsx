'use client'

import { useMemo } from 'react'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Logo } from '@/components/ui/Logo'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { useReviewForecast } from '@/lib/api/reviews'

import { CatchUpPlannerCard } from './CatchUpPlannerCard'
import { DeckContributorsCard } from './DeckContributorsCard'
import { NewCardImpactCard } from './NewCardImpactCard'
import { TimeEstimateCard } from './TimeEstimateCard'
import { WorkloadCard } from './WorkloadCard'

const PAGE_SHELL_CLASS = 'min-h-screen bg-cool-paper-base pb-16'
const PAGE_CONTAINER_CLASS = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16'
const HEADER_PADDING_CLASS = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

function ForecastTopBar(): React.JSX.Element {
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
      <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">
        Forecast
      </h1>
    </TopBar>
  )
}

function ForecastHeader(): React.JSX.Element {
  return (
    <div className={HEADER_PADDING_CLASS}>
      <PageHeader
        kanji="次"
        label="Forecast"
        title="Forecast"
        subtitle="What's landing on your schedule over the next few weeks, and how to plan around it."
      />
    </div>
  )
}

/**
 * Container for /insights/forecast. Renders the page header and a vertical
 * stack of five SectionCard beats: upcoming workload, new-card impact,
 * catch-up planner, deck contributors, and time estimate. Each beat owns
 * its own data shape and rendering; this component only sequences them.
 *
 * Empty state: a centered kitsune accompanied by a short prose line,
 * mirroring the Overview's empty-state pattern but with forecast-specific
 * copy. Loading: skeleton placeholders. Error: inline alert.
 */
export function ForecastView(): React.JSX.Element {
  const forecastQuery = useReviewForecast()
  const items = useMemo(() => forecastQuery.data?.items ?? [], [forecastQuery.data])

  if (forecastQuery.isError) {
    return (
      <>
        <ForecastTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div className={PAGE_CONTAINER_CLASS}>
            <ForecastHeader />
            <div
              role="alert"
              className="mx-auto w-full max-w-[760px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
            >
              <p>Couldn&rsquo;t load your forecast right now.</p>
              <p className="mt-1 text-error-deep/80">
                Refresh the page, or try again in a moment.
              </p>
            </div>
          </div>
        </div>
      </>
    )
  }

  if (forecastQuery.isLoading) {
    return (
      <>
        <ForecastTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div
            className={PAGE_CONTAINER_CLASS}
            aria-busy="true"
            aria-label="Loading your forecast"
          >
            <ForecastHeader />
            <div className="flex flex-col gap-y-6 lg:gap-y-7">
              <ForecastSkeleton />
              <ForecastSkeleton compact />
              <ForecastSkeleton compact />
            </div>
          </div>
        </div>
      </>
    )
  }

  const hasAnyData = items.some((d) => d.count > 0)
  if (!hasAnyData) {
    return (
      <>
        <ForecastTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div className={PAGE_CONTAINER_CLASS}>
            <ForecastHeader />
            <ForecastEmpty />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <ForecastTopBar />
      <div className={PAGE_SHELL_CLASS}>
        <div className={PAGE_CONTAINER_CLASS}>
          <ForecastHeader />

          <div className="flex flex-col gap-y-6 lg:gap-y-7">
            <WorkloadCard forecast={items} />
            <NewCardImpactCard forecast={items} />
            <CatchUpPlannerCard forecast={items} />
            <DeckContributorsCard />
            <TimeEstimateCard forecast={items} />
          </div>

          <footer className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-soft-hairline pt-6 lg:mt-14">
            <QuietLink href="/insights" tone="sumi" trailingArrow size="sm">
              Back to overview
            </QuietLink>
          </footer>
        </div>
      </div>
    </>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

function ForecastEmpty(): React.JSX.Element {
  return (
    <section
      aria-label="Forecast needs more data"
      className="mx-auto mt-14 flex flex-col items-center gap-y-7 py-6 text-center lg:mt-20"
    >
      <Logo size={112} showWordmark={false} priority />

      <p className="max-w-[36ch] font-display text-[1.25rem] leading-[1.4] text-sumi-ink sm:text-[1.375rem]">
        Your forecast takes shape after a few reviews.
      </p>

      <p className="max-w-[44ch] text-sm leading-relaxed text-faded-sumi">
        Once your first cards are scheduled, this page will show what&rsquo;s
        landing each day, how new-card pace shifts the load, and where any
        backlog is hiding.
      </p>

      <div className="pt-2">
        <QuietLink href="/today" tone="brand" trailingArrow size="md">
          Start a review
        </QuietLink>
      </div>
    </section>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────

function ForecastSkeleton({ compact = false }: { compact?: boolean }): React.JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-[2px] border border-soft-hairline bg-warm-paper-raised px-5 py-5 sm:px-6 sm:py-6">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px] bg-inari-vermillion/40" />
      <div className="flex items-baseline gap-x-3">
        <div className="dashboard-skeleton h-6 w-6 rounded-[2px]" />
        <div className="dashboard-skeleton h-3 w-[8rem] rounded-[2px]" />
      </div>
      <div className="mt-5 flex flex-col gap-y-2">
        <div className="dashboard-skeleton h-4 w-full rounded-[2px]" />
        <div className="dashboard-skeleton h-4 w-4/5 rounded-[2px]" />
      </div>
      {!compact && (
        <div className="dashboard-skeleton mt-5 h-32 w-full rounded-[2px]" />
      )}
    </div>
  )
}
