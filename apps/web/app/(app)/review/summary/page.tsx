'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { Button }                                              from '@/components/ui/Button'
import { Card }                                                from '@/components/ui/Card'
import { Logo }                                                from '@/components/ui/Logo'
import { SectionCard }                                         from '@/components/ui/SectionCard'
import { RatingDistributionBar, buildDistributionTakeaway }    from '@/components/review/summary/RatingDistributionBar'
import { WeakSpotRow }                                      from '@/components/review/summary/WeakSpotRow'
import { WeekRhythmStrip, type WeekRhythmState }               from '@/app/(app)/today/_components/week-rhythm-strip'
import { buildDashboardCalendarContext }                       from '@/app/(app)/today/_components/today-calendar'
import { useReviewForecast, useSessionSummary }                from '@/lib/api/reviews'
import {
  useSessionActions,
  useSessionHistory,
  useSessionId,
} from '@/stores/useReviewSessionStore'
import {
  buildSummaryContent,
  type ActionRoute,
  type SessionPattern,
  type SummaryContent,
} from '@/lib/review/summary-pattern'
import { readLastFinishedSession } from '@/lib/review/last-finished-session'

import {
  SUMMARY_FIXTURES,
  SUMMARY_FIXTURE_KEYS,
  FIXTURE_MEANINGS,
} from './_components/summary-fixtures'
import { SummaryDevSwitcher } from './_components/summary-dev-switcher'

import type { SessionWeakSpot, SessionSummary } from '@fsrs-japanese/shared-types'

const FIXTURE_KEY_SET = new Set<SessionPattern>(SUMMARY_FIXTURE_KEYS)

