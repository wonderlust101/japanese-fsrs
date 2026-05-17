'use client'

import { useMemo } from 'react'
import Link from 'next/link'

import { TopBar } from '@/app/(app)/_components/top-bar'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { useAnalyticsDashboard } from '@/lib/api/analytics'

import { ConfusablePairList } from './ConfusablePairList'
import { LeechesList } from './LeechesList'
import { useMistakesDevState } from './MistakesDevPanel'
import { MistakesEmpty } from './MistakesEmpty'
import { MistakesFilterRow, useMistakesFiltersStorage } from './MistakesFilterRow'
import { PatternSummary } from './PatternSummary'
import { ProblemCardsBars } from './ProblemCardsBars'
import { QualityIssuesBars } from './QualityIssuesBars'
import {
  buildHeaderLine,
  classifyMistakes,
} from './mistakesInterpretation'
import type {
  MistakesData,
  MistakesFilters,
} from './mistakesTypes'

const PAGE_SHELL_CLASS     = 'min-h-screen bg-cool-paper-base pb-16'
const PAGE_CONTAINER_CLASS = 'mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-12 xl:px-16'
const HEADER_PADDING_CLASS = 'pt-6 pb-5 sm:pt-8 sm:pb-6 lg:pt-10 lg:pb-8'

const INITIAL_FILTERS: MistakesFilters = { deckId: 'all', timeRange: '30d' }

// ── Page chrome ─────────────────────────────────────────────────────────────

function MistakesTopBar(): React.JSX.Element {
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
      <h1 className="flex-1 truncate text-base font-semibold text-sumi-ink">Mistakes</h1>
    </TopBar>
  )
}

function MistakesHeader({ subtitle }: { subtitle: string }): React.JSX.Element {
  return (
    <div className={HEADER_PADDING_CLASS}>
      <PageHeader kanji="誤" label="Mistakes" title="Mistakes" subtitle={subtitle} />
    </div>
  )
}

// ── Live-data adapter ──────────────────────────────────────────────────────

/**
 * Build a minimal MistakesData from the live analytics dashboard. The
 * current API only exposes accuracy-by-layout and a heatmap; per-card
 * problem lists, leech lists, confusable pairs, and quality-issue
 * counts all require backend endpoints that aren't shipped yet.
 *
 * In production, this returns a "shell" object that classifies into
 * `clean` or `not-enough` depending on heatmap activity. The dev panel
 * fixtures preview the full design so the UI work can land ahead of
 * the backend.
 */
function adaptLive(reviewsInWindow: number): MistakesData {
  return {
    state:             reviewsInWindow < 50 ? 'not-enough' : 'clean',
    patternDiagnosis:  reviewsInWindow < 50
      ? 'Mistake patterns need a few weeks of reviews to read.'
      : 'Your collection is holding clean. Nothing flagged inside this window.',
    chips:             [],
    problemCards:      [],
    lapseBuckets:      [],
    leeches:           [],
    confusables:       [],
    qualityIssues:     [],
    totalReviews:      reviewsInWindow,
  }
}

// ── View ───────────────────────────────────────────────────────────────────

/**
 * Container for /insights/mistakes. Field-notes voice page: editorial
 * diagnosis at the top, then structured sections in IA order (Pattern
 * Summary, Problem Cards, Leeches, Confusables, Card Quality). A global
 * filter row (Deck, Time range) drives every section.
 *
 * Data source priority: dev fixture > live analytics adapter. The
 * fixture-driven preview shows the full design; production renders the
 * `clean` or `not-enough` empty states until the per-card mistake
 * pipeline ships server-side.
 */
