'use client'

import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { Logo } from '@/components/ui/Logo'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'

import { ActivitySection } from './ActivitySection'
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
 * Statistics container. Renders chrome (TopBar + PageHeader + sticky
 * section tabs), then five sections in order. Data flows from either the
 * live API (when wired up) or the dev-panel fixture. Each chart component
 * accepts typed data props and renders against whatever it's given.
 */
export function StatisticsView(): React.JSX.Element {
  const dev = useStatisticsDevState()
  const isDev = process.env.NODE_ENV === 'development'

  // No live data hook yet — the production version will replace this with
  // real query hooks. Until then, data comes only from the dev panel
  // fixtures. When no fixture is selected ("off"), render the empty state.
  const data = dev.fixtureData

  if (dev.forcedState === 'error') {
    return (
      <>
        <StatisticsTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div className={PAGE_CONTAINER_CLASS}>
            <StatisticsHeader />
            <div
              role="alert"
              className="mx-auto w-full max-w-[760px] rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep"
            >
              <p>Couldn&rsquo;t load your statistics right now.</p>
              <p className="mt-1 text-error-deep/80">
                Refresh the page, or try again in a moment.
              </p>
            </div>
          </div>
        </div>
        {dev.panel}
      </>
    )
  }

  if (dev.forcedState === 'loading') {
    return (
      <>
        <StatisticsTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div className={PAGE_CONTAINER_CLASS}>
            <StatisticsHeader />
            <StatisticsSkeleton />
          </div>
        </div>
        {dev.panel}
      </>
    )
  }

  if (data === null) {
    return (
      <>
        <StatisticsTopBar />
        <div className={PAGE_SHELL_CLASS}>
          <div className={PAGE_CONTAINER_CLASS}>
            <StatisticsHeader />
            <StatisticsEmpty isDev={isDev} />
          </div>
        </div>
        {dev.panel}
      </>
    )
  }

  return (
    <>
      <StatisticsTopBar />
      <div className={PAGE_SHELL_CLASS}>
        <div className={PAGE_CONTAINER_CLASS}>
          <StatisticsHeader />
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
        </div>
      </div>
      {dev.panel}
    </>
  )
}

// ── Empty state ─────────────────────────────────────────────────────────────

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
          ? 'No fixture selected. Pick one from the dev panel in the bottom-left to preview each section.'
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

// ── Skeleton ────────────────────────────────────────────────────────────────

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