function formatTime(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function ReviewSummaryPage(): React.JSX.Element {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { reset }    = useSessionActions()

  const rawId        = searchParams.get('id')
  const endedEarly   = searchParams.get('ended') === 'early'
  const fixtureParam = searchParams.get('fixture')

  // Dev fixture short-circuit: when `?fixture=<pattern>` is present and the
  // app is not in production, render the matching synthetic summary. Lets
  // the dev dock preview every state without spinning a real session.
  const fixtureSummary = useMemo<SessionSummary | null>(() => {
    if (process.env.NODE_ENV === 'production') return null
    if (fixtureParam === null) return null
    const key = fixtureParam as SessionPattern
    if (!FIXTURE_KEY_SET.has(key)) return null
    return SUMMARY_FIXTURES[key]
  }, [fixtureParam])

  const usingFixture = fixtureSummary !== null

  // Local short-circuit: the session store still holds the finished session
  // in memory (phase === 'finished'). When `?ended=early` matches the local
  // session id AND no cards were rated, the API would round-trip to return
  // an empty payload (or a 404). Skip the call entirely and render from
  // local state — instant, and survives a backend outage.
  const localSessionId      = useSessionId()
  const localSessionHistory = useSessionHistory()
  const lastFinished        = useMemo(() => readLastFinishedSession(), [])
  const liveStoreSaysEmpty  = rawId !== null
    && rawId === localSessionId
    && localSessionHistory.length === 0
  const handoffSaysEmpty    = rawId !== null
    && lastFinished !== null
    && lastFinished.sessionId === rawId
    && lastFinished.historyCount === 0
  const skipApi = !usingFixture
    && endedEarly
    && (liveStoreSaysEmpty || handoffSaysEmpty)

  // Guard: with no session id and no fixture, route back to setup.
  useEffect(() => {
    if (usingFixture) return
    if (rawId === null || rawId === '') {
      router.replace('/review/setup')
    }
  }, [usingFixture, rawId, router])

  const query        = useSessionSummary(usingFixture || skipApi ? null : rawId)
  const forecastQuery = useReviewForecast()

  // todayKey for WeekRhythmStrip — resolved client-side from the browser's
  // timezone so the chart aligns with the user's "today." `null` on first
  // render (SSR / hydration) keeps the strip in `loading` state until the
  // effect resolves it.
  const [todayKey, setTodayKey] = useState<string | null>(null)
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    setTodayKey(buildDashboardCalendarContext(new Date(), tz).todayKey)
  }, [])

  // Synthetic empty-session payload used when the user ended early before
  // any reviews persisted. Mirrors the SessionSummary contract with zeros
  // so the rest of the page can render the ended-early pattern unchanged.
  const emptyEndedEarlySummary: SessionSummary = useMemo(() => ({
    sessionId:       rawId ?? '',
    totalCards:      0,
    totalTimeMs:     0,
    accuracyPct:     0,
    nextDueAt:       null,
    ratingBreakdown: { again: 0, hard: 0, good: 0, easy: 0 },
    weakSpots:         [],
  }), [rawId])

  const summary: SessionSummary | undefined = usingFixture
    ? fixtureSummary
    : skipApi
      ? emptyEndedEarlySummary
      : query.data

  if (!usingFixture && !skipApi && query.isLoading && summary === undefined) {
    return <SummaryFrame><SummarySkeleton /></SummaryFrame>
  }

  // Error / no-data branches. The ended-early path is forgiving: the
  // summary endpoint may legitimately have no rows yet (race against the
  // last deferred submission) or none at all (no cards rated), and either
  // way the learner should leave on a calm note, not an error card.
  const apiUnavailable = !usingFixture && !skipApi && (query.isError || summary === undefined)
  if (apiUnavailable && !endedEarly) {
    return (
      <SummaryFrame>
        <div className="mx-auto w-full max-w-[640px]">
          <Card variant="default" stripeTone="error">
            <h1 className="font-display text-2xl text-sumi-ink">Couldn’t load summary.</h1>
            <p className="mt-2 text-sm text-faded-sumi">
              Your reviews are saved. Open Today to continue, or refresh to try again.
            </p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => router.push('/today')}>
                Back to Today
              </Button>
            </div>
          </Card>
        </div>
      </SummaryFrame>
    )
  }

  const resolved: SessionSummary = summary ?? emptyEndedEarlySummary
  const content   = buildSummaryContent(resolved, endedEarly || resolved.totalCards === 0)
  const takeaway  = buildDistributionTakeaway(resolved.ratingBreakdown, resolved.totalCards)

  const showProblemCards = content.showProblemCards && resolved.weakSpots.length > 0

  function handlePrimary(): void {
    runAction(content.primary.route)
  }
  function handleSecondary(): void {
    if (content.secondary === undefined) return
    runAction(content.secondary.route)
  }

  function runAction(route: ActionRoute): void {
    reset()
    switch (route.kind) {
      case 'today':           router.push('/today'); return
      case 'insights':        router.push('/insights'); return
      case 'repair':          router.push('/review/repair'); return
      case 'review-problem':  {
        const ids = route.cardIds.join(',')
        router.push(`/review/repair?cards=${encodeURIComponent(ids)}`)
        return
      }
    }
  }

  // WeekRhythmStrip wiring. Strip is shown on every state except when the
  // browser still hasn't resolved its timezone (kept in `loading` until
  // todayKey lands). The forecast query feeds apiDays and drives the
  // strip's internal loading/error chrome.
  const weekRhythmState: WeekRhythmState =
    todayKey === null || forecastQuery.isLoading ? 'loading' :
    forecastQuery.isError                        ? 'error'   :
                                                   'default'
  const weekRhythmDays = forecastQuery.data?.items ?? []
  const weekRhythmTodayKey = todayKey ?? '1970-01-01'

  const weekStrip = (
    <WeekRhythmStrip
      state={weekRhythmState}
      todayKey={weekRhythmTodayKey}
      apiDays={weekRhythmDays}
    />
  )

  return (
    <SummaryFrame>
      <ClosureCard
        content={content}
        resolved={resolved}
        endedEarly={endedEarly}
        onPrimary={handlePrimary}
        onSecondary={handleSecondary}
      />

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <SessionDetailsCard
          content={content}
          breakdown={resolved.ratingBreakdown}
          total={resolved.totalCards}
          takeaway={takeaway}
        />
        {showProblemCards ? (
          <ProblemCardsCard
            weakSpots={resolved.weakSpots}
            usingFixture={usingFixture}
            onRepair={(weakSpot) => runAction({ kind: 'review-problem', cardIds: [weakSpot.cardId] })}
          />
        ) : (
          weekStrip
        )}
      </div>

      {showProblemCards && weekStrip}

      {process.env.NODE_ENV !== 'production' && (
        <SummaryDevSwitcher
          active={usingFixture ? (fixtureParam as SessionPattern) : null}
        />
      )}
    </SummaryFrame>
  )
}