export function MistakesView(): React.JSX.Element {
  const dev = useMistakesDevState()
  const isDev = process.env.NODE_ENV === 'development'
  const dashboardQuery = useAnalyticsDashboard()
  const [filters, setFilters] = useMistakesFiltersStorage(INITIAL_FILTERS)

  const reviewsInWindow = useMemo(() => {
    const items = dashboardQuery.data?.heatmap.items ?? []
    const days =
      filters.timeRange === '7d'  ? 7  :
      filters.timeRange === '30d' ? 30 :
      filters.timeRange === '90d' ? 90 :
      items.length
    return items.slice(-days).reduce((acc, d) => acc + d.count, 0)
  }, [dashboardQuery.data, filters.timeRange])

  const data: MistakesData | null = useMemo(() => {
    if (dev.fixtureData !== null) {
      const d = dev.fixtureData
      // Re-classify in case fixture state needs adjusting for previewing.
      return { ...d, state: classifyMistakes(d) }
    }
    if (dashboardQuery.data === undefined) return null
    const live = adaptLive(reviewsInWindow)
    return { ...live, state: classifyMistakes(live) }
  }, [dev.fixtureData, dashboardQuery.data, reviewsInWindow])

  // Forced dev states win first.
  if (dev.forcedState === 'error') {
    return (
      <PageShell>
        <MistakesHeader subtitle="A teacher's read on the slips, with action one click away." />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }
  if (dev.forcedState === 'loading') {
    return (
      <PageShell>
        <MistakesHeader subtitle="A teacher's read on the slips, with action one click away." />
        <MistakesSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.fixtureData === null && dashboardQuery.isError) {
    return (
      <PageShell>
        <MistakesHeader subtitle="A teacher's read on the slips, with action one click away." />
        <ErrorAlert />
        {dev.panel}
      </PageShell>
    )
  }

  if (dev.fixtureData === null && dashboardQuery.isLoading) {
    return (
      <PageShell>
        <MistakesHeader subtitle="A teacher's read on the slips, with action one click away." />
        <MistakesSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  if (data === null) {
    return (
      <PageShell>
        <MistakesHeader subtitle="A teacher's read on the slips, with action one click away." />
        <MistakesSkeleton />
        {dev.panel}
      </PageShell>
    )
  }

  // Empty-style states render the kitsune; the filter row is still useful.
  if (data.state === 'clean' || data.state === 'not-enough') {
    return (
      <PageShell>
        <MistakesHeader subtitle={buildHeaderLine(data)} />
        <MistakesFilterRow value={filters} onChange={setFilters} />
        <MistakesEmpty
          variant={data.state}
          isDev={isDev && dev.fixtureData !== null}
        />
        {dev.panel}
      </PageShell>
    )
  }

  const showLeechSection = data.leeches.length > 0

  return (
    <PageShell>
      <MistakesHeader subtitle={buildHeaderLine(data)} />
      <MistakesFilterRow value={filters} onChange={setFilters} />

      <div className="mt-6 flex flex-col gap-y-8 lg:gap-y-10">
        <SectionCard
          id="mistakes-pattern"
          kanji="紋"
          label="Pattern summary"
          description="A short read on the most useful pattern to act on."
          chrome="list"
        >
          <PatternSummary data={data} />
        </SectionCard>

        <SectionCard
          id="mistakes-problem"
          kanji="困"
          label="Problem cards"
          description="How concentrated is the trouble? Bucketed by lapse count."
          chrome="chart"
          variant="chart"
        >
          <ProblemCardsBars data={data} />
        </SectionCard>

        {showLeechSection && (
          <SectionCard
            id="mistakes-leeches"
            kanji="蛭"
            label="Leeches"
            description="Cards past the lapse threshold; repair is usually faster than re-review."
            chrome="chart"
            variant="chart"
          >
            <LeechesList data={data} />
          </SectionCard>
        )}

        <SectionCard
          id="mistakes-confusables"
          kanji="紛"
          label="Confusable items"
          description="Words you've recently mixed up."
          chrome="chart"
          variant="chart"
        >
          <ConfusablePairList data={data} />
        </SectionCard>

        <SectionCard
          id="mistakes-quality"
          kanji="欠"
          label="Card quality"
          description="Cards missing support fields that may explain poor retention."
          chrome="chart"
          variant="chart"
        >
          <QualityIssuesBars data={data} />
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
      <MistakesTopBar />
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
      <p>Couldn&rsquo;t load your mistakes right now.</p>
      <p className="mt-1 text-error-deep/80">Refresh the page, or try again in a moment.</p>
    </div>
  )
}

function MistakesSkeleton(): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Loading your mistakes"
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
