'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { QuietLink } from '@/components/ui/QuietLink'
import { SectionCard } from '@/components/ui/SectionCard'
import { useDrillSessionQuery } from '@/lib/api/weak-spots'
import {
  useDrillActions,
  useDrillAttempts,
  useDrillExitedEarly,
  useDrillIsFinished,
  useDrillQueue,
  type DrillAttemptRecord,
} from '@/stores/useWeakSpotDrillSessionStore'

interface DrillSummaryClientProps {
  sessionId: string
}

interface DerivedMetrics {
  practiced:        number
  firstPassRecall:  number
  hesitated:        number
  missed:           number
  countedAsReview:  number
  medianRtMs:       number | null
  totalRecallRate:  number | null
}

/**
 * Post-drill summary. Drill-specific metrics only (per the doc's voice
 * rules: "Use labels such as 'practice confidence,' 'session accuracy,'
 * or 'steady enough to resolve.' Reserve 'retention' and 'retrievability'
 * for canonical FSRS analytics."):
 *
 *   - Cards practiced
 *   - First-pass recall rate
 *   - Hesitated count
 *   - Missed count (still need attention)
 *   - Median response time
 *   - Cards counted as real reviews (always 0 in Phase 2)
 *
 * Reads from the local Zustand store first (instant, survives a backend
 * outage). Falls back to the session detail query if the local store was
 * cleared (e.g. direct deep-link to a summary URL from a different tab).
 */