// ── Frame ───────────────────────────────────────────────────────────────────
// Mirror of Setup's outer/inner pattern: outer `flex flex-1 flex-col` so the
// inner `grid flex-1 ... content-center` can claim the full available height
// and center its rows when content is short.

function SummaryFrame({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col">
      <div className="relative isolate flex flex-1 flex-col">
        <div className="relative z-10 mx-auto grid w-full max-w-[1440px] flex-1 grid-cols-1 content-center gap-y-8 px-6 pb-12 pt-8 md:px-12 md:pb-16 md:pt-10 lg:gap-y-10 lg:px-16 lg:pb-20 lg:pt-12">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Closure card ────────────────────────────────────────────────────────────
// Full-width SectionCard. Internal 2-col on lg+: text-left (kicker comes from
// SectionCard's own header, so the card body holds headline + receipt +
// rationale + action), mark-right at responsive 96 / 144px.

function ClosureCard({
  content,
  resolved,
  endedEarly,
  onPrimary,
  onSecondary,
}: {
  content:     SummaryContent
  resolved:    SessionSummary
  endedEarly:  boolean
  onPrimary:   () => void
  onSecondary: () => void
}): React.JSX.Element {
  const cardsWord  = resolved.totalCards === 1 ? 'card' : 'cards'
  const statusWord = endedEarly ? 'ended early' : 'completed'

  return (
    <SectionCard
      id="summary-closure"
      kanji={content.kicker.kanji}
      label={content.kicker.label}
    >
      <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <h1 className="break-words font-display text-[2rem] sm:text-[2.5rem] lg:text-[2.875rem] leading-[1.05] text-sumi-ink">
            {content.heroHeadline}
          </h1>

          {content.heroSubcopy !== undefined && (
            <p className="mt-3 max-w-[55ch] text-base text-faded-sumi leading-relaxed">
              {content.heroSubcopy}
            </p>
          )}

          <p className="mt-6 font-mono text-xs sm:text-sm text-faded-sumi">
            <span className="text-sumi-ink">{resolved.totalCards}</span> {cardsWord}
            <span aria-hidden="true" className="mx-2 text-soft-hairline">·</span>
            <span className="text-sumi-ink">{formatTime(resolved.totalTimeMs)}</span>
            <span aria-hidden="true" className="mx-2 text-soft-hairline">·</span>
            {statusWord}
          </p>

          <div className="mt-7 flex flex-col gap-4">
            <p className="max-w-[60ch] text-sm leading-relaxed text-faded-sumi">
              {content.rationale}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button variant="primary" size="lg" onClick={onPrimary}>
                {content.primary.label}
              </Button>
              {content.secondary !== undefined && (
                <Button variant="editorial" size="lg" onClick={onSecondary}>
                  {content.secondary.label}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Responsive kitsune: 96px below lg, 144px on lg+. Two Logo
            instances keep the next/image width/height attributes accurate
            at each size; the SVG asset is cached so the second load is free. */}
        <div
          aria-hidden="true"
          className="flex items-center justify-center lg:order-last lg:pl-4"
        >
          <span className="inline-flex lg:hidden">
            <Logo size={96} showWordmark={false} priority />
          </span>
          <span className="hidden lg:inline-flex">
            <Logo size={144} showWordmark={false} priority />
          </span>
        </div>
      </div>
    </SectionCard>
  )
}

// ── Session details card ────────────────────────────────────────────────────
// Two sub-sections inside one SectionCard, separated by a hairline. Top:
// "What to notice" diagnosis prose. Bottom: "Rating breakdown" with the
// existing distribution bar. The card's outer kanji header (詳 / Session
// details) labels the whole moment.

function SessionDetailsCard({
  content,
  breakdown,
  total,
  takeaway,
}: {
  content:   SummaryContent
  breakdown: { again: number; hard: number; good: number; easy: number }
  total:     number
  takeaway:  string
}): React.JSX.Element {
  return (
    <SectionCard
      id="summary-details"
      kanji="詳"
      label="Session details"
    >
      <div className="flex flex-col gap-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faded-sumi">
          What to notice
        </p>
        <p className="max-w-[62ch] text-base leading-relaxed text-sumi-ink">
          {content.diagnosisLead}
        </p>
        {content.diagnosisAside !== null && (
          <p className="max-w-[62ch] text-sm leading-relaxed text-faded-sumi">
            {content.diagnosisAside}
          </p>
        )}
      </div>

      <hr aria-hidden="true" className="my-6 border-0 border-t border-soft-hairline" />

      <div className="flex flex-col gap-3">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-faded-sumi">
          Rating breakdown
        </p>
        <RatingDistributionBar breakdown={breakdown} total={total} takeaway={takeaway} />
      </div>
    </SectionCard>
  )
}

// ── Weak spots card ──────────────────────────────────────────────────────
// SectionCard with the weakSpot list inside. Divide-y between rows; no
// top/bottom borders since the card chrome already contains the list.

function ProblemCardsCard({
  weakSpots,
  usingFixture,
  onRepair,
}: {
  weakSpots:      SessionWeakSpot[]
  usingFixture: boolean
  onRepair:     (weakSpot: SessionWeakSpot) => void
}): React.JSX.Element {
  return (
    <SectionCard
      id="summary-problem-cards"
      kanji="困"
      label="Weak spots"
      count={weakSpots.length}
    >
      <ul className="divide-y divide-soft-hairline">
        {weakSpots.map((weakSpot) => (
          <li key={weakSpot.weakSpotId}>
            <WeakSpotRow
              weakSpot={weakSpot}
              meaning={usingFixture ? FIXTURE_MEANINGS[weakSpot.cardId] : undefined}
              onRepair={onRepair}
            />
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}

// ── Skeleton ────────────────────────────────────────────────────────────────
// Mirrors the resolved layout: closure SectionCard placeholder + 2-col row
// (session details + a generic supporting placeholder) + week strip via
// WeekRhythmStrip's own loading chrome. Keeps the bordered SectionCard
// silhouette stable through hydration.

function SummarySkeleton(): React.JSX.Element {
  return (
    <>
      <SectionCard kanji="終" label="Session closed" ariaBusy>
        <div className="grid gap-6 sm:gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0 space-y-4">
            <div className="h-10 w-3/4 animate-pulse rounded-[2px] bg-cream-inset" />
            <div className="h-4 w-1/2 animate-pulse rounded-[2px] bg-cream-inset" />
            <div className="h-3 w-44 animate-pulse rounded-[2px] bg-cream-inset" />
            <div className="h-10 w-40 animate-pulse rounded-[2px] bg-cream-inset" />
          </div>
          <div className="flex items-center justify-center lg:pl-4" aria-hidden="true">
            <div className="h-24 w-24 animate-pulse rounded-full bg-cream-inset lg:h-36 lg:w-36" />
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <SectionCard kanji="詳" label="Session details" ariaBusy>
          <div className="space-y-3">
            <div className="h-2 w-24 animate-pulse rounded-[1px] bg-cream-inset" />
            <div className="h-4 w-full animate-pulse rounded-[2px] bg-cream-inset" />
            <div className="h-4 w-2/3 animate-pulse rounded-[2px] bg-cream-inset" />
          </div>
          <hr aria-hidden="true" className="my-6 border-0 border-t border-soft-hairline" />
          <div className="space-y-3">
            <div className="h-2 w-32 animate-pulse rounded-[1px] bg-cream-inset" />
            <div className="h-3 w-full animate-pulse rounded-[2px] bg-cream-inset" />
            <div className="h-3 w-1/2 animate-pulse rounded-[2px] bg-cream-inset" />
          </div>
        </SectionCard>

        <SectionCard kanji="週" label="The week ahead" ariaBusy>
          <div className="mt-2 flex h-[168px] items-end gap-2">
            {[46, 72, 34, 88, 58, 26, 64].map((h, i) => (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-t-[1px] bg-cream-inset"
                style={{ height: `${h}px` }}
              />
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  )
}