export function DrillSummaryClient({
  sessionId,
}: DrillSummaryClientProps): React.JSX.Element {
  const isFinished  = useDrillIsFinished()
  const exitedEarly = useDrillExitedEarly()
  const attempts    = useDrillAttempts()
  const queue       = useDrillQueue()
  const actions     = useDrillActions()

  // Refetch detail if the local store doesn't have a finished session for
  // this id — covers the deep-link case. The query handles loading itself.
  const detailQuery = useDrillSessionQuery(isFinished ? null : sessionId)

  // Reset the store on unmount so a stale 'finished' state doesn't trail
  // into the next visit.
  useEffect(() => {
    return () => {
      // Only reset if we still hold a finished session for this id, so we
      // don't accidentally nuke an in-progress session from another tab.
      // The cleanup intentionally captures `isFinished` and `actions` only
      // at mount; redundant resets on re-render aren't useful here.
      if (isFinished) actions.reset()
    }
  }, [])

  const metrics = useMemo<DerivedMetrics>(() => deriveMetrics(attempts), [attempts])

  // ── States ───────────────────────────────────────────────────────────────
  if (!isFinished && detailQuery.isLoading) {
    return (
      <PageShell>
        <p className="text-sm text-faded-sumi">Loading drill summary…</p>
      </PageShell>
    )
  }

  if (!isFinished && (detailQuery.isError || detailQuery.data === undefined)) {
    return (
      <PageShell>
        <div role="alert" className="rounded-[2px] border border-error/30 bg-error-tint/40 px-5 py-6 text-sm text-error-deep">
          <p>Couldn’t load that drill summary.</p>
          <p className="mt-1 text-error-deep/80">Open the weak spots page to start a fresh drill.</p>
          <div className="mt-4">
            <Link
              href="/insights/weak-spots"
              className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep underline-offset-2 hover:underline"
            >
              Back to Weak spots →
            </Link>
          </div>
        </div>
      </PageShell>
    )
  }

  if (attempts.length === 0) {
    return (
      <PageShell>
        <SectionCard
          id="drill-summary-empty"
          kanji="畢"
          label="Drill ended"
          description={exitedEarly ? 'Exited before rating any cards.' : 'No cards were rated.'}
          variant="compact"
        >
          <p className="text-sm leading-relaxed text-faded-sumi">
            Nothing was answered, so there’s nothing to read. The schedule is
            untouched — your reviews continue as before.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/insights/weak-spots/drill/setup"
              className="inline-flex h-10 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-4 text-sm font-semibold text-warm-paper-raised transition-colors hover:bg-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
            >
              Start a new drill
            </Link>
            <QuietLink href="/insights/weak-spots" tone="sumi" size="sm">
              Back to Weak spots
            </QuietLink>
          </div>
        </SectionCard>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-y-8">
        {exitedEarly && (
          <div
            role="status"
            className="rounded-[2px] border border-soft-hairline bg-cream-inset/50 px-4 py-3 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi"
          >
            Exited early · queue not finished
          </div>
        )}

        {/* Headline metrics */}
        <SectionCard
          id="drill-summary-metrics"
          kanji="数"
          label="Drill outcome"
          description="A drill-only read. Your review schedule is unchanged."
          variant="compact"
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
            <Metric
              label="Practiced"
              value={String(metrics.practiced)}
              unit={metrics.practiced === 1 ? 'card' : 'cards'}
            />
            <Metric
              label="Remembered"
              value={
                metrics.totalRecallRate === null
                  ? '—'
                  : `${Math.round(metrics.totalRecallRate * 100)}%`
              }
              unit="recall"
            />
            <Metric
              label="Hesitated"
              value={String(metrics.hesitated)}
              unit={metrics.hesitated === 1 ? 'card' : 'cards'}
            />
            <Metric
              label="Missed"
              value={String(metrics.missed)}
              unit={metrics.missed === 1 ? 'card' : 'cards'}
              tone={metrics.missed > 0 ? 'attention' : 'sumi'}
            />
            <Metric
              label="First-pass"
              value={
                metrics.firstPassRecall === 0
                  ? '0'
                  : String(metrics.firstPassRecall)
              }
              unit={metrics.firstPassRecall === 1 ? 'card' : 'cards'}
              hint="Remembered on first attempt"
            />
            <Metric
              label="Median time"
              value={
                metrics.medianRtMs === null
                  ? '—'
                  : formatResponseTime(metrics.medianRtMs)
              }
              unit="per card"
            />
            <Metric
              label="Queue"
              value={`${attempts.length}/${queue.length}`}
              unit={queue.length === 1 ? 'card' : 'cards'}
              hint={attempts.length < queue.length ? 'Unfinished' : 'Complete'}
            />
            <Metric
              label="Counted as review"
              value={String(metrics.countedAsReview)}
              unit={metrics.countedAsReview === 1 ? 'attempt' : 'attempts'}
            />
          </dl>
        </SectionCard>

        {/* Per-card detail */}
        <SectionCard
          id="drill-summary-cards"
          kanji="札"
          label="Cards"
          description={metrics.missed > 0
            ? 'Cards that still need another look are first.'
            : 'In the order you answered.'}
          variant="compact"
        >
          <ul role="list" className="flex flex-col divide-y divide-soft-hairline">
            {[...attempts]
              .sort((a, b) => attemptPriority(a) - attemptPriority(b))
              .map((attempt) => (
                <li
                  key={attempt.eventId}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 first:pt-0"
                >
                  <p className="text-sm text-sumi-ink">
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                      {attempt.result === 'missed' ? 'Missed' : attempt.result === 'hesitated' ? 'Hesitated' : 'Remembered'}
                    </span>
                    <span className="mx-2 text-faded-sumi" aria-hidden="true">·</span>
                    <span className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
                      {formatResponseTime(attempt.responseTimeMs)}
                    </span>
                  </p>
                  <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
                    {new Date(attempt.answeredAt).toLocaleTimeString(undefined, {
                      hour:   '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </li>
              ))}
          </ul>
        </SectionCard>

        {/* Actions */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-soft-hairline pt-6">
          <Link
            href="/insights/weak-spots/drill/setup"
            className="inline-flex h-10 items-center justify-center rounded-[2px] bg-inari-vermillion-deep px-4 text-sm font-semibold text-warm-paper-raised transition-colors hover:bg-inari-vermillion focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            Start another drill
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => {
              window.location.href = '/insights/weak-spots'
            }}
          >
            Back to Weak spots
          </Button>
          <QuietLink href="/today" tone="sumi" size="sm" trailingArrow>
            Open today
          </QuietLink>
        </footer>
      </div>
    </PageShell>
  )
}

// ── Shell + helpers ──────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-soft-hairline bg-warm-paper-raised">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-3 px-4 md:px-6">
          <Link
            href="/insights/weak-spots"
            className="flex items-center gap-1 text-sm text-faded-sumi transition-colors hover:text-sumi-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-sumi-ink focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">←</span>
            <span>Back to Weak spots</span>
          </Link>
          <p className="font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-inari-vermillion-deep">
            Drill summary
          </p>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[960px] flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <PageHeader
          kanji="弱"
          label="Drill summary"
          title="A drill-only read."
          subtitle="Practice confidence, not retention. Your review timing stayed exactly as it was."
        />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  )
}

interface MetricProps {
  label: string
  value: string
  unit?: string
  hint?: string
  tone?: 'sumi' | 'attention'
}

function Metric({
  label,
  value,
  unit,
  hint,
  tone = 'sumi',
}: MetricProps): React.JSX.Element {
  return (
    <div>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-faded-sumi">
        {label}
      </dt>
      <dd
        className={[
          'mt-1.5 font-display text-2xl leading-none tabular-nums',
          tone === 'attention' ? 'text-inari-vermillion-deep' : 'text-sumi-ink',
        ].join(' ')}
      >
        {value}
        {unit !== undefined && (
          <span className="ml-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.16em] text-faded-sumi">
            {unit}
          </span>
        )}
      </dd>
      {hint !== undefined && (
        <p className="mt-1 text-[0.75rem] leading-snug text-faded-sumi">{hint}</p>
      )}
    </div>
  )
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function deriveMetrics(attempts: readonly DrillAttemptRecord[]): DerivedMetrics {
  if (attempts.length === 0) {
    return {
      practiced:       0,
      firstPassRecall: 0,
      hesitated:       0,
      missed:          0,
      countedAsReview: 0,
      medianRtMs:      null,
      totalRecallRate: null,
    }
  }

  const seenCardIds = new Set<string>()
  let firstPassRecall = 0
  let missed = 0
  let hesitated = 0
  let remembered = 0
  let countedAsReview = 0
  const responseTimes: number[] = []

  for (const attempt of attempts) {
    const key = attempt.sessionCardId
    const isFirstSeen = !seenCardIds.has(key)
    seenCardIds.add(key)
    responseTimes.push(attempt.responseTimeMs)
    if (attempt.countedAsReview) countedAsReview++
    if (attempt.result === 'missed')      missed++
    if (attempt.result === 'hesitated')   hesitated++
    if (attempt.result === 'remembered') {
      remembered++
      if (isFirstSeen) firstPassRecall++
    }
  }

  const medianRtMs = responseTimes.length === 0 ? null : median(responseTimes)
  const totalRecallRate = remembered / attempts.length

  return {
    practiced:       seenCardIds.size,
    firstPassRecall,
    hesitated,
    missed,
    countedAsReview,
    medianRtMs,
    totalRecallRate,
  }
}

function attemptPriority(attempt: DrillAttemptRecord): number {
  if (attempt.result === 'missed')     return 0
  if (attempt.result === 'hesitated')  return 1
  return 2
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
  }
  return sorted[mid] ?? 0
}

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 100) / 10
  return `${s}s`
}
